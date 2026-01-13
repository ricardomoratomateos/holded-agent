import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";

import { createHoldedTool } from "../tools/holded.js";
import { analyzeDocumentTool } from "../tools/vision.js";
import { getResearcherTools } from "../tools/mcp.js";
import { getBrowserTools } from "../tools/playwright-mcp.js";
import { AgentState } from "./state.js";
import { HOLDED_AGENT_SYSTEM_PROMPT } from "./prompts.js";
import { checkpointer } from "../database/persistence.js";

export async function createAgent(holdedApiKey: string) {
    const holdedTool = createHoldedTool(holdedApiKey);
    const mcpRawTools = await getResearcherTools();
    const browserRawTools = await getBrowserTools();

    const formattedMcpTools = mcpRawTools.map(t => new DynamicTool({
        name: t.name,
        description: t.description ?? `Búsqueda`,
        func: async (args) => {
            const formattedArgs = typeof args === 'string' ? { query: args } : args;
            const result = await (t as any).execute(formattedArgs);
            return JSON.stringify(result);
        }
    }));

    const formattedBrowserTools = browserRawTools.map(t => new DynamicTool({
        name: t.name,
        description: t.description ?? `Automatización de navegador`,
        func: async (args) => {
            const result = await (t as any).execute(args);
            return JSON.stringify(result);
        }
    }));

    // --- LA CLAVE ESTÁ AQUÍ ---
    // Ambos nodos necesitan tener acceso a las herramientas,
    // pero el flujo decidirá por cuál pasar según el tipo de operación.
    const allTools = [holdedTool, analyzeDocumentTool, ...formattedMcpTools, ...formattedBrowserTools];

    const model = new ChatAnthropic({
        modelName: "claude-haiku-4-5",
        temperature: 0,
    }).bindTools(allTools);

    const workflow = new StateGraph(AgentState)
        .addNode("agent", async (state) => ({
            messages: [await model.invoke([HOLDED_AGENT_SYSTEM_PROMPT, ...state.messages])]
        }))
        .addNode("tools", new ToolNode(allTools))
        .addEdge(START, "agent")
        .addConditionalEdges("agent", (state: typeof AgentState.State) => {
            const lastMessage = state.messages.at(-1) as AIMessage;
            if (!lastMessage?.tool_calls?.length) return END;
            return "tools";
        })

        .addEdge("tools", "agent");

    return workflow.compile({ checkpointer });
}