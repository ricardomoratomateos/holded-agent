import { ChatStrategy, ChatStrategyContext } from "./chatStrategy.js";
import { StreamProcessor } from "../services/streamProcessor.js";
import { AgentStateDetector } from "../services/agentStateDetector.js";

/**
 * ApproveStrategy - Maneja la aprobación de acciones sensibles
 */
export class ApproveStrategy implements ChatStrategy {
  private streamProcessor = new StreamProcessor();

  async handle({ agent, config, writer }: ChatStrategyContext): Promise<void> {
    // Aprobar: continuar ejecución pausada sin nuevo mensaje
    const stream = await agent.stream(null, { ...config, streamMode: "messages" });

    // Procesar el stream
    await this.streamProcessor.processStream(stream, writer);

    // Comprobar si se volvió a pausar (por si hay otra acción sensible)
    const isPaused = await AgentStateDetector.isPaused(agent, config);

    writer.write({
      status: isPaused ? "pending_approval" : "success",
      final: true
    });

    writer.end();
  }
}
