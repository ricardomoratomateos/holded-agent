import { ChatOpenAI } from "@langchain/openai";
import { getAnalyticsAgentPrompt } from "../prompts/analytics.js";
import { AgentState } from "../state.js";

export function createAnalyticsAgentNode(tools: any[]) {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  }).bindTools(tools);

  return async (state: typeof AgentState.State) => {
    const response = await model.invoke([
      getAnalyticsAgentPrompt(),
      ...state.messages
    ]);

    return {
      messages: [response]
    };
  };
}
