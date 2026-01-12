import { HumanMessage } from "@langchain/core/messages";
import { ChatStrategy, ChatStrategyContext } from "./chatStrategy.js";
import { StreamProcessor } from "../services/streamProcessor.js";
import { AgentStateDetector } from "../services/agentStateDetector.js";

/**
 * NormalMessageStrategy - Maneja mensajes nuevos del usuario
 */
export class NormalMessageStrategy implements ChatStrategy {
  private streamProcessor = new StreamProcessor();

  async handle({ agent, config, writer, message }: ChatStrategyContext): Promise<void> {
    // Validar que hay mensaje
    if (!message) {
      writer.write({
        content: "Mensaje vacío.",
        status: "error",
        final: true
      });
      writer.end();
      return;
    }

    // Crear stream con el mensaje del usuario
    const stream = await agent.stream({
      messages: [new HumanMessage(message)]
    }, { ...config, streamMode: "messages" });

    // Procesar el stream
    await this.streamProcessor.processStream(stream, writer);

    // Comprobar si LangGraph se detuvo por una acción sensible
    const isPaused = await AgentStateDetector.isPaused(agent, config);

    writer.write({
      status: isPaused ? "pending_approval" : "success",
      final: true
    });

    writer.end();
  }
}
