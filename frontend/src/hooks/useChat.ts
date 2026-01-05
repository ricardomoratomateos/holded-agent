import { useState, useRef, useEffect } from 'react';
import { chatWithAgentStreaming, approveAction, getChatHistory, deleteChatHistory } from '../api';
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

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    // 1. Añadimos el mensaje del usuario a la lista
    const userMsg: Message = { 
      role: 'user', 
      content: text, 
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // 2. Creamos el placeholder para el mensaje del asistente en streaming
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: '', 
          status: 'streaming', 
          timestamp: Date.now() 
        }
      ]);

      // 3. Iniciamos el streaming desde la API
      await chatWithAgentStreaming(text, threadId, apiKey, (chunk) => {
        setMessages(prev => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0) return prev;

          const lastMsg = prev[lastIndex];
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

          return [...prev.slice(0, lastIndex), updatedMsg];
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

  const handleApproval = async () => {
    const pendingIndex = [...messages].reverse().findIndex(m => m.status === 'pending_approval');
    const actualIndex = pendingIndex !== -1 ? messages.length - 1 - pendingIndex : -1;

    if (actualIndex === -1) return;

    setLoading(true);
    try {
      const data = await approveAction(threadId, apiKey);
      
      setMessages(prev => prev.map((msg, idx) => 
        idx === actualIndex ? { ...msg, status: 'approved' as const } : msg
      ));

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        status: 'success' as const
      }]);
    } catch (error) {
      console.error(error);
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

  return { messages, loading, sendMessage, handleApproval, clearChat, messagesEndRef };
};