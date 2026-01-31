import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { getHoldedAgentPrompt } from "../prompts/holded.js";
import { AgentState, ExecutionStep } from "../state.js";
import { withLLMTracing } from "../tracing.js";

export function createHoldedAgentNode(tools: any[]) {
  // Array para acumular steps de este agente
  const steps: ExecutionStep[] = [];

  // Wrapear LLM con tracing
  const model = withLLMTracing(
    new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    }).bindTools(tools),
    "holded_agent",
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
📋 PLAN DE EJECUCIÓN MULTI-PASO

Debes ejecutar las siguientes acciones en orden:

${planDescription}

IMPORTANTE:
- Ejecuta TODAS las acciones del plan en esta misma conversación
- NO pidas confirmación entre pasos (el plan ya está aprobado)
- Para cada acción: consulta docs si necesitas → valida → ejecuta
- Cada operación debe completarse realmente (POST/PUT/DELETE/GET según corresponda)
- Al terminar TODAS las acciones, responde con un resumen de lo realizado
      `.trim());
    }

    // Invocar con o sin planContext
    const messages = planContext
      ? [getHoldedAgentPrompt(), planContext, ...state.messages]
      : [getHoldedAgentPrompt(), ...state.messages];

    const response = await model.invoke(messages);

    return {
      messages: [response],
      executionTrace: {
        steps: steps
      }
    };
  };
}
