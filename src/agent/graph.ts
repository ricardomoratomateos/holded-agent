import { StateGraph, START, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";

import { createHoldedTool } from "../tools/holded.js";
import { analyzeDocumentTool } from "../tools/vision.js";
import { getResearcherTools } from "../tools/mcp.js";
import { getBrowserTools } from "../tools/playwright-mcp.js";
import { createGetApiDocsTool } from "../tools/documentation.js";
import { getTimestampTool, getDateRangeTool, getLastNDaysTool } from "../tools/dates.js";
import { createValidateSchemaTool } from "../tools/validation.js";
import { checkpointer } from "../database/persistence.js";

import { AgentState } from "./state.js";
import { supervisorNode } from "./agents/supervisor.js";
import { createHoldedAgentNode } from "./agents/holded-agent.js";
import { createAnalyticsAgentNode } from "./agents/analytics-agent.js";
import { planningNode } from "./agents/planning-agent.js";
import { createVerificationNode } from "./agents/verification-agent.js";
import { analyzerNode } from "./agents/analyzer-agent.js";
import { createCorrectorNode } from "./agents/corrector-agent.js";

import { createEnrichedToolNode } from "./tool-interceptor.js";
import {
  afterSupervisor,
  afterPlanning,
  shouldVerify,
  afterVerification,
  afterAnalysis,
  afterCorrection,
} from "./edges.js";

import { judgeQueue } from "../evaluation/judge-queue.js";

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
  const braveSearchTool = mcpRawTools.find(t => t.name === 'brave_web_search');
  const apiDocsTool = braveSearchTool
    ? createGetApiDocsTool(braveSearchTool)
    : null;

  // Crear herramienta de validación de schemas
  const validateSchemaTool = apiDocsTool
    ? createValidateSchemaTool(apiDocsTool)
    : null;

  const commonTools = [...formattedMcpTools, ...formattedBrowserTools];
  const holdedAgentTools = [
    holdedTool,
    analyzeDocumentTool,
    getTimestampTool,
    getDateRangeTool,
    getLastNDaysTool,
    ...(apiDocsTool ? [apiDocsTool] : []),
    ...(validateSchemaTool ? [validateSchemaTool] : []),
    ...commonTools
  ];

  const analyticsAgentTools = [
    holdedToolReadOnly,
    getTimestampTool,
    getDateRangeTool,
    getLastNDaysTool,
    ...(apiDocsTool ? [apiDocsTool] : []),
    ...commonTools
  ];

  // Nodo para respuestas off-topic
  const offTopicNode = async () => ({
    messages: [new AIMessage("Soy un asistente especializado en Holded. Puedo ayudarte con facturas, contactos, productos, contabilidad y gestión empresarial. ¿En qué puedo ayudarte?")]
  });

  // 2. Crear Grafo
  const workflow = new StateGraph(AgentState)
    // Nodos existentes
    .addNode("supervisor", supervisorNode)
    .addNode("holded_agent", createHoldedAgentNode(holdedAgentTools))
    .addNode("analytics_agent", createAnalyticsAgentNode(analyticsAgentTools))
    .addNode("off_topic", offTopicNode)

    // NUEVOS NODOS - Sistema de planificación, verificación y corrección
    .addNode("planning_agent", planningNode)
    .addNode("verification_agent", createVerificationNode(holdedTool, apiDocsTool))
    .addNode("analyzer_agent", analyzerNode)
    .addNode("corrector_agent", createCorrectorNode(holdedTool))

    // Nodos de herramientas con interceptor (captura IDs de recursos)
    .addNode("holded_tools", createEnrichedToolNode(holdedAgentTools, "holded_agent"))
    .addNode("analytics_tools", createEnrichedToolNode(analyticsAgentTools, "analytics_agent"));

  // 3. Definir Aristas - NUEVO FLUJO COMPLETO
  workflow.addEdge(START, "supervisor");

  // Supervisor decide: planning_agent, holded_agent, analytics_agent, o off_topic
  workflow.addConditionalEdges("supervisor", afterSupervisor);

  // Off-topic termina
  workflow.addEdge("off_topic", END);

  // Planning Agent → holded_agent o analytics_agent (decide según el plan)
  workflow.addConditionalEdges("planning_agent", afterPlanning);

  // Agentes ejecutores → Tools directamente (validación ahora es una herramienta)
  workflow.addConditionalEdges("holded_agent", (state) => {
    const lastMessage = state.messages.at(-1) as AIMessage;
    if (lastMessage?.tool_calls && (lastMessage.tool_calls as any[]).length > 0) {
      return "holded_tools";
    }

    // No hay más tool_calls - terminar
    return END;
  });

  workflow.addConditionalEdges("analytics_agent", (state) => {
    const lastMessage = state.messages.at(-1) as AIMessage;
    if (lastMessage?.tool_calls && (lastMessage.tool_calls as any[]).length > 0) {
      return "analytics_tools";
    }

    // No hay más tool_calls - terminar
    return END;
  });

  // Tools → Verification (si hubo escritura) o volver al agente
  workflow.addConditionalEdges("holded_tools", shouldVerify);
  workflow.addConditionalEdges("analytics_tools", shouldVerify);

  // Verification → Analyzer (si falló) o agente (si OK o max intentos)
  workflow.addConditionalEdges("verification_agent", afterVerification);

  // Analyzer → Corrector
  workflow.addEdge("analyzer_agent", "corrector_agent");

  // Corrector → Verification (re-verificar después de corregir)
  workflow.addEdge("corrector_agent", "verification_agent");

  // 4. Compilar
  const compiled = workflow.compile({ checkpointer });

  // 5. Wrapper para enviar trazas al Judge (async, no bloqueante)
  const originalInvoke = compiled.invoke.bind(compiled);
  (compiled as any).invoke = async function(input: any, config?: any) {
    const result = await originalInvoke(input, config);

    // Enviar traza al Judge en background
    if (result.executionTrace && config?.configurable?.thread_id) {
      judgeQueue.enqueue(config.configurable.thread_id, {
        plan: result.plan,
        reflection: result.reflection,
        executionTrace: result.executionTrace,
        verification: result.verification,
      });
    }

    return result;
  };

  return compiled;
}
