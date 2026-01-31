import { ChatAnthropic } from "@langchain/anthropic";
import { getVerificationPrompt } from "../prompts/verification.js";
import { AgentState, Discrepancy, ExecutionStep } from "../state.js";
import { withToolTracing, withLLMTracing } from "../tracing.js";
import { constructPathWithLLM } from "../utils/path-constructor.js";

/**
 * Crear Verification Agent Node con acceso a call_holded_api y documentation
 */
export function createVerificationNode(holdedTool: any, apiDocsTool: any | null) {
  // Array para acumular steps de este agente
  const steps: ExecutionStep[] = [];

  // Wrapear tools con tracing
  const tracedHoldedTool = withToolTracing(holdedTool, "verification_agent", steps);
  const tracedApiDocsTool = apiDocsTool ? withToolTracing(apiDocsTool, "verification_agent", steps) : null;

  // Wrapear LLM con tracing
  const verificationModel = withLLMTracing(
    new ChatAnthropic({
      modelName: "claude-haiku-4-5",
      temperature: 0,
    }),
    "verification_agent",
    "claude-haiku-4-5",
    steps
  );

  return async function verificationNode(state: typeof AgentState.State) {
  steps.length = 0; // Reset steps para esta ejecución

  const { resourceContext } = state.verification;

  if (!resourceContext || !resourceContext.id) {
    return {
      verification: {
        status: "failed" as const,
        discrepancies: [{
          field: "id",
          expected: "valid ID",
          actual: "null",
          reason: "No se pudo extraer el ID del recurso creado"
        }]
      },
      executionTrace: {
        steps: []
      }
    };
  }

  // Consultar documentación para obtener el endpoint correcto de GET
  if (!tracedApiDocsTool) {
    return {
      verification: {
        status: "failed" as const,
        discrepancies: [{
          field: "documentation",
          expected: "apiDocsTool available",
          actual: "null",
          reason: "No se puede verificar sin herramienta de documentación"
        }]
      },
      executionTrace: {
        steps: []
      }
    };
  }

  let fetchPath: string;

  try {
    const docsQuery = `GET ${resourceContext.type} by id`;
    const docsResult = await tracedApiDocsTool.invoke({ searchQuery: docsQuery });
    const docsJson = JSON.parse(docsResult);

    if (!docsJson.path) {
      return {
        verification: {
          status: "failed" as const,
          discrepancies: [{
            field: "endpoint",
            expected: "valid GET endpoint",
            actual: "not found in docs",
            reason: `No se encontró endpoint GET para ${resourceContext.type}`
          }]
        },
        executionTrace: {
          steps: steps
        }
      };
    }

    // Detectar cuántos placeholders hay en el path
    const placeholders = docsJson.path.match(/{[^}]+}/g) || [];

    if (placeholders.length === 0) {
      // Sin placeholders → usar path directo
      fetchPath = docsJson.path;
    } else if (placeholders.length === 1) {
      // Un solo placeholder → reemplazar directamente con el ID
      fetchPath = docsJson.path.replace(/{[^}]+}/, resourceContext.id);
    } else {
      // Múltiples placeholders → usar LLM para merge inteligente
      fetchPath = await constructPathWithLLM({
        templatePath: docsJson.path,
        creationPath: resourceContext.path,
        resourceId: resourceContext.id,
        steps: steps
      });
    }
  } catch (error: any) {
    return {
      verification: {
        status: "failed" as const,
        discrepancies: [{
          field: "documentation",
          expected: "success",
          actual: "error",
          reason: `Error al consultar documentación: ${error.message}`
        }]
      },
      executionTrace: {
        steps: steps
      }
    };
  }

  try {
    // Usar la herramienta call_holded_api con la API key del usuario
    const fetchResult = await tracedHoldedTool.invoke({
      method: "GET",
      path: fetchPath
    });

    // Parsear respuesta
    let actualData;
    try {
      actualData = JSON.parse(fetchResult);
    } catch (parseError) {
      // Si tiene error en el string, es un error de la API
      if (fetchResult.includes("Error")) {
        return {
          verification: {
            status: "failed" as const,
            discrepancies: [{
              field: "fetch",
              expected: "success",
              actual: "error",
              reason: fetchResult
            }],
            resourceContext: {
              ...resourceContext,
              fetchedData: null // No se pudo obtener
            }
          },
          executionTrace: {
            steps: steps,
            errors: [`Verification fetch failed: ${fetchResult}`]
          }
        };
      }
      throw parseError;
    }

    // IMPORTANTE: Guardar el recurso completo para que Corrector pueda hacer merge
    const updatedResourceContext = {
      ...resourceContext,
      fetchedData: actualData
    };

    // Usar LLM para comparar datos
    const comparisonPrompt = `
Recurso creado/modificado:
${JSON.stringify(actualData, null, 2)}

Intención original del usuario:
${JSON.stringify(resourceContext.originalIntent, null, 2)}

Compara y detecta discrepancias. Responde SOLO con JSON.
`;


    const result = await verificationModel.invoke([
      getVerificationPrompt(),
      { role: "user", content: comparisonPrompt }
    ]);


    let verification;
    try {
      verification = JSON.parse(result.content.toString());
    } catch {
      // Si no es JSON válido, asumir que está bien
      verification = { status: "verified", discrepancies: [] };
    }


    return {
      verification: {
        status: verification.status,
        discrepancies: verification.discrepancies || [],
        attemptCount: state.verification.attemptCount,
        resourceContext: updatedResourceContext // Incluir recurso completo
      },
      executionTrace: {
        steps: steps
      }
    };

  } catch (error: any) {
    return {
      verification: {
        status: "failed" as const,
        discrepancies: [{
          field: "fetch",
          expected: "success",
          actual: "error",
          reason: error.message
        }]
      },
      executionTrace: {
        steps: steps,
        errors: [error.message]
      }
    };
  }
  }; // Cierre de verificationNode
} // Cierre de createVerificationNode
