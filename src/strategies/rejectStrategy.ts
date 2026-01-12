import { AIMessage } from "@langchain/core/messages";
import { ChatStrategy, ChatStrategyContext } from "./chatStrategy.js";

/**
 * RejectStrategy - Maneja el rechazo de acciones sensibles
 */
export class RejectStrategy implements ChatStrategy {
  async handle({ agent, config, writer }: ChatStrategyContext): Promise<void> {
    // Rechazar: actualizar estado con mensaje de cancelación
    await agent.updateState(config, {
      messages: [new AIMessage("Acción cancelada.")]
    });

    // Enviar mensaje de confirmación y cerrar
    writer.write({
      content: "Acción cancelada.",
      status: "success",
      final: true
    });

    writer.end();
  }
}
