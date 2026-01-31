import { ExecutionStep } from "./state.js";

/**
 * Wrapper para tools que registra automáticamente sus invocaciones
 */
export function withToolTracing(
  tool: any,
  agentName: string,
  stepsArray: ExecutionStep[]
) {
  return {
    ...tool,
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    invoke: async (args: any) => {
      const start = Date.now();

      try {
        const result = await tool.invoke(args);

        stepsArray.push({
          timestamp: Date.now(),
          agent: agentName,
          tool: tool.name,
          params: args,
          result: typeof result === 'string' ? result.substring(0, 1000) : JSON.stringify(result).substring(0, 1000), // Limitar tamaño
          duration: Date.now() - start,
          cacheHit: false // TODO: detectar cache hits
        });

        return result;
      } catch (error: any) {
        stepsArray.push({
          timestamp: Date.now(),
          agent: agentName,
          tool: tool.name,
          params: args,
          result: `ERROR: ${error.message}`,
          duration: Date.now() - start,
          cacheHit: false
        });

        throw error;
      }
    }
  };
}

/**
 * Wrapper para LLMs que registra sus invocaciones
 */
export function withLLMTracing(
  llm: any,
  agentName: string,
  modelName: string,
  stepsArray: ExecutionStep[]
) {
  const originalInvoke = llm.invoke.bind(llm);

  llm.invoke = async (messages: any) => {
    const start = Date.now();

    try {
      const result = await originalInvoke(messages);

      stepsArray.push({
        timestamp: Date.now(),
        agent: agentName,
        tool: `ChatOpenAI (${modelName})`,
        params: { messageCount: messages.length },
        result: typeof result.content === 'string' ? result.content.substring(0, 500) : 'non-string response',
        duration: Date.now() - start,
        cacheHit: false
      });

      return result;
    } catch (error: any) {
      stepsArray.push({
        timestamp: Date.now(),
        agent: agentName,
        tool: `ChatOpenAI (${modelName})`,
        params: { messageCount: messages.length },
        result: `ERROR: ${error.message}`,
        duration: Date.now() - start,
        cacheHit: false
      });

      throw error;
    }
  };

  return llm;
}
