import { AgentState, ExecutionStep } from "../state.js";
import { withToolTracing } from "../tracing.js";

/**
 * Corrector Node (sin LLM)
 * Hace merge del recurso completo + correcciones y ejecuta PUT
 */
export function createCorrectorNode(holdedTool: any) {
  // Array para acumular steps de este nodo
  const steps: ExecutionStep[] = [];

  // Wrapear tool con tracing
  const tracedHoldedTool = withToolTracing(holdedTool, "corrector_node", steps);

  return async (state: typeof AgentState.State) => {
    steps.length = 0; // Reset steps para esta ejecución

    const { resourceContext, analysis } = state.verification as any;

    // Validaciones
    if (!analysis || !resourceContext) {
      return {
        executionTrace: {
          steps: steps,
          errors: ["Corrector no tiene análisis o contexto de recurso"]
        },
        verification: {
          attemptCount: state.verification.attemptCount + 1
        }
      };
    }

    if (!resourceContext.fetchedData) {
      return {
        executionTrace: {
          steps: steps,
          errors: ["Corrector no tiene los datos completos del recurso. Verification debería haberlos guardado."]
        },
        verification: {
          attemptCount: state.verification.attemptCount + 1
        }
      };
    }

    try {
      // MERGE: Recurso completo + correcciones
      const mergedData = {
        ...resourceContext.fetchedData,
        ...analysis.fixData
      };

      // Ejecutar PUT directamente
      const result = await tracedHoldedTool.invoke({
        method: "PUT",
        path: `${resourceContext.path}/${resourceContext.id}`,
        data: mergedData
      });

      // Verificar si fue exitoso
      if (result.includes("Error")) {
        return {
          executionTrace: {
            steps: steps,
            errors: [`Corrector PUT failed: ${result}`]
          },
          verification: {
            attemptCount: state.verification.attemptCount + 1
          }
        };
      }

      // Éxito - incrementar contador de intentos
      return {
        verification: {
          attemptCount: state.verification.attemptCount + 1
        },
        executionTrace: {
          steps: steps
        }
      };

    } catch (error: any) {
      return {
        executionTrace: {
          steps: steps,
          errors: [`Corrector error: ${error.message}`]
        },
        verification: {
          attemptCount: state.verification.attemptCount + 1
        }
      };
    }
  };
}
