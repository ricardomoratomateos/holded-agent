import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SchemaValidator } from "../agent/validators/schema-validator.js";

const schemaValidator = new SchemaValidator();

/**
 * Herramienta para validar datos contra schemas de la API de Holded
 * antes de ejecutar operaciones de escritura (POST/PUT)
 */
export function createValidateSchemaTool(apiDocsTool: any | null) {
  return tool(
    async ({ method, path, data }) => {
      try {
        // PASO 1: Obtener schema del endpoint
        let requestSchema = { type: 'object' };

        if (apiDocsTool) {
          try {
            const docsQuery = `${method} ${path} request format schema`;
            const docsResult = await apiDocsTool.invoke({ searchQuery: docsQuery });

            const docsJson = JSON.parse(docsResult);
            if (docsJson.requestSchema) {
              requestSchema = docsJson.requestSchema;
            }
          } catch (error: any) {
            // Si no se puede obtener schema, continuar con validación mínima
            console.warn(`[VALIDATE] No se pudo obtener schema: ${error.message}`);
          }
        }

        // PASO 2: Validar con SchemaValidator
        const validation = schemaValidator.validate(data, requestSchema);

        // PASO 3: Formatear resultado
        if (validation.isValid) {
          return JSON.stringify({
            valid: true,
            message: "✅ Validación exitosa. Puedes proceder con la operación.",
            warnings: validation.issues.filter(i => i.severity === 'warning')
          });
        }

        // Hay errores críticos
        const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
        return JSON.stringify({
          valid: false,
          message: "❌ Validación fallida. Corrige estos errores antes de continuar:",
          errors: criticalIssues.map(i => ({
            field: i.field,
            type: i.type,
            message: i.message
          })),
          missingData: validation.missingData
        });

      } catch (error: any) {
        return JSON.stringify({
          valid: false,
          message: `Error durante validación: ${error.message}`
        });
      }
    },
    {
      name: "validate_schema",
      description: `Valida datos contra el schema de la API de Holded ANTES de ejecutar POST/PUT.

Usa esta herramienta para:
- Verificar que todos los campos obligatorios estén presentes
- Validar formatos (timestamps en segundos, no milisegundos)
- Detectar errores ANTES de hacer la llamada a la API

Úsala SIEMPRE antes de call_holded_api con POST/PUT para evitar errores.

Ejemplo de uso:
1. Primero llamas validate_schema con los datos que planeas enviar
2. Si retorna valid: true → llamas call_holded_api
3. Si retorna valid: false → corriges los errores y vuelves a validar`,
      schema: z.object({
        method: z.enum(['POST', 'PUT']).describe("Método HTTP de la operación"),
        path: z.string().describe("Path completo del endpoint con prefijo de API (ej: invoicing/v1/contacts, invoicing/v1/documents/invoice)"),
        data: z.any().describe("Datos que planeas enviar en el body")
      })
    }
  );
}
