import { ChatOpenAI } from "@langchain/openai";
import { ExecutionStep } from "../state.js";
import { withLLMTracing } from "../tracing.js";

/**
 * Usa un LLM para hacer merge inteligente de paths cuando hay múltiples placeholders
 *
 * @param templatePath - Path de la documentación con placeholders (ej: "invoicing/v1/documents/{docType}/{documentId}")
 * @param creationPath - Path usado en la creación (ej: "invoicing/v1/documents/invoice")
 * @param resourceId - ID del recurso creado
 * @param steps - Array para acumular execution steps (tracing)
 * @returns Path GET construido correctamente
 */
export async function constructPathWithLLM(params: {
  templatePath: string;
  creationPath: string;
  resourceId: string;
  steps: ExecutionStep[];
}): Promise<string> {
  const { templatePath, creationPath, resourceId, steps } = params;

  const model = withLLMTracing(
    new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    }),
    "path_constructor",
    "gpt-4o-mini",
    steps
  );

  const prompt = `Eres un experto en construcción de paths de API REST. Tienes que rellenar los placeholders de un template con los valores correctos.

DATOS DISPONIBLES:
- Template (de documentación): ${templatePath}
- Path de creación usado: ${creationPath}
- ID del recurso: ${resourceId}

TU TAREA:
Reemplaza cada placeholder del template con el valor correcto:
1. Compara el template con el path de creación para extraer valores de parámetros
2. Reemplaza cada {placeholder} con su valor correspondiente
3. Los placeholders que terminan en "Id" o "ID" deben usar el resourceId

EJEMPLOS:

Ejemplo 1:
- Template: "invoicing/v1/documents/{docType}/{documentId}"
- Creation: "invoicing/v1/documents/invoice"
- ID: "abc123"
→ Resultado: "invoicing/v1/documents/invoice/abc123"
  (docType=invoice extraído del creation path, documentId=abc123 del ID)

Ejemplo 2:
- Template: "invoicing/v1/products/{productType}/{productId}"
- Creation: "invoicing/v1/products/physical"
- ID: "xyz789"
→ Resultado: "invoicing/v1/products/physical/xyz789"
  (productType=physical, productId=xyz789)

Ejemplo 3:
- Template: "accounting/v1/accounts/{accountType}/{categoryId}/{accountId}"
- Creation: "accounting/v1/accounts/expense/12345"
- ID: "acc999"
→ Resultado: "accounting/v1/accounts/expense/12345/acc999"
  (accountType=expense, categoryId=12345, accountId=acc999)

IMPORTANTE:
- Responde ÚNICAMENTE con el path final construido
- Sin explicaciones, sin comillas, sin markdown
- Solo el path limpio`;

  try {
    const response = await model.invoke([
      { role: "user", content: prompt }
    ]);

    const constructedPath = response.content.toString().trim();

    // Validaciones básicas
    if (!constructedPath.includes(resourceId)) {
      return `${creationPath}/${resourceId}`;
    }

    if (constructedPath.includes('{') || constructedPath.includes('}')) {
      return `${creationPath}/${resourceId}`;
    }

    return constructedPath;

  } catch (error: any) {
    // Fallback simple
    return `${creationPath}/${resourceId}`;
  }
}
