import type { AttachmentAdapter } from "@assistant-ui/react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3300";

interface HoldedAttachmentAdapterOptions {
  apiKey: string;
}

// Almacenamiento temporal de attachments pendientes de enviar
let pendingAttachments: any[] = [];

export function getPendingAttachments() {
  return pendingAttachments;
}

export function clearPendingAttachments() {
  pendingAttachments = [];
}

/**
 * AttachmentAdapter para subir archivos (imágenes y PDFs) al backend
 */
export function createHoldedAttachmentAdapter({
  apiKey,
}: HoldedAttachmentAdapterOptions): AttachmentAdapter {
  return {
    accept: "image/*,application/pdf",

    async add({ file }) {
      // Solo preparar el attachment sin subirlo aún
      // El archivo se enviará junto con el mensaje al endpoint /chat
      const attachment = {
        id: `attachment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: file.type.startsWith("image/") ? ("image" as const) : ("file" as const),
        name: file.name,
        contentType: file.type,
        file, // Guardamos el File object para enviarlo después
        content: file.type.startsWith("image/")
          ? [
              {
                type: "image" as const,
                image: URL.createObjectURL(file),
              },
            ]
          : [
              {
                type: "text" as const,
                text: `📎 ${file.name}`,
              },
            ],
        status: {
          type: "complete" as const,
        },
      };

      // Guardar en array temporal para que el runtime pueda acceder
      pendingAttachments.push(attachment);

      return attachment as any;
    },

    async send(attachment) {
      // Devolver el attachment con el file object preservado
      const result = {
        ...attachment,
        status: {
          type: "complete" as const,
        },
      };

      return result as any;
    },

    async remove(attachment) {
      // Limpiar la URL del blob si existe
      if (attachment.content) {
        attachment.content.forEach((content: any) => {
          if (content.type === "image" && content.image?.startsWith("blob:")) {
            URL.revokeObjectURL(content.image);
          }
        });
      }

      // Eliminar también del array temporal
      pendingAttachments = pendingAttachments.filter((a) => a.id !== attachment.id);
    },
  };
}
