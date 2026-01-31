import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AgentState, ExecutionStep, ResourceContext } from "./state.js";
import { AIMessage } from "@langchain/core/messages";

/**
 * Wrapper del ToolNode que captura IDs de recursos creados/modificados
 * y enriquece el estado con información necesaria para verificación
 */
export function createEnrichedToolNode(tools: any[], agentName: string) {
  const baseToolNode = new ToolNode(tools);

  return async (state: typeof AgentState.State) => {
    const startTime = Date.now();

    // Obtener los tool calls que se van a ejecutar
    const lastAIMessage = state.messages.at(-1) as AIMessage;
    const toolCalls = lastAIMessage?.tool_calls || [];

    // Ejecutar tools normalmente
    const result = await baseToolNode.invoke(state);

    // Extraer información de los resultados
    const resourceId = extractResourceId(result.messages);
    const duration = Date.now() - startTime;

    // Registrar en execution trace
    const steps: ExecutionStep[] = toolCalls.map((tc, idx) => ({
      timestamp: Date.now(),
      agent: agentName,
      tool: tc.name,
      params: tc.args,
      result: result.messages[idx]?.content || '',
      duration: duration / toolCalls.length,
      cacheHit: false // TODO: Detectar cache hits
    }));

    // Extraer contexto de recurso si fue operación de escritura
    let resourceContext: ResourceContext | null = null;

    const writeToolCall = toolCalls.find((tc: any) => {
      const method = tc.args?.method?.toUpperCase();
      return tc.name === 'call_holded_api' && ['POST', 'PUT'].includes(method);
    });

    if (writeToolCall && resourceId) {
      const { method, path, data } = writeToolCall.args as any;

      resourceContext = {
        id: resourceId,
        type: inferResourceType(path),
        operation: method.toUpperCase() === 'POST' ? 'create' : 'update',
        originalIntent: data || {},
        apiResponse: result.messages[0] ? JSON.parse(result.messages[0].content || '{}') : {},
        path: path
      };
    }

    // Si hay plan activo, guardar resourceContext en planStepResults
    const planStepUpdate = (state.plan && state.currentStep < state.plan.length && resourceContext)
      ? { planStepResults: { [state.currentStep]: resourceContext } }
      : {};

    return {
      ...result,
      // Actualizar verification con el contexto del recurso
      verification: resourceContext ? {
        resourceContext,
        status: "pending" as const
      } : state.verification,
      // Añadir steps a la traza
      executionTrace: {
        steps,
        totalDuration: duration,
        toolCallsCount: toolCalls.length,
        errors: []
      },
      // Guardar en planStepResults si hay plan activo
      ...planStepUpdate
    };
  };
}

/**
 * Extraer ID del recurso de la respuesta de la API
 */
function extractResourceId(messages: any[]): string | null {
  try {
    if (!messages || messages.length === 0) return null;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage.content) return null;

    const parsed = JSON.parse(lastMessage.content);

    // Holded suele devolver { id: "...", ... } o { _id: "..." }
    return parsed.id || parsed._id || null;
  } catch {
    return null;
  }
}

/**
 * Inferir tipo de recurso del path
 */
function inferResourceType(path: string): ResourceContext['type'] {
  const lowerPath = path.toLowerCase();

  if (lowerPath.includes('contact')) return 'contact';
  if (lowerPath.includes('invoice')) return 'invoice';
  if (lowerPath.includes('product')) return 'product';
  if (lowerPath.includes('purchase')) return 'purchase';
  if (lowerPath.includes('payment')) return 'payment';
  if (lowerPath.includes('document')) return 'document';

  return 'document'; // Default
}
