import { HumanMessage } from "@langchain/core/messages";
import { ChatStrategy, ChatStrategyContext } from "./chatStrategy.js";
import { StreamProcessor } from "../services/streamProcessor.js";
import { AgentStateDetector } from "../services/agentStateDetector.js";
import fs from 'fs';
import path from 'path';

/**
 * MultipartStrategy - Maneja requests con archivos adjuntos (imágenes/PDFs)
 */
export class MultipartStrategy implements ChatStrategy {
  private streamProcessor = new StreamProcessor();

  async handle({ agent, config, writer, message }: ChatStrategyContext): Promise<void> {
    // Esta estrategia no se usa directamente desde getChatStrategy
    // Se llamará manualmente desde el server cuando detecte multipart

    // Por ahora, simplemente redirige a NormalMessageStrategy
    // La lógica de guardado de archivos se maneja en el server
    const { NormalMessageStrategy } = require('./normalMessageStrategy.js');
    const normalStrategy = new NormalMessageStrategy();
    await normalStrategy.handle({ agent, config, writer, message });
  }
}
