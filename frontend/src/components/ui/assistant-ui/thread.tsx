import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposer,
  useThreadRuntime,
} from "@assistant-ui/react";
import { CheckIcon, CopyIcon, RefreshCwIcon, ArrowUpIcon, ArrowDownIcon, Square, Paperclip, X, BarChart3, Search, Zap, Loader2, FileText, Mic, MicOff } from "lucide-react";
import { type FC, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Chart, parseChartBlocks } from "../Chart";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-[#212121] text-[#eee]">
      <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-6 overflow-y-auto pt-12 pb-4">
        <ThreadPrimitive.Empty>
          <ThreadWelcome />
        </ThreadPrimitive.Empty>

        <div className="max-w-screen-md mx-auto w-full px-4">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </div>

        <div className="h-32" />
      </ThreadPrimitive.Viewport>

      <div className="sticky bottom-0 bg-[#212121] px-4 pb-4">
        <div className="max-w-screen-md mx-auto w-full">
          <ThreadScrollToBottom />
          <QuickActions />
          <Composer />
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <h2 className="text-2xl font-semibold text-[#eee] mb-3">
        Asistente de Holded
      </h2>
      <p className="text-[#b4b4b4] mb-6">
        Tu agente investigador y gestor de Holded
      </p>
      <div className="text-sm text-[#cdcdcd] max-w-md space-y-2 text-left">
        <p>✅ Consultar datos - Contactos, facturas, documentos</p>
        <p>✅ Crear y modificar - Facturas, presupuestos, pedidos</p>
        <p>✅ Analizar imágenes y PDFs - Facturas, recibos, cualquier documento</p>
        <p>✅ Buscar información - Documentación técnica y guías de Holded</p>
      </div>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <button className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-full bg-white/10 p-3 shadow-lg hover:bg-white/20 transition-colors disabled:hidden border border-white/10">
        <ArrowDownIcon className="size-4 text-[#eee]" />
      </button>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const QuickActions: FC = () => {
  const runtime = useThreadRuntime();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = (text: string) => {
    runtime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const composer = (runtime as any).composer;
      if (composer?.addAttachment) {
        await composer.addAttachment(file);
        // Enviar mensaje automáticamente después de adjuntar
        setTimeout(() => {
          composer.setText("Analiza esta compra y créala en Holded");
          composer.send();
        }, 100);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const quickActions = [
    {
      icon: BarChart3,
      label: "Resumen de ventas este mes",
      action: () => sendMessage("Dame un resumen de las ventas de este mes con gráfico"),
    },
    {
      icon: Search,
      label: "Buscar facturas pendientes",
      action: () => sendMessage("Busca las facturas pendientes de cobro"),
    },
    {
      icon: Zap,
      label: "Analizar compra y crear",
      action: () => fileInputRef.current?.click(),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-3 justify-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*,.pdf"
        className="hidden"
      />
      {quickActions.map((action, index) => (
        <button
          key={index}
          onClick={action.action}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[#cdcdcd] bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
        >
          <action.icon size={16} />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
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

  const attachments = composer.attachments || [];

  // No renderizar nada si no hay attachments
  if (attachments.length === 0) return null;

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
    <div className="mt-3 mb-2 flex flex-wrap gap-2 px-3">
      {attachments.map((attachment: any, index: number) => (
        <div key={attachment.id || index} className="relative inline-flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl border border-white/10 group">
          {attachment.type === "image" && attachment.content?.[0]?.type === "image" ? (
            <img
              src={attachment.content[0].image}
              alt={attachment.name || "Imagen"}
              className="h-16 w-16 object-cover rounded-lg"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Paperclip size={16} className="text-[#cdcdcd]" />
              <span className="text-sm text-[#eee]">{attachment.name || "Archivo"}</span>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => handleRemove(e, index)}
            className="absolute -top-2 -right-2 bg-white/20 text-[#eee] rounded-full p-1 hover:bg-white/30 transition-colors"
            title="Eliminar"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

const MESSAGE_TEMPLATES = [
  { label: "Resumen de ventas de este mes", text: "Dame un resumen de las ventas de este mes" },
  { label: "Facturas pendientes de cobro", text: "¿Cuáles son las facturas pendientes de cobro?" },
  { label: "Top 10 clientes", text: "¿Cuáles son mis 10 mejores clientes por facturación?" },
  { label: "Gastos del mes", text: "Dame un resumen de los gastos de este mes" },
  { label: "Crear factura", text: "Crea una factura para [cliente] por [cantidad]€" },
  { label: "Buscar contacto", text: "Busca el contacto [nombre]" },
];

const Composer: FC = () => {
  const runtime = useThreadRuntime();
  const [showTemplates, setShowTemplates] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const handleTemplateClick = (text: string) => {
    const composer = (runtime as any).composer;
    if (composer?.setText) {
      composer.setText(text);
    }
    setShowTemplates(false);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      const composer = (runtime as any).composer;
      if (composer?.setText) {
        composer.setText(text);
      }
    };

    recognition.start();
  };

  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col rounded-2xl bg-[#303030] border border-white/10">
      <AttachmentPreview />

      {/* Dropdown de plantillas */}
      {showTemplates && (
        <div className="absolute bottom-full left-0 mb-2 w-full bg-[#303030] border border-white/10 rounded-xl shadow-lg overflow-hidden z-10">
          <div className="p-2 border-b border-white/10">
            <span className="text-xs text-[#b4b4b4]">Plantillas</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {MESSAGE_TEMPLATES.map((template, index) => (
              <button
                key={index}
                onClick={() => handleTemplateClick(template.text)}
                className="w-full text-left px-3 py-2 text-sm text-[#cdcdcd] hover:bg-white/10 transition-colors"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative w-full flex items-center px-3 py-2">
        <ComposerPrimitive.AddAttachment asChild>
          <button
            type="button"
            className="text-[#b4b4b4] hover:text-[#eee] transition-colors p-1"
            title="Adjuntar archivo"
          >
            <Paperclip size={20} />
          </button>
        </ComposerPrimitive.AddAttachment>

        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-[#b4b4b4] hover:text-[#eee] transition-colors p-1"
          title="Plantillas"
        >
          <FileText size={20} />
        </button>

        <button
          type="button"
          onClick={handleVoiceInput}
          className={`transition-colors p-1 ${isListening ? "text-red-500 animate-pulse" : "text-[#b4b4b4] hover:text-[#eee]"}`}
          title={isListening ? "Escuchando..." : "Entrada de voz"}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <ComposerPrimitive.Input
          placeholder="Escribe un mensaje..."
          className="flex-grow resize-none bg-transparent px-3 py-2 text-[#eee] outline-none placeholder:text-[#8e8e8e] min-h-[24px] max-h-40"
          rows={1}
          autoFocus
        />

        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send asChild>
            <button
              type="submit"
              className="flex size-8 items-center justify-center rounded-full bg-white text-black disabled:opacity-20 transition-opacity"
            >
              <ArrowUpIcon className="size-5" />
            </button>
          </ComposerPrimitive.Send>
        </ThreadPrimitive.If>

        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel asChild>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full bg-white/20 text-[#eee] hover:bg-white/30 transition-colors"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-start mb-4">
      <div className="max-w-[85%] bg-white/5 rounded-3xl px-5 py-3">
        <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-p:text-[#eee] prose-headings:text-[#eee] prose-strong:text-[#eee] prose-code:text-[#eee]">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }: { text: string }) => {
                // Estado inicial de "pensando"
                if (!text || text === "⏳ Procesando...") {
                  return (
                    <div className="flex items-center gap-2 text-[#b4b4b4]">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Pensando...</span>
                    </div>
                  );
                }

                // Steps del agente (mismo estilo que "pensando")
                if (text.startsWith("__STEP__")) {
                  const stepText = text.replace("__STEP__", "");
                  return (
                    <div className="flex items-center gap-2 text-[#b4b4b4]">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">{stepText}</span>
                    </div>
                  );
                }

                // Detectar y renderizar gráficos
                const parts = parseChartBlocks(text);
                const hasCharts = parts.some(p => p.type === 'chart');

                if (hasCharts) {
                  return (
                    <>
                      {parts.map((part, index) => (
                        part.type === 'chart' ? (
                          <Chart key={index} {...(part.content as any)} />
                        ) : (
                          <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                            {part.content as string}
                          </ReactMarkdown>
                        )
                      ))}
                    </>
                  );
                }

                return (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {text}
                  </ReactMarkdown>
                );
              },
            }}
          />
        </div>

        <div className="mt-3 pt-2 border-t border-white/10 flex gap-1 items-center">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root className="flex gap-1">
      <ActionBarPrimitive.Copy asChild>
        <button className="p-1.5 hover:bg-white/10 rounded-lg text-[#b4b4b4] hover:text-[#eee] transition-colors" title="Copiar">
          <MessagePrimitive.If copied>
            <CheckIcon className="size-4 text-green-500" />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon className="size-4" />
          </MessagePrimitive.If>
        </button>
      </ActionBarPrimitive.Copy>

      <ActionBarPrimitive.Reload asChild>
        <button className="p-1.5 hover:bg-white/10 rounded-lg text-[#b4b4b4] hover:text-[#eee] transition-colors" title="Regenerar">
          <RefreshCwIcon className="size-4" />
        </button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-end mb-4">
      <div className="max-w-[85%] bg-white/5 text-[#eee] rounded-3xl px-5 py-3">
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
      className="inline-flex items-center text-xs text-[#b4b4b4] gap-1"
    >
      <BranchPickerPrimitive.Previous asChild>
        <button className="p-1 hover:bg-white/10 rounded-lg transition-colors" title="Anterior">
          <span className="text-sm">&larr;</span>
        </button>
      </BranchPickerPrimitive.Previous>
      <span className="text-xs font-medium px-1">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <button className="p-1 hover:bg-white/10 rounded-lg transition-colors" title="Siguiente">
          <span className="text-sm">&rarr;</span>
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
