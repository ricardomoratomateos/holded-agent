# Sistema de Agentes Avanzado - Implementación Completa

## 📋 Resumen

Se ha implementado un sistema multi-agente completo con:
- ✅ **Caché semántica** con embeddings (Redis)
- ✅ **Validación de schemas** genérica (AJV)
- ✅ **Planning Agent** para queries complejas
- ✅ **Reflection Agent** para prevenir errores
- ✅ **Verification Agent** para detectar discrepancias
- ✅ **Self-Correction Loop** (Analyzer + Corrector)
- ✅ **Judge Agent** para evaluación asíncrona

---

## 🏗️ Arquitectura del Flujo

```
Usuario → Supervisor
           ↓
    ¿Necesita planning?
           ↓
    Planning Agent (si es complejo)
           ↓
    Holded/Analytics Agent
           ↓
    ¿POST/PUT/DELETE?
           ↓ (sí)
    Reflection Agent (pre-validación)
           ↓
    ¿Issues críticos?
           ↓ (no)
    Tools (ejecutar API call)
           ↓
    Verification Agent (fetch y comparar)
           ↓
    ¿Discrepancias?
           ↓ (sí)
    Analyzer Agent (identificar causa)
           ↓
    Corrector Agent (fix automático)
           ↓
    Re-Verification (máx 3 intentos)
           ↓
    ✅ Verified o ❌ Escalar a humano
           ↓
    Judge (async, background)
```

---

## 📁 Archivos Creados

### 1. Estado y Tipos
- `src/agent/state.ts` - Estado extendido con plan, reflection, verification, executionTrace

### 2. Routing
- `src/agent/edges.ts` - Funciones de conditional edges (shouldReflect, afterVerification, etc)

### 3. Caché Semántica
- `src/cache/semantic-documentation-cache.ts` - Cache con embeddings de OpenAI

### 4. Validadores
- `src/agent/validators/schema-validator.ts` - Validador genérico basado en schemas OpenAPI + AJV

### 5. Agentes Nuevos
- `src/agent/agents/planning-agent.ts` - Descompone queries complejas
- `src/agent/agents/reflection-agent.ts` - Pre-validación antes de ejecutar
- `src/agent/agents/verification-agent.ts` - Post-validación con fetch
- `src/agent/agents/analyzer-agent.ts` - Analiza discrepancias
- `src/agent/agents/corrector-agent.ts` - Corrige automáticamente

### 6. Prompts
- `src/agent/prompts/planning.ts`
- `src/agent/prompts/reflection.ts`
- `src/agent/prompts/verification.ts`
- `src/agent/prompts/analyzer.ts`
- `src/agent/prompts/corrector.ts`
- `src/agent/prompts/judge.ts`

### 7. Infraestructura
- `src/agent/tool-interceptor.ts` - Captura IDs de recursos creados
- `src/evaluation/judge-queue.ts` - Cola async para Judge

### 8. Docker y Config
- `docker-compose.yml` - Añadido Redis para dev
- `docker-compose.prod.yml` - Añadido Redis para prod
- `.env.example` - Variable REDIS_URL

---

## 🚀 Cómo Usar

### 1. Setup

```bash
# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env
# Editar .env y añadir:
# - OPENAI_API_KEY (para embeddings)
# - REDIS_URL=redis://localhost:6379
# - HOLDED_API_KEY=...
```

### 2. Arrancar Redis

```bash
# Opción A: Docker
docker-compose up redis -d

# Opción B: Local
redis-server
```

### 3. Arrancar el backend

```bash
npm run dev
```

---

## 🎯 Casos de Uso

### Caso 1: Query Simple (sin planning)

**Usuario**: "Crea un contacto llamado Juan"

**Flujo**:
1. Supervisor → `holded_agent`
2. Holded Agent genera tool call POST
3. Reflection valida datos (timestamps, campos required)
4. Tools ejecuta POST
5. Verification fetch del contacto creado y compara
6. ✅ Si OK: responde al usuario
7. Judge evalúa en background

### Caso 2: Query Compleja (con planning)

**Usuario**: "Genera un informe completo de todas las facturas del último trimestre, calcula el total y crea un documento PDF"

**Flujo**:
1. Supervisor detecta complejidad → `planning_agent`
2. Planning descompone en 3 steps:
   - Step 1: Obtener facturas (analytics_agent)
   - Step 2: Calcular totales (analytics_agent)
   - Step 3: Crear PDF (holded_agent)
3. Ejecuta cada step secuencialmente
4. Judge evalúa todo el proceso

### Caso 3: Error Corregido Automáticamente

**Usuario**: "Crea una factura para Acme con total 100€"

**Flujo**:
1. Holded Agent genera POST con datos
2. Reflection valida y aprueba
3. Tools ejecuta POST → API devuelve ID
4. Verification fetch de la factura
5. ❌ Detecta: total esperado 100€, actual 95€
6. Analyzer identifica: falta IVA en una línea
7. Corrector ejecuta PUT con datos corregidos
8. Re-Verification → ✅ Ahora sí es correcto
9. Responde al usuario

---

## 🔧 Configuración Avanzada

### Ajustar Umbral de Similitud en Caché

`src/cache/semantic-documentation-cache.ts:18`
```typescript
private readonly SIMILARITY_THRESHOLD = 0.92; // Cambiar a 0.85 para más hits
```

### Cambiar Máximo de Intentos de Corrección

`src/agent/edges.ts:6`
```typescript
const MAX_CORRECTION_ATTEMPTS = 3; // Cambiar a 5 para más reintentos
```

### Desactivar Judge Temporalmente

`src/agent/graph.ts:143-153` - Comentar el wrapper de Judge

---

## 📊 Métricas y Observabilidad

### Logs del Sistema

```bash
# Caché semántica
[SEMANTIC CACHE HIT] "list contacts" → "listado de contactos" (95.3% similarity)
[SEMANTIC CACHE MISS] "crear producto" (checked 5 entries)

# Verificación
[VERIFICATION] Fetching resource: invoicing/v1/documents/invoice/abc123
[VERIFICATION] Status: failed - 1 discrepancy found

# Judge
[JUDGE] Evaluando thread thread_abc123...
[JUDGE] Evaluación completada. Score: 8/10
```

### Monitorear Caché

```typescript
import { SemanticDocumentationCache } from './src/cache/semantic-documentation-cache.js';

const cache = new SemanticDocumentationCache();
const stats = await cache.getStats();
console.log(stats);
// { totalEntries: 15, oldestEntry: 1706..., newestEntry: 1706... }
```

### Tamaño de Cola de Judge

```typescript
import { judgeQueue } from './src/evaluation/judge-queue.js';

console.log(judgeQueue.getQueueSize()); // 3
```

---

## 🧪 Testing Manual

### 1. Probar Caché Semántica

```bash
# Primera query (cache miss)
curl -X POST http://localhost:3300/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Busca documentación sobre GET contactos"}'

# Segunda query en otro idioma (cache hit esperado)
curl -X POST http://localhost:3300/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"list contacts GET documentation"}'
```

### 2. Probar Planning

```bash
curl -X POST http://localhost:3300/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Genera un análisis completo de todas las facturas del último trimestre, compara con el año anterior y crea un informe PDF"}'
```

### 3. Probar Reflection (prevención)

```bash
# Enviar datos con timestamp incorrecto
curl -X POST http://localhost:3300/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Crea una factura con fecha 1706395200000"}' # Milisegundos (incorrecto)

# Debería detectar el error ANTES de enviar a API
```

### 4. Probar Verification + Correction

```bash
# Crear recurso que probablemente tenga discrepancia
curl -X POST http://localhost:3300/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Crea una factura para Acme con 3 productos sin especificar IVA"}'

# Debería:
# 1. Crear la factura
# 2. Detectar que falta IVA (verification)
# 3. Corregir automáticamente (correction)
# 4. Re-verificar
```

---

## 🐛 Troubleshooting

### Error: "Cannot connect to Redis"

**Solución**:
```bash
docker-compose up redis -d
# o
redis-server
```

### Error: "OpenAI API key not found"

**Solución**: Añadir `OPENAI_API_KEY` al `.env`

### Cache no funciona (siempre MISS)

**Posibles causas**:
1. Redis no está corriendo
2. REDIS_URL incorrecta en .env
3. Umbral de similitud muy alto (bajar a 0.85)

### Judge no evalúa

**Verificar**:
1. Que el `thread_id` se esté pasando en el config
2. Logs de `[JUDGE]` en consola
3. Errores en la cola: `judgeQueue.getQueueSize()`

### Self-correction loop infinito

**No debería pasar** (hay límite de 3 intentos), pero si ocurre:
1. Revisar `MAX_CORRECTION_ATTEMPTS` en edges.ts
2. Verificar que `attemptCount` se incrementa en corrector

---

## 📈 Próximas Mejoras (No Implementadas)

1. **Dashboard de Métricas**
   - Visualizar evaluaciones del Judge
   - Gráficos de accuracy, cache hits, correcciones

2. **Integración con Distill**
   - Optimización automática de prompts
   - Según evaluaciones del Judge

3. **DB para Trazas**
   - PostgreSQL o Pinecone
   - Almacenar evaluaciones históricas

4. **Testing Automatizado**
   - Catalyst framework
   - Tests de cada agente

---

## 🎉 Conclusión

Sistema completo implementado con:
- ✅ Caché semántica (ahorra $$ en embeddings)
- ✅ Validaciones pre y post ejecución
- ✅ Auto-corrección con límite de intentos
- ✅ Planning para queries complejas
- ✅ Judge para mejora continua

**Todo listo para probar!** 🚀
