import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { getAnalyticsAgentPrompt } from "../prompts/analytics.js";
import { AgentState, ExecutionStep } from "../state.js";
import { withLLMTracing } from "../tracing.js";

export function createAnalyticsAgentNode(tools: any[]) {
  // Array para acumular steps de este agente
  const steps: ExecutionStep[] = [];

  // Wrapear LLM con tracing
  const model = withLLMTracing(
    new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    }).bindTools(tools),
    "analytics_agent",
    "gpt-4o-mini",
    steps
  );

  return async (state: typeof AgentState.State) => {
    steps.length = 0; // Reset steps para esta ejecución

    // Extraer plan si existe
    const { plan } = state;

    // Si hay plan, inyectar como contexto completo
    let planContext = null;
    if (plan && plan.length > 0) {
      const planDescription = plan.map((step, idx) =>
        `${idx + 1}. ${step.description}`
      ).join('\n');

      planContext = new SystemMessage(`
📋 PLAN DE ANÁLISIS MULTI-PASO

Debes realizar los siguientes análisis en orden:

${planDescription}

IMPORTANTE:
- Ejecuta TODOS los análisis del plan en esta misma conversación
- Obtén datos reales de la API para cada análisis
- NO solo investigues cómo hacerlo, HAZLO (call_holded_api con GET)
- Al terminar TODOS los análisis, responde con un resumen completo de los hallazgos
      `.trim());
    }

    // Invocar con o sin planContext
    const messages = planContext
      ? [getAnalyticsAgentPrompt(), planContext, ...state.messages]
      : [getAnalyticsAgentPrompt(), ...state.messages];

    const response = await model.invoke(messages);

    return {
      messages: [response],
      executionTrace: {
        steps: steps
      }
    };
  };
}
