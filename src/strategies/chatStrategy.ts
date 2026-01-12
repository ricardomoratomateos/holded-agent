import { SSEWriter } from "../utils/sseWriter.js";

/**
 * Contexto compartido por todas las estrategias de chat
 */
export interface ChatStrategyContext {
  agent: any;
  config: any;
  writer: SSEWriter;
  message?: string;
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
export function getChatStrategy(action?: string, isMultipart?: boolean): ChatStrategy {
  // Importamos dinámicamente para evitar dependencias circulares
  if (action === 'approve') {
    const { ApproveStrategy } = require('./approveStrategy.js');
    return new ApproveStrategy();
  }

  if (action === 'reject') {
    const { RejectStrategy } = require('./rejectStrategy.js');
    return new RejectStrategy();
  }

  // TODO: añadir MultipartStrategy después
  // if (isMultipart) {
  //   const { MultipartStrategy } = require('./multipartStrategy.js');
  //   return new MultipartStrategy();
  // }

  const { NormalMessageStrategy } = require('./normalMessageStrategy.js');
  return new NormalMessageStrategy();
}
