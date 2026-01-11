import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";

import { createHoldedTool } from "../tools/holded.js";
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
    const allTools = [holdedTool, ...formattedMcpTools, ...formattedBrowserTools];

    const model = new ChatAnthropic({
        modelName: "claude-haiku-4-5",
        temperature: 0,
    }).bindTools(allTools);

    const workflow = new StateGraph(AgentState)
        .addNode("agent", async (state) => ({
            messages: [await model.invoke([HOLDED_AGENT_SYSTEM_PROMPT, ...state.messages])]
        }))
        // Ambos nodos de herramientas pueden ejecutar holdedTool
        .addNode("safe_tools", new ToolNode(allTools))
        .addNode("sensitive_tools", new ToolNode(allTools))
        
        .addEdge(START, "agent")
        
        .addConditionalEdges("agent", (state: typeof AgentState.State) => {
            const lastMessage = state.messages.at(-1) as AIMessage;
            if (!lastMessage?.tool_calls?.length) return END;

            // Verificamos si hay alguna llamada a Holded que sea DELETE, PUT o POST (escritura)
            const hasSensitiveCall = lastMessage.tool_calls.some(call => {
                const args = call.args as any;
                const isHolded = call.name === "call_holded_api";
                const isWriteOp = ["DELETE", "PUT", "POST"].includes(args.method?.toUpperCase());
                return isHolded && isWriteOp;
            });

            return hasSensitiveCall ? "sensitive_tools" : "safe_tools";
        })
        
        .addEdge("safe_tools", "agent")
        .addEdge("sensitive_tools", "agent");

    return workflow.compile({ 
        checkpointer,
        interruptBefore: ["sensitive_tools"] 
    });
}