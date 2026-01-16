import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";

import { createHoldedTool } from "../tools/holded.js";
import { analyzeDocumentTool } from "../tools/vision.js";
import { getResearcherTools } from "../tools/mcp.js";
import { getBrowserTools } from "../tools/playwright-mcp.js";
import { createGetApiDocsTool } from "../tools/documentation.js";
import { checkpointer } from "../database/persistence.js";

import { AgentState } from "./state.js";
import { supervisorNode } from "./agents/supervisor.js";
import { createHoldedAgentNode } from "./agents/holded-agent.js";
import { createAnalyticsAgentNode } from "./agents/analytics-agent.js";

export async function createAgent(holdedApiKey: string) {
  // 1. Preparar herramientas
  const holdedTool = createHoldedTool(holdedApiKey);
  const holdedToolReadOnly = createHoldedTool(holdedApiKey, { readOnly: true });
  
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

  // Crear tool de documentación (solo necesita brave_search para buscar, luego usa fetch)
  console.log('🔍 MCP Tools disponibles:', mcpRawTools.map(t => t.name));
  console.log('🌐 Browser Tools disponibles:', browserRawTools.map(t => t.name));

  const braveSearchTool = mcpRawTools.find(t => t.name === 'brave_web_search');
  console.log('📚 brave_web_search encontrado:', !!braveSearchTool);

  const apiDocsTool = braveSearchTool
    ? createGetApiDocsTool(braveSearchTool)
    : null;
  console.log('✅ get_api_documentation creada:', !!apiDocsTool);

  const commonTools = [...formattedMcpTools, ...formattedBrowserTools];
  const holdedAgentTools = [
    holdedTool,
    analyzeDocumentTool,
    ...(apiDocsTool ? [apiDocsTool] : []),
    ...commonTools
  ];
  console.log('🛠️  Tools del holded_agent:', holdedAgentTools.map(t => t.name));

  const analyticsAgentTools = [holdedToolReadOnly, ...commonTools];

  // 2. Crear Grafo
  const workflow = new StateGraph(AgentState)
    .addNode("supervisor", supervisorNode)
    .addNode("holded_agent", createHoldedAgentNode(holdedAgentTools))
    .addNode("analytics_agent", createAnalyticsAgentNode(analyticsAgentTools))
    
    // Nodos de herramientas
    .addNode("holded_tools", new ToolNode(holdedAgentTools))
    .addNode("analytics_tools", new ToolNode(analyticsAgentTools));

  // 3. Definir Aristas
  workflow.addEdge(START, "supervisor");

  // Supervisor decide a dónde ir
  workflow.addConditionalEdges("supervisor", (state) => {
    const next = state.next?.toLowerCase();
    // Si el supervisor alucina o devuelve algo raro, END.
    if (!next || next.includes("finish") || !["holded_agent", "analytics_agent", "FINISH"].includes(next)) {
        return END;
    }
    return next;
  });

  // Lógica de salida de Holded Agent
  workflow.addConditionalEdges("holded_agent", (state) => {
    const lastMessage = state.messages.at(-1) as AIMessage;
    if (lastMessage?.tool_calls?.length > 0) return "holded_tools";

    return END;
  });

  // Lógica de salida de Analytics Agent
  workflow.addConditionalEdges("analytics_agent", (state) => {
    const lastMessage = state.messages.at(-1) as AIMessage;
    if (lastMessage?.tool_calls?.length > 0) return "analytics_tools";

    return END;
  });

  // Retorno de herramientas a sus agentes
  workflow.addEdge("holded_tools", "holded_agent");
  workflow.addEdge("analytics_tools", "analytics_agent");

  // 4. Compilar sin interrupciones (aprobación verbal en prompts)
  return workflow.compile({ checkpointer });
}
