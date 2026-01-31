import { SSEWriter } from "../utils/sseWriter.js";

// Mapeo de herramientas a mensajes amigables
const TOOL_FRIENDLY_NAMES: Record<string, string> = {
  call_holded_api: "Llamando a Holded...",
  analyze_document: "Analizando documento...",
  brave_web_search: "Buscando información...",
  get_api_documentation: "Consultando documentación...",
  browser_navigate: "Navegando...",
  browser_snapshot: "Capturando página...",
};

/**
 * StreamProcessor - Procesa el stream de LangGraph y envía chunks por SSE
 */
export class StreamProcessor {
  async processStream(stream: any, writer: SSEWriter): Promise<void> {
    for await (const [msg, metadata] of stream) {
      const nodeName = (metadata as any).langgraph_node || "";

      // Detectar llamadas a herramientas y enviar step
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          const friendlyName = TOOL_FRIENDLY_NAMES[toolCall.name] || `Procesando...`;
          writer.write({
            type: "step",
            step: friendlyName,
            status: "streaming"
          });
        }
      }

      const textContent = this.extractTextContent(msg);

      // Solo enviamos si hay texto y no es un nodo interno
      const isInternalNode =
        nodeName === "supervisor" ||
        nodeName.includes("tools") ||
        nodeName === "planning_agent" ||
        nodeName === "reflection_agent" ||
        nodeName === "verification_agent" ||
        nodeName === "analyzer_agent" ||
        nodeName === "corrector_agent";

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
