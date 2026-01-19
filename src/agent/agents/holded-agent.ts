import { ChatOpenAI } from "@langchain/openai";
import { getHoldedAgentPrompt } from "../prompts/holded.js";
import { AgentState } from "../state.js";

export function createHoldedAgentNode(tools: any[]) {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  }).bindTools(tools);

  return async (state: typeof AgentState.State) => {
    const response = await model.invoke([
      getHoldedAgentPrompt(),
      ...state.messages
    ]);

    return {
      messages: [response]
    };
  };
}
