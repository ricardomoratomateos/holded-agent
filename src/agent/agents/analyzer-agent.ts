import { ChatOpenAI } from "@langchain/openai";
import { getAnalyzerPrompt } from "../prompts/analyzer.js";
import { AgentState, ExecutionStep } from "../state.js";
import { withLLMTracing } from "../tracing.js";

// Array para acumular steps de este agente
const steps: ExecutionStep[] = [];

// Wrapear LLM con tracing
const analyzerModel = withLLMTracing(
  new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  }),
  "analyzer_agent",
  "gpt-4o-mini",
  steps
);

/**
 * Analyzer Agent
 * Analiza discrepancias y propone soluciones
 */
export async function analyzerNode(state: typeof AgentState.State) {
  steps.length = 0; // Reset steps para esta ejecución

  const { discrepancies, resourceContext } = state.verification;

  if (!discrepancies || discrepancies.length === 0) {
    // No hay discrepancias, no hay nada que analizar
    return {};
  }

  const analysisPrompt = `
Discrepancias detectadas:
${JSON.stringify(discrepancies, null, 2)}

Recurso: ${resourceContext?.type} (ID: ${resourceContext?.id})
Path: ${resourceContext?.path}

Intención original:
${JSON.stringify(resourceContext?.originalIntent, null, 2)}

Analiza la causa raíz y propón una solución. Responde SOLO con JSON.
`;

  try {
    const result = await analyzerModel.invoke([
      getAnalyzerPrompt(),
      { role: "user", content: analysisPrompt }
    ]);

    let analysis;
    try {
      analysis = JSON.parse(result.content.toString());
    } catch {
      // Si no es JSON válido, retornar error
      return {
        executionTrace: {
          steps: steps,
          errors: ["Analyzer no pudo generar análisis válido"]
        }
      };
    }

    // Guardar el análisis en el estado para que Corrector lo use
    return {
      verification: {
        analysis: analysis // Añadimos el análisis al estado
      },
      executionTrace: {
        steps: steps
      }
    };

  } catch (error: any) {
    return {
      executionTrace: {
        steps: steps,
        errors: [`Analyzer error: ${error.message}`]
      }
    };
  }
}
