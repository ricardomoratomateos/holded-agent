import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getSupervisorPrompt } from "../prompts/supervisor.js";
import { AgentState, ExecutionStep } from "../state.js";
import { withLLMTracing } from "../tracing.js";

// Array para acumular steps de este agente
const steps: ExecutionStep[] = [];

// Wrapear LLM con tracing
const supervisorModel = withLLMTracing(
  new ChatAnthropic({
    modelName: "claude-haiku-4-5",
    temperature: 0,
  }),
  "supervisor",
  "claude-haiku-4-5",
  steps
);

const validResponses = ["planning_agent", "holded_agent", "analytics_agent", "off_topic"];

export async function supervisorNode(state: typeof AgentState.State) {
  steps.length = 0; // Reset steps para esta ejecución

  // Transformamos el historial para que sea legible y válido para Claude
  const simplifiedHistory = state.messages.map(m => {
    const type = m._getType();

    // Si es un mensaje de herramienta o una llamada a herramienta,
    // lo convertimos a un mensaje de texto simple.
    if (type === "tool") {
      return new HumanMessage(`[Resultado de herramienta: ${m.content}]`);
    }
    if (type === "ai" && (m as AIMessage).tool_calls?.length > 0) {
      const actions = (m as AIMessage).tool_calls.map(tc => tc.name).join(", ");
      return new HumanMessage(`[El agente intentó usar: ${actions}]`);
    }
    return m;
  }).slice(-6); // Tomamos los últimos 6 para mantener contexto

  try {
    const response = await supervisorModel.invoke([
      getSupervisorPrompt(),
      ...simplifiedHistory,
    ]);

    let next = response.content.toString().trim().toLowerCase();

    // Si no es una respuesta válida, usar holded_agent por defecto
    if (!validResponses.includes(next)) {
      next = "holded_agent";
    }

    // Si el supervisor decide NO usar planning_agent, limpiar cualquier plan residual
    const clearPlan = next !== "planning_agent" ? {
      plan: null,
      currentStep: 0,
      stepStatus: {},
      planStepResults: {}
    } : {};

    return {
      next,
      ...clearPlan,
      executionTrace: {
        steps: steps
      }
    };
  } catch (error) {
    console.error("Error crítico en Supervisor:", error);
    return {
      next: "holded_agent",
      executionTrace: {
        steps: steps,
        errors: ["Supervisor error"]
      }
    }; // Si falla, holded_agent responde
  }
}