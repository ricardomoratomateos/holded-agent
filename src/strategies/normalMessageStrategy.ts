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

    try {
      // Crear stream con el mensaje del usuario
      const stream = await agent.stream({
        messages: [new HumanMessage(message)]
      }, { ...config, streamMode: "messages" });

      // Procesar el stream
      await this.streamProcessor.processStream(stream, writer);

      // Finalizar con éxito
      writer.write({
        status: "success",
        final: true
      });
    } catch (error: any) {
      console.error("Error en el agente:", error);

      // Detectar error de recursion limit
      const isRecursionError = error.message?.includes("Recursion limit") ||
                               error.message?.includes("recursion");

      const errorMessage = isRecursionError
        ? "El agente alcanzó el límite de operaciones. Por favor, intenta simplificar tu petición o sé más específico."
        : `Error: ${error.message || "Error desconocido"}`;

      writer.write({
        content: errorMessage,
        status: "error",
        final: true
      });
    }

    writer.end();
  }
}
