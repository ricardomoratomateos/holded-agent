import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { createHoldedAdapter } from "../lib/holdedRuntime";
import { createHoldedAttachmentAdapter } from "../lib/attachmentAdapter";
import { loadHistoryFromBackend } from "../lib/historyAdapter";
import { useMemo, useState, useEffect } from "react";
import { Thread } from "./ui/assistant-ui/thread";

interface AssistantChatProps {
  apiKey: string;
  threadId: string;
  enableVerification: boolean;
}

export function AssistantChat({ apiKey, threadId, enableVerification }: AssistantChatProps) {
  const [initialMessages, setInitialMessages] = useState<any[] | null>(null);

  // Cargar historial inicial antes de crear el runtime
  useEffect(() => {
    const loadHistory = async () => {
      const history = await loadHistoryFromBackend(threadId, apiKey);
      setInitialMessages(history || []);
    };

    loadHistory();
  }, [apiKey, threadId]);

  // Mostrar loading mientras carga el historial
  if (initialMessages === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-500">Cargando historial...</div>
      </div>
    );
  }

  // Solo renderizar el chat cuando ya tenemos el historial
  return <AssistantChatContent apiKey={apiKey} threadId={threadId} enableVerification={enableVerification} initialMessages={initialMessages} />;
}

function AssistantChatContent({ apiKey, threadId, enableVerification, initialMessages }: AssistantChatProps & { initialMessages: any[] }) {
  // Crear adapters memoizados
  const adapter = useMemo(
    () => createHoldedAdapter({ apiKey, threadId, enableVerification }),
    [apiKey, threadId, enableVerification]
  );

  const attachmentAdapter = useMemo(
    () => createHoldedAttachmentAdapter({ apiKey }),
    [apiKey]
  );

  // Crear runtime con soporte para attachments e historial inicial
  const runtime = useLocalRuntime(adapter, {
    adapters: {
      attachments: attachmentAdapter,
    },
    initialMessages,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
