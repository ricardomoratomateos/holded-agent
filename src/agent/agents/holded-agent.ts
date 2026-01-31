import { ChatOpenAI } from "@langchain/openai";
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

    const response = await model.invoke([
      getHoldedAgentPrompt(),
      ...state.messages
    ]);

    return {
      messages: [response],
      executionTrace: {
        steps: steps
      }
    };
  };
}
