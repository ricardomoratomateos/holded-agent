import { createClient, RedisClientType } from 'redis';
import { OpenAI } from 'openai';

/**
 * Caché semántica para documentación de API usando embeddings
 *
 * Resuelve el problema de que "listado de contactos", "list contacts", "lista de contactos"
 * son semánticamente iguales pero generan diferentes hashes.
 *
 * Usa embeddings de OpenAI (text-embedding-3-small) + similitud coseno.
 *
 * TODO: PROBLEMA DE ESCALABILIDAD CONOCIDO
 * ==========================================
 * La implementación actual tiene GRAVES problemas con millones de keys:
 *
 * 1. KEYS * es O(N) y BLOQUEA Redis (nunca usar en producción)
 * 2. N+1 queries: un HGETALL por cada key existente
 * 3. Comparación brute-force: O(N × 1536) operaciones de cosine similarity
 * 4. Sin índice vectorial optimizado (HNSW, IVF)
 *
 * SOLUCIÓN RECOMENDADA: Hybrid Redis + Qdrant
 * =============================================
 * Opción 4 - Best of both worlds:
 *
 * 1. Hash normalizado de query → Redis O(1) lookup (hit exacto)
 *    - Normalizar: lowercase + trim + remove special chars
 *    - Key: `doc:exact:${md5(normalized_query)}`
 *    - Value: documentación cacheada
 *
 * 2. Si miss en Redis → Qdrant vector search
 *    - Índice HNSW: O(log N) en lugar de O(N)
 *    - Top-K nearest neighbors con threshold 0.92
 *    - Escala a millones de vectores
 *    - 100% gratis, open source (Apache 2.0)
 *
 * 3. Guardar resultado en AMBOS:
 *    - Redis (exact match para siguiente vez)
 *    - Qdrant (vector para búsqueda semántica)
 *
 * VENTAJAS:
 * - Redis: hits exactos instantáneos (< 1ms)
 * - Qdrant: búsqueda semántica escalable (< 50ms)
 * - Qdrant self-hosted en Docker (sin costos externos)
 * - Performance comparable a Pinecone
 * - Interfaz web incluida (localhost:6333/dashboard)
 * - Unificar infraestructura con learning system:
 *   * Mismo índice Qdrant para:
 *     - Caché de documentación
 *     - Clustering de issues recurrentes
 *     - Búsqueda de casos similares en synthetic data
 *
 * SETUP Qdrant:
 * -------------
 * docker-compose.yml:
 *   qdrant:
 *     image: qdrant/qdrant:latest
 *     ports:
 *       - "6333:6333"
 *     volumes:
 *       - qdrant-data:/qdrant/storage
 *
 * npm install @qdrant/js-client-rest
 *
 * Uso:
 *   const client = new QdrantClient({ url: 'http://localhost:6333' });
 *   await client.createCollection('documentation', {
 *     vectors: { size: 1536, distance: 'Cosine' }
 *   });
 *   const results = await client.search('documentation', {
 *     vector: queryEmbedding,
 *     limit: 1,
 *     score_threshold: 0.92
 *   });
 *
 * IMPLEMENTACIÓN:
 * - Ahora: Limitación + SCAN (quick fix, max 1000 keys)
 * - Learning system: Migrar a Hybrid Redis+Qdrant
 */
export class SemanticDocumentationCache {
  private redis: RedisClientType;
  private openai: OpenAI;

  // Umbral de similitud mínimo para considerar un match (0.92 = 92%)
  private readonly SIMILARITY_THRESHOLD = 0.92;

  // TTL por defecto: 24 horas
  private readonly DEFAULT_TTL = 24 * 60 * 60;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Conectar a Redis
    this.redis.connect().catch(err => {
      console.error('Error conectando a Redis:', err);
    });

    // Manejar errores de Redis
    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  /**
   * Buscar en cache usando similitud semántica
   *
   * @param query Query de búsqueda (ej: "GET listado de contactos")
   * @returns Resultado cacheado o null si no hay match
   */
  async get(query: string): Promise<string | null> {
    try {
      // 1. Obtener embedding de la query
      const queryEmbedding = await this.getEmbedding(query);

      // 2. Buscar todas las keys de cache de documentación
      const keys = await this.redis.keys('doc:semantic:*');

      if (keys.length === 0) {
        return null;
      }

      // 3. Calcular similitud con cada entry cacheada
      let bestMatch: { key: string; similarity: number; query: string } | null = null;

      for (const key of keys) {
        const cachedData = await this.redis.hGetAll(key);
        if (!cachedData.embedding) continue;

        const cachedEmbedding = JSON.parse(cachedData.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, cachedEmbedding);

        if (similarity >= this.SIMILARITY_THRESHOLD) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = {
              key,
              similarity,
              query: cachedData.query || 'unknown'
            };
          }
        }
      }

      // 4. Si hay match, retornar resultado
      if (bestMatch) {
        console.log(`[SEMANTIC CACHE HIT] "${query}" → "${bestMatch.query}" (${(bestMatch.similarity * 100).toFixed(1)}% similarity)`);
        const result = await this.redis.hGet(bestMatch.key, 'result');
        return (result as string) || null;
      }

      console.log(`[SEMANTIC CACHE MISS] "${query}" (checked ${keys.length} entries)`);
      return null;

    } catch (error) {
      console.error('Error en semantic cache lookup:', error);
      return null;
    }
  }

  /**
   * Guardar en cache con su embedding
   *
   * @param query Query original
   * @param result Resultado a cachear (JSON string)
   * @param ttl Time to live en segundos (default: 24h)
   */
  async set(query: string, result: string, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const queryEmbedding = await this.getEmbedding(query);
      const key = `doc:semantic:${this.generateId()}`;

      // Guardar como hash con todos los datos
      await this.redis.hSet(key, {
        query,
        embedding: JSON.stringify(queryEmbedding),
        result,
        timestamp: Date.now().toString()
      });

      // Establecer expiración
      await this.redis.expire(key, ttl);

      console.log(`[SEMANTIC CACHE SET] "${query}" → ${key}`);

    } catch (error) {
      console.error('Error guardando en semantic cache:', error);
    }
  }

  /**
   * Invalidar toda la cache de documentación
   * Útil cuando se actualiza la documentación de Holded
   */
  async invalidateAll(): Promise<void> {
    try {
      const keys = await this.redis.keys('doc:semantic:*');
      if (keys.length > 0) {
        await this.redis.del(keys);
        console.log(`[SEMANTIC CACHE] Invalidadas ${keys.length} entradas`);
      }
    } catch (error) {
      console.error('Error invalidando cache:', error);
    }
  }

  /**
   * Obtener estadísticas de la cache
   */
  async getStats(): Promise<{
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const keys = await this.redis.keys('doc:semantic:*');

      if (keys.length === 0) {
        return { totalEntries: 0, oldestEntry: null, newestEntry: null };
      }

      const timestamps: number[] = [];
      for (const key of keys) {
        const ts = await this.redis.hGet(key, 'timestamp');
        if (ts) timestamps.push(parseInt(ts as string));
      }

      return {
        totalEntries: keys.length,
        oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
        newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
      };
    } catch (error) {
      console.error('Error obteniendo stats de cache:', error);
      return { totalEntries: 0, oldestEntry: null, newestEntry: null };
    }
  }

  /**
   * Cerrar conexión a Redis (útil para tests o shutdown)
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  // ========== MÉTODOS PRIVADOS ==========

  /**
   * Obtener embedding de OpenAI (text-embedding-3-small)
   * Modelo económico: $0.02 / 1M tokens
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: this.normalizeQuery(text),
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  }

  /**
   * Normalizar query para mejorar calidad de embeddings
   * - Lowercase
   * - Trim whitespace
   * - Normalizar espacios múltiples
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calcular similitud coseno entre 2 vectores
   * Retorna valor entre 0 y 1 (1 = idénticos, 0 = completamente diferentes)
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generar ID único para la key de Redis
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
