import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { createHoldedAdapter } from "../lib/holdedRuntime";
import { createHoldedAttachmentAdapter } from "../lib/attachmentAdapter";
import { loadHistoryFromBackend } from "../lib/historyAdapter";
import { useMemo, useState, useEffect } from "react";
import { Thread } from "./ui/assistant-ui/thread";

interface AssistantChatProps {
  apiKey: string;
  threadId: string;
}

export function AssistantChat({ apiKey, threadId }: AssistantChatProps) {
  const [initialMessages, setInitialMessages] = useState<any[] | null>(null);

  // Cargar historial inicial
  useEffect(() => {
    const loadHistory = async () => {
      const history = await loadHistoryFromBackend(threadId, apiKey);
      setInitialMessages(history);
    };

    loadHistory();
  }, [apiKey, threadId]);

  // Crear adapters memoizados
  const adapter = useMemo(
    () => createHoldedAdapter({ apiKey, threadId }),
    [apiKey, threadId]
  );

  const attachmentAdapter = useMemo(
    () => createHoldedAttachmentAdapter({ apiKey }),
    [apiKey]
  );

  // Crear runtime con soporte para attachments
  const runtime = useLocalRuntime(adapter, {
    adapters: {
      attachments: attachmentAdapter,
    },
  });

  // Nota: LocalRuntime no soporta nativamente cargar historial inicial
  // El historial se carga desde el backend en cada interacción

  // Mostrar loading mientras carga el historial
  if (initialMessages === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-500">Cargando historial...</div>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
