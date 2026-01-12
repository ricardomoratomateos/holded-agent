import { SSEWriter } from "../utils/sseWriter.js";

/**
 * StreamProcessor - Procesa el stream de LangGraph y envía chunks por SSE
 */
export class StreamProcessor {
  async processStream(stream: any, writer: SSEWriter): Promise<void> {
    for await (const [msg, metadata] of stream) {
      const textContent = this.extractTextContent(msg);

      // Solo enviamos si hay texto y proviene del nodo del agente
      if (textContent && (metadata as any).langgraph_node === "agent") {
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
