import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Caché en memoria para documentación (TTL: 24 horas)
 */
const docCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas en ms

/**
 * Tool multistep que busca documentación de la API de Holded y extrae el formato correcto
 * Usa Playwright para renderizar páginas dinámicas + caché en memoria
 */
export function createGetApiDocsTool(
  braveSearchTool: any,
  browserNavigate: any,
  browserEvaluate: any,
  browserClose: any
) {
  return tool(
    async ({ searchQuery, errorMessage }) => {
      try {
        console.log(`📚 Buscando documentación para: ${searchQuery}`);

        // PASO 0: Verificar caché
        const cacheKey = searchQuery.toLowerCase().trim();
        const cached = docCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
          console.log('✅ Documentación encontrada en caché');
          return cached.result;
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

IMPORTANTE:
- Si buscan crear/registrar purchases/compras, elige "Create Document" (explica cómo crear documentos tipo purchase)
- Si buscan crear productos, elige "Create Product"
- Si buscan crear contactos, elige "Create Contact"
- Prioriza URLs que expliquen cómo CREAR/MODIFICAR el recurso que necesitan
- Si hay múltiples opciones, elige la más específica para la operación buscada

Responde SOLO con la URL completa de developers.holded.com (ejemplo: https://developers.holded.com/reference/create-document-1)
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

        console.log(`📄 Documentación seleccionada: ${docUrl}`);

        // PASO 3: Navegar con Playwright para renderizar contenido dinámico
        console.log('🌐 Navegando con Playwright...');
        console.log('🌐 URL a navegar:', docUrl);

        const navResult = await browserNavigate.execute({ url: docUrl });
        console.log('🌐 Navegación exitosa');
        console.log('🌐 Resultado (primeros 300 chars):', JSON.stringify(navResult).substring(0, 300));

        // Esperar a que cargue el contenido (ReadMe.io es React)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // PASO 4: Extraer el texto completo del body con JavaScript
        console.log('📝 Ejecutando JavaScript en la página...');
        const evaluateResult = await browserEvaluate.execute({
          function: "() => document.body.innerText"
        });

        console.log('📦 Tipo de resultado:', typeof evaluateResult);
        console.log('📦 Es array:', Array.isArray(evaluateResult));

        // Playwright MCP devuelve [{ type: "text", text: "### Result\n<contenido>" }]
        let pageContent = '';
        if (Array.isArray(evaluateResult) && evaluateResult[0]?.text) {
          const fullText = evaluateResult[0].text;
          console.log('📄 Texto completo (primeros 500 chars):', fullText.substring(0, 500));
          console.log('📄 Contiene "POST":', fullText.includes('POST'));
          console.log('📄 Contiene "contactName":', fullText.includes('contactName'));
          console.log('📄 Contiene "items":', fullText.includes('items'));

          // Extraer solo el contenido después de "### Result\n"
          const resultMatch = fullText.match(/### Result\n([\s\S]*)/);
          pageContent = resultMatch ? resultMatch[1] : fullText;
        } else if (typeof evaluateResult === 'string') {
          pageContent = evaluateResult;
        } else {
          pageContent = JSON.stringify(evaluateResult);
        }

        // Cerrar navegador para liberar memoria
        await browserClose.execute({});

        console.log(`✅ Contenido renderizado capturado: ${pageContent.length} caracteres`);

        // PASO 5: Extraer formato con LLM
        const extractionPrompt = `Analiza esta documentación de la API de Holded y extrae:

1. CAMPOS OBLIGATORIOS con sus tipos
2. CAMPOS OPCIONALES con sus tipos
3. EJEMPLO JSON COMPLETO y CORRECTO del request body
4. NOTAS IMPORTANTES sobre el formato

Búsqueda original: ${searchQuery}
${errorMessage ? `Error recibido de la API: ${errorMessage}` : ""}

Contenido de la página (renderizado con navegador):
${pageContent.substring(0, 20000)}

Responde SOLO con JSON en este formato:
{
  "operation": "${searchQuery}",
  "method": "POST/GET/PUT/DELETE",
  "requiredFields": {
    "fieldName": "tipo y descripción"
  },
  "optionalFields": {
    "fieldName": "tipo y descripción"
  },
  "exampleRequest": {
    // ejemplo JSON completo
  },
  "notes": ["nota importante 1", "nota importante 2"]
}`;

        const extraction = await llm.invoke(extractionPrompt);
        const extractedContent = typeof extraction.content === 'string'
          ? extraction.content
          : JSON.stringify(extraction.content);

        // Limpiar respuesta (quitar markdown si existe)
        const jsonMatch = extractedContent.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : extractedContent;

        console.log("✅ Documentación extraída correctamente");

        // PASO 6: Guardar en caché
        docCache.set(cacheKey, {
          result: cleanJson,
          timestamp: Date.now()
        });
        console.log(`💾 Documentación guardada en caché (${docCache.size} entries)`);

        return cleanJson;

      } catch (error: any) {
        console.error("❌ Error en get_api_documentation:", error);
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

Ejemplos de búsquedas válidas:
- "invoicing v1 POST purchases" (crear compras)
- "crear documentos purchase"
- "POST products" (crear productos)
- "documentos de venta invoice"
- "contacts API create"

Esta herramienta hace 4 pasos automáticamente:
1. Busca en developers.holded.com con tu descripción
2. Usa LLM para elegir la documentación más relevante
3. Descarga la página completa
4. Extrae campos obligatorios, tipos y ejemplo JSON correcto`,
      schema: z.object({
        searchQuery: z.string().describe("Descripción de lo que necesitas hacer o endpoint aproximado (ej: 'invoicing v1 POST purchases', 'crear productos', 'documents purchase')"),
        errorMessage: z.string().optional().describe("Mensaje de error recibido de la API (opcional, ayuda a entender qué salió mal)")
      })
    }
  );
}
