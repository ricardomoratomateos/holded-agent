import { SSEWriter } from "../utils/sseWriter.js";

/**
 * Contexto compartido por todas las estrategias de chat
 */
export interface ChatStrategyContext {
  agent: any;
  config: any;
  writer: SSEWriter;
  message?: string;
  enableVerification?: boolean;
}

/**
 * Interface para las estrategias de chat
 */
export interface ChatStrategy {
  handle(context: ChatStrategyContext): Promise<void>;
}

/**
 * Factory que devuelve la estrategia correcta según el tipo de request
 */
export async function getChatStrategy(): Promise<ChatStrategy> {
  const { NormalMessageStrategy } = await import('./normalMessageStrategy.js');
  return new NormalMessageStrategy();
}
