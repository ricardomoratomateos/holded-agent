import { SSEWriter } from "../utils/sseWriter.js";

/**
 * StreamProcessor - Procesa el stream de LangGraph y envía chunks por SSE
 */
export class StreamProcessor {
  async processStream(stream: any, writer: SSEWriter): Promise<void> {
    for await (const [msg, metadata] of stream) {
      const textContent = this.extractTextContent(msg);

      // Solo enviamos si hay texto
      // Excluimos explícitamente el supervisor si llegara a emitir algo técnico, 
      // pero permitimos cualquier otro nodo que genere contenido para el usuario.
      const nodeName = (metadata as any).langgraph_node || "";
      const isInternalNode = nodeName === "supervisor" || nodeName.includes("tools");

      if (textContent && !isInternalNode) {
        writer.write({
          content: textContent,
          status: "streaming"
        });
      }
    }
  }

  private extractTextContent(msg: any): string {
    const content = msg.content;

    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join("");
    }

    return "";
  }
}
