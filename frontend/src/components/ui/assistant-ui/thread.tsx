import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposer,
  useThreadRuntime,
} from "@assistant-ui/react";
import { CheckIcon, CopyIcon, RefreshCwIcon, ArrowUpIcon, ArrowDownIcon, Square, Paperclip, X } from "lucide-react";
import type { FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-gray-50">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4">
        <ThreadPrimitive.Empty>
          <ThreadWelcome />
        </ThreadPrimitive.Empty>

        <div className="max-w-4xl mx-auto">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </div>

        <div className="h-24" />
      </ThreadPrimitive.Viewport>

      <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <ThreadScrollToBottom />
          <Composer />
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        Asistente de Holded
      </h2>
      <p className="text-gray-600">
        Puedo ayudarte a consultar y gestionar tu cuenta de Holded.
      </p>
      <p className="text-sm text-gray-500 mt-2">
        También puedes adjuntar facturas o imágenes para analizarlas.
      </p>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <button className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-full bg-white p-3 shadow-md hover:bg-gray-100 disabled:hidden">
        <ArrowDownIcon className="size-4" />
      </button>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const AttachmentPreview: FC = () => {
  return (
    <ComposerPrimitive.If hasAttachments>
      <AttachmentList />
    </ComposerPrimitive.If>
  );
};

const AttachmentList: FC = () => {
  const composer = useComposer();
  const runtime = useThreadRuntime();

  // Leer attachments directamente sin memoizar
  const attachments = composer.attachments || [];

  const handleRemove = async (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const threadComposer = (runtime as any).composer;

    if (threadComposer && threadComposer.clearAttachments && threadComposer.addAttachment) {
      const filestoKeep = attachments
        .filter((_, i) => i !== index)
        .map((att: any) => att.file)
        .filter(Boolean);

      threadComposer.clearAttachments();

      for (const file of filestoKeep) {
        await threadComposer.addAttachment(file);
      }
    }
  };

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((attachment: any, index: number) => (
        <div key={attachment.id || index} className="relative inline-flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-300 shadow-sm group">
          {attachment.type === "image" && attachment.content?.[0]?.type === "image" ? (
            <img
              src={attachment.content[0].image}
              alt={attachment.name || "Imagen"}
              className="h-20 w-20 object-cover rounded"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Paperclip size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{attachment.name || "Archivo"}</span>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => handleRemove(e, index)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md"
            title="Eliminar"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col">
      {/* Attachments preview */}
      <AttachmentPreview />

      <div className="relative w-full flex items-center">
        {/* Attach button - posicionado dentro del input a la izquierda */}
        <ComposerPrimitive.AddAttachment asChild>
          <button
            type="button"
            className="absolute left-3 text-gray-500 hover:text-gray-700 transition-colors z-10"
            title="Adjuntar archivo"
          >
            <Paperclip size={20} />
          </button>
        </ComposerPrimitive.AddAttachment>

        <ComposerPrimitive.Input
          placeholder="Escribe un mensaje..."
          className="w-full bg-white border border-gray-300 rounded-2xl py-4 pl-12 pr-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none max-h-32"
          rows={1}
          autoFocus
        />

        {/* Send/Cancel button - posicionado dentro del input a la derecha */}
        <div className="absolute right-2">
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <button
                type="submit"
                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUpIcon className="size-5" />
              </button>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>

          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <button
                type="button"
                className="bg-red-600 text-white p-2.5 rounded-xl hover:bg-red-700"
              >
                <Square className="size-4 fill-white" />
              </button>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-start mb-3">
      <div className="max-w-2xl bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-200">
        {/* Mostrar indicador de loading mientras está corriendo */}
        <ThreadPrimitive.If running>
          <MessagePrimitive.If empty>
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-pulse">⏳</div>
              <span className="text-sm">Pensando...</span>
            </div>
          </MessagePrimitive.If>
        </ThreadPrimitive.If>

        <div className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed">
          <MessagePrimitive.Content
            components={{
              Text: (props: any) => (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {props.text || ""}
                </ReactMarkdown>
              ),
            }}
          />
        </div>

        <ThreadPrimitive.If running={false}>
          <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2 items-center">
            <BranchPicker />
            <AssistantActionBar />
          </div>
        </ThreadPrimitive.If>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex gap-1 ml-auto"
    >
      <ActionBarPrimitive.Copy asChild>
        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors" title="Copiar">
          <MessagePrimitive.If copied>
            <CheckIcon className="size-4 text-green-600" />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon className="size-4" />
          </MessagePrimitive.If>
        </button>
      </ActionBarPrimitive.Copy>

      <ActionBarPrimitive.Reload asChild>
        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors" title="Regenerar">
          <RefreshCwIcon className="size-4" />
        </button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-end mb-3">
      <div className="max-w-2xl bg-blue-600 text-white rounded-2xl px-5 py-3 shadow-sm">
        <MessagePrimitive.Content
          components={{
            Text: (props: any) => (
              <div className="whitespace-pre-wrap">{props.text || ""}</div>
            ),
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC = () => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className="inline-flex items-center text-xs text-gray-500 gap-1"
    >
      <BranchPickerPrimitive.Previous asChild>
        <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Anterior">
          <span className="text-sm">&larr;</span>
        </button>
      </BranchPickerPrimitive.Previous>
      <span className="text-xs font-medium px-1">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Siguiente">
          <span className="text-sm">&rarr;</span>
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
