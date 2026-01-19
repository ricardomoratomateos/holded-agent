import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getSupervisorPrompt } from "../prompts/supervisor.js";
import { AgentState } from "../state.js";

const supervisorModel = new ChatAnthropic({
  modelName: "claude-haiku-4-5",
  temperature: 0,
});

const validAgents = ["holded_agent", "analytics_agent"];

export async function supervisorNode(state: typeof AgentState.State) {
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

    // Si no es un agente válido, usar holded_agent por defecto
    if (!validAgents.includes(next)) {
      next = "holded_agent";
    }

    return { next };
  } catch (error) {
    console.error("Error crítico en Supervisor:", error);
    return { next: "holded_agent" }; // Si falla, holded_agent responde
  }
}