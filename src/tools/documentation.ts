import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SemanticDocumentationCache } from "../cache/semantic-documentation-cache.js";

/**
 * Caché semántica para documentación usando embeddings de OpenAI
 * Reemplaza la cache en memoria simple con una solución que entiende
 * que "listado de contactos", "list contacts", "lista de contactos" son lo mismo
 */
const semanticCache = new SemanticDocumentationCache();

/**
 * Tool multistep que busca documentación de la API de Holded y extrae el formato correcto
 * Usa fetch simple con parámetros ?dereference=true&reduce=false para obtener schema OpenAPI
 */
export function createGetApiDocsTool(braveSearchTool: any) {
  return tool(
    async ({ searchQuery, errorMessage }) => {
      try {
        // PASO 0: Verificar caché semántica
        const cached = await semanticCache.get(searchQuery);
        if (cached) {
          return cached; // Cache hit con similitud semántica
        }

        // PASO 1: Buscar en developers.holded.com
        const fullQuery = `site:developers.holded.com ${searchQuery}`;
        const searchResult = await braveSearchTool.execute({ query: fullQuery });

        // PASO 2: Usar LLM para elegir la URL más relevante
        const llm = new ChatOpenAI({
          modelName: "gpt-4o-mini",
          temperature: 0
        });

        const selectionPrompt = `Tienes estos resultados de búsqueda de la documentación de Holded API.
Analiza los títulos, descripciones y URLs, y elige la URL MÁS RELEVANTE para: "${searchQuery}"

Resultados de búsqueda:
${JSON.stringify(searchResult, null, 2)}

IMPORTANTE - Distingue la operación:
- Si la query incluye "GET" o "list" o "listar" o "filtrar" → elige endpoints de LISTADO (ej: "List Documents", "Get Contacts")
- Si la query incluye "POST" o "create" o "crear" → elige endpoints de CREACIÓN (ej: "Create Document", "Create Contact")
- Si la query incluye "PUT" o "update" o "actualizar" → elige endpoints de ACTUALIZACIÓN
- Si la query incluye "DELETE" o "borrar" o "eliminar" → elige endpoints de BORRADO

Responde SOLO con la URL completa de developers.holded.com (ejemplo: https://developers.holded.com/reference/list-documents)
NO añadas explicaciones, SOLO la URL.`;

        const urlSelection = await llm.invoke(selectionPrompt);
        const docUrl = (typeof urlSelection.content === 'string'
          ? urlSelection.content
          : JSON.stringify(urlSelection.content)
        ).trim();

        // Validar que sea una URL válida
        if (!docUrl.startsWith('https://developers.holded.com')) {
          return JSON.stringify({
            success: false,
            error: "No se encontró una URL válida en los resultados de búsqueda",
            suggestion: "Intenta con una búsqueda más específica o verifica manualmente en developers.holded.com"
          });
        }

        // PASO 3: Transformar URL para obtener schema OpenAPI completo
        // Brave devuelve: https://developers.holded.com/reference/create-document-1
        // Necesitamos: https://developers.holded.com/holded/api-next/v2/branches/1.0/reference/create-document-1?dereference=true&reduce=false
        const transformedUrl = docUrl.replace(
          '/reference/',
          '/holded/api-next/v2/branches/1.0/reference/'
        );
        const apiUrl = transformedUrl.includes('?')
          ? `${transformedUrl}&dereference=true&reduce=false`
          : `${transformedUrl}?dereference=true&reduce=false`;

        // PASO 4: Fetch simple con headers de navegador
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        if (!response.ok) {
          return JSON.stringify({
            success: false,
            error: `Error HTTP ${response.status} al obtener documentación`
          });
        }

        const jsonData = await response.json();

        // Extraer info del endpoint específico
        const method = jsonData.data?.api?.method?.toLowerCase();
        const path = jsonData.data?.api?.path;
        const schema = jsonData.data?.api?.schema;

        if (!method || !path || !schema?.paths) {
          return JSON.stringify({
            success: false,
            error: "Schema OpenAPI incompleto o formato inesperado"
          });
        }

        // PASO 5: Extraer el endpoint del schema
        const endpointData = schema.paths[path]?.[method];
        if (!endpointData) {
          return JSON.stringify({
            success: false,
            error: `No se encontró ${method.toUpperCase()} ${path} en el schema`
          });
        }

        // Extraer requestBody schema y examples (para POST/PUT)
        const requestSchema = endpointData.requestBody?.content?.['application/json']?.schema;
        const requestExample = endpointData.requestBody?.content?.['application/json']?.['x-examples'];
        const responseSchema = endpointData.responses?.['200']?.content?.['application/json']?.schema ||
                               endpointData.responses?.['201']?.content?.['application/json']?.schema;

        // Extraer query parameters (para GET)
        const queryParams = endpointData.parameters?.filter((p: any) => p.in === 'query') || [];
        const pathParams = endpointData.parameters?.filter((p: any) => p.in === 'path') || [];

        // Extraer prefijo de la API desde servers
        let fullPath = path;
        if (schema.servers && schema.servers.length > 0) {
          const serverUrl = schema.servers[0].url;
          // serverUrl es algo como "https://api.holded.com/api/invoicing/v1"
          // Extraemos "invoicing/v1"
          const match = serverUrl.match(/\/api\/(.+)$/);
          if (match) {
            const apiPrefix = match[1]; // "invoicing/v1"
            fullPath = `${apiPrefix}${path}`; // "invoicing/v1/contacts"
          }
        }

        // PASO 6: Formatear respuesta para el agente
        const formattedResponse: any = {
          operation: searchQuery,
          method: method.toUpperCase(),
          path: fullPath,
          description: endpointData.description || endpointData.summary || "",
          notes: []
        };

        // Incluir params según el método
        if (queryParams.length > 0) {
          formattedResponse.queryParameters = queryParams.map((p: any) => ({
            name: p.name,
            type: p.schema?.type || 'string',
            required: p.required || false,
            description: p.description || ''
          }));
        }

        if (pathParams.length > 0) {
          formattedResponse.pathParameters = pathParams.map((p: any) => ({
            name: p.name,
            type: p.schema?.type || 'string',
            required: p.required || false,
            description: p.description || ''
          }));
        }

        if (requestSchema) {
          formattedResponse.requestSchema = requestSchema;
        }
        if (requestExample) {
          formattedResponse.requestExample = requestExample;
        }
        if (responseSchema) {
          formattedResponse.responseSchema = responseSchema;
        }

        // Extraer campos requeridos
        if (requestSchema?.required) {
          formattedResponse.notes.push(`Campos obligatorios en body: ${requestSchema.required.join(', ')}`);
        }

        // Agregar notas importantes del content.body si existen
        const contentBody = jsonData.data?.content?.body;
        if (contentBody) {
          formattedResponse.notes.push(`Notas de la documentación: ${contentBody.substring(0, 500)}`);
        }

        const cleanJson = JSON.stringify(formattedResponse, null, 2);

        // PASO 7: Guardar en caché semántica (async, no bloqueante)
        semanticCache.set(searchQuery, cleanJson).catch(err => {
          console.error('Error guardando en cache semántica:', err);
        });

        return cleanJson;

      } catch (error: any) {
        return JSON.stringify({
          success: false,
          error: error.message || "Error desconocido al buscar documentación"
        });
      }
    },
    {
      name: "get_api_documentation",
      description: `Busca documentación detallada de la API de Holded cuando recibes errores o no estás seguro del formato.

Usa esta herramienta cuando:
- Recibes error 400/422/500 de la API de Holded por formato incorrecto
- No conoces qué campos usar para una operación
- Necesitas ver el formato y ejemplos de la documentación oficial

NO necesitas saber el endpoint exacto, solo describe QUÉ quieres hacer.

IMPORTANTE: Incluye siempre el método HTTP (GET/POST/PUT/DELETE):
- "GET list documents invoice" → query params para filtrar facturas
- "GET list contacts" → params para listar contactos
- "POST create document purchase" → body para crear compra
- "POST create product" → body para crear producto
- "PUT update contact" → body para actualizar contacto

Esta herramienta hace 7 pasos automáticamente:
1. Busca en developers.holded.com con tu descripción
2. Usa LLM para elegir la documentación más relevante
3. Obtiene el schema OpenAPI completo de la página
4. Extrae el endpoint específico del schema
5. Analiza requestBody, responseBody y ejemplos
6. Formatea la información en JSON estructurado
7. Cachea el resultado por 24h`,
      schema: z.object({
        searchQuery: z.string().describe("Descripción de lo que necesitas hacer o endpoint aproximado (ej: 'invoicing v1 POST purchases', 'crear productos', 'documents purchase')"),
        errorMessage: z.string().optional().describe("Mensaje de error recibido de la API (opcional, ayuda a entender qué salió mal)")
      })
    }
  );
}
