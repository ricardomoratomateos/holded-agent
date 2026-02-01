import type { ChatModelAdapter, ChatModelRunResult } from "@assistant-ui/react";
import { getPendingAttachments, clearPendingAttachments } from "./attachmentAdapter";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3300";

interface HoldedRuntimeOptions {
  apiKey: string;
  threadId: string;
  enableVerification: boolean;
}

/**
 * Custom runtime adapter para nuestro backend SSE de Holded
 */
export function createHoldedAdapter({ apiKey, threadId, enableVerification }: HoldedRuntimeOptions): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      // Obtener el último mensaje del usuario
      const lastMessage = messages[messages.length - 1];
      const messageText = lastMessage.content.find((c) => c.type === "text")?.text || "";

      // Usar los attachments del array temporal en lugar de los del mensaje
      // porque assistant-ui limpia los attachments del mensaje antes de enviarlo
      const pendingAttachments = getPendingAttachments();

      const firstAttachment = pendingAttachments[0] as any;
      const hasFile = pendingAttachments.length > 0 && firstAttachment?.file;

      let response: Response;

      if (hasFile) {

        // Enviar multipart/form-data si hay archivo adjunto
        const formData = new FormData();
        formData.append("message", messageText || "Analiza el documento adjunto");
        formData.append("threadId", threadId);
        formData.append("holdedKey", apiKey);
        formData.append("enableVerification", String(enableVerification));
        formData.append("file", firstAttachment.file);

        response = await fetch(`${API_URL}/chat`, {
          method: "POST",
          body: formData,
          signal: abortSignal,
        });

        // Limpiar los attachments pendientes después de enviar
        clearPendingAttachments();
      } else {

        // Enviar JSON normal sin archivo
        response = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: messageText,
            threadId,
            holdedKey: apiKey,
            enableVerification,
          }),
          signal: abortSignal,
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Mostrar indicador de "pensando..." mientras espera la primera respuesta
      yield {
        content: [
          {
            type: "text" as const,
            text: "⏳ Procesando...",
          },
        ],
      } satisfies ChatModelRunResult;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let buffer = "";
      let accumulatedText = "";
      let hasReceivedContent = false;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          // Decodificar el chunk
          buffer += decoder.decode(value, { stream: true });

          // Procesar líneas completas de SSE
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Guardar línea incompleta

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));

                // Capturar steps (pasos del agente) - mostrar solo el actual
                if (data.type === "step" && data.step) {
                  yield {
                    content: [
                      {
                        type: "text" as const,
                        text: `__STEP__${data.step}`,
                      },
                    ],
                  } satisfies ChatModelRunResult;
                }

                // Acumular texto mientras streaming
                if (data.content && data.status === "streaming") {
                  hasReceivedContent = true;
                  accumulatedText += data.content;

                  yield {
                    content: [
                      {
                        type: "text" as const,
                        text: accumulatedText,
                      },
                    ],
                  } satisfies ChatModelRunResult;
                }

                // Manejar estado final
                if (data.final) {
                  hasReceivedContent = true;

                  // Si viene contenido con el estado final (ej: mensaje de error), usarlo
                  const finalText = data.content || accumulatedText || "Sin respuesta";

                  const finalStatus: ChatModelRunResult["status"] =
                    data.status === "pending_approval" ? { type: "requires-action", reason: "interrupt" } :
                    data.status === "error" ? { type: "incomplete", reason: "error" as const, error: data.content || data.error || "Unknown error" } :
                    { type: "complete" as const, reason: "stop" as const };

                  yield {
                    content: [
                      {
                        type: "text" as const,
                        text: finalText,
                      },
                    ],
                    status: finalStatus,
                  } satisfies ChatModelRunResult;
                }
              } catch (error) {
                console.error("Error parsing SSE data:", error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
