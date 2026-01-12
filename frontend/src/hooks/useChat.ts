import { useState, useRef, useEffect } from 'react';
import { chatWithAgentStreaming, getChatHistory, deleteChatHistory } from '../api';
import type { Message } from '../types';

export const useChat = (apiKey: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [threadId] = useState(() => {
    const saved = localStorage.getItem('holded_thread_id');
    if (saved) return saved;
    const newId = `session-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('holded_thread_id', newId);
    return newId;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      if (apiKey && threadId) {
        const history = await getChatHistory(threadId, apiKey);
        setMessages(history);
      }
    };
    loadHistory();
  }, [apiKey, threadId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (text: string, file?: File) => {
    if (!text.trim() && !file) return;
    if (loading) return;

    setLoading(true);

    // Añadir mensaje del usuario + placeholder del assistant
    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: '',
      status: 'streaming',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg, assistantPlaceholder]);

    try {
      // 3. Iniciamos el streaming desde la API
      await chatWithAgentStreaming(text || '', threadId, apiKey, file, (chunk) => {
        setMessages(prev => {
          // Buscar el último mensaje de assistant con status 'streaming'
          const lastAssistantIndex = prev.length - 1;
          const lastMsg = prev[lastAssistantIndex];

          // Verificar que es realmente el assistant
          if (!lastMsg || lastMsg.role !== 'assistant') {
            console.warn('Último mensaje no es assistant, ignorando chunk');
            return prev;
          }

          const updatedMsg = { ...lastMsg };

          // Acumulación de contenido (el backend ya filtra el contenido técnico)
          if (chunk.content) {
            if (typeof chunk.content === 'string') {
              updatedMsg.content = updatedMsg.content + chunk.content;
            } else {
              // Si recibimos algo que no es string, lo dejamos para que MessageContent lo maneje
              updatedMsg.content = chunk.content;
            }
          }

          // --- GESTIÓN DE ESTADOS (Finalización o Aprobación) ---
          if (chunk.status) {
            updatedMsg.status = chunk.status;
          }

          // Si el chunk indica que es el final y trae una respuesta limpia
          if (chunk.final && chunk.response && typeof chunk.response === 'string') {
            updatedMsg.content = chunk.response;
          }

          return [...prev.slice(0, lastAssistantIndex), updatedMsg];
        });
      });

    } catch (error) {
      console.error("Error en streaming:", error);
      setMessages(prev => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last && last.status === 'streaming') {
          msgs[msgs.length - 1] = { ...last, status: 'error', content: 'Lo siento, ha ocurrido un error de conexión.' };
          return msgs;
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (loading) return;

    setLoading(true);

    // 1. Primero, remover el estado 'pending_approval' del último mensaje
    // 2. Luego, añadir placeholder para la respuesta del assistant
    setMessages(prev => {
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];

      if (lastMsg && lastMsg.status === 'pending_approval') {
        updated[updated.length - 1] = { ...lastMsg, status: 'success' };
      }

      // Añadir nuevo mensaje de respuesta
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '',
        status: 'streaming',
        timestamp: Date.now()
      };

      return [...updated, assistantPlaceholder];
    });

    try {
      await chatWithAgentStreaming('', threadId, apiKey, undefined, (chunk) => {
        setMessages(prev => {
          const lastAssistantIndex = prev.length - 1;
          const lastMsg = prev[lastAssistantIndex];

          if (!lastMsg || lastMsg.role !== 'assistant') {
            console.warn('Último mensaje no es assistant, ignorando chunk');
            return prev;
          }

          const updatedMsg = { ...lastMsg };

          if (chunk.content) {
            if (typeof chunk.content === 'string') {
              updatedMsg.content = updatedMsg.content + chunk.content;
            } else {
              updatedMsg.content = chunk.content;
            }
          }

          if (chunk.status) {
            updatedMsg.status = chunk.status;
          }

          if (chunk.final && chunk.response && typeof chunk.response === 'string') {
            updatedMsg.content = chunk.response;
          }

          return [...prev.slice(0, lastAssistantIndex), updatedMsg];
        });
      }, 'approve'); // <-- Pasar action='approve'
    } catch (error) {
      console.error("Error en aprobación:", error);
      setMessages(prev => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last && last.status === 'streaming') {
          msgs[msgs.length - 1] = { ...last, status: 'error', content: 'Error al aprobar la acción.' };
          return msgs;
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (loading) return;

    setLoading(true);

    // 1. Primero, remover el estado 'pending_approval' del último mensaje
    // 2. Luego, añadir placeholder para la respuesta del assistant
    setMessages(prev => {
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];

      if (lastMsg && lastMsg.status === 'pending_approval') {
        updated[updated.length - 1] = { ...lastMsg, status: 'success' };
      }

      // Añadir nuevo mensaje de respuesta
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '',
        status: 'streaming',
        timestamp: Date.now()
      };

      return [...updated, assistantPlaceholder];
    });

    try {
      await chatWithAgentStreaming('', threadId, apiKey, undefined, (chunk) => {
        setMessages(prev => {
          const lastAssistantIndex = prev.length - 1;
          const lastMsg = prev[lastAssistantIndex];

          if (!lastMsg || lastMsg.role !== 'assistant') {
            return prev;
          }

          const updatedMsg = { ...lastMsg };

          if (chunk.content) {
            updatedMsg.content = typeof chunk.content === 'string'
              ? updatedMsg.content + chunk.content
              : chunk.content;
          }

          if (chunk.status) {
            updatedMsg.status = chunk.status;
          }

          return [...prev.slice(0, lastAssistantIndex), updatedMsg];
        });
      }, 'reject'); // <-- Pasar action='reject'
    } catch (error) {
      console.error("Error en rechazo:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    // 1. Llamada al borrado físico en el servidor (opcional pero recomendado ya que tienes el endpoint)
    try {
      if (apiKey && threadId) {
        await deleteChatHistory(threadId, apiKey); 
      }
    } catch (error) {
      console.error("No se pudo borrar el historial del servidor, pero resetearemos la sesión local igualmente.");
    }

    // 2. Generamos un nuevo ID de hilo
    const newThreadId = `session-${Math.random().toString(36).substr(2, 9)}`;
    
    // 3. Lo guardamos en localStorage
    localStorage.setItem('holded_thread_id', newThreadId);
    
    // 4. Limpiamos el estado local
    setMessages([]);
    
    // 5. Recargar la página
    window.location.reload();
  };

  return { messages, loading, sendMessage, handleApprove, handleReject, clearChat, messagesEndRef };
};