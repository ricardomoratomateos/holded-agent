import { Bot, User, Loader2 } from 'lucide-react';
import type { Message as MessageType } from '../../types';
import { MessageContent } from './MessageContent';
import { ApprovalPanel } from './ApprovalPanel';

interface MessageProps {
  message: MessageType;
  onApprove?: () => void;
}

export const Message = ({ message, onApprove }: MessageProps) => {
  const isUser = message.role === 'user';

  // Determinamos si debemos mostrar el estado de carga dentro de la burbuja
  // Se muestra si es el bot, está haciendo streaming y el contenido está vacío
  const isInitialLoading = 
    !isUser && 
    message.status === 'streaming' && 
    (!message.content || message.content.trim() === '');

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-md'
            : 'bg-gradient-to-br from-gray-700 to-gray-800 shadow-md'
        }`}>
          {isUser ? (
            <User size={18} className="text-white" />
          ) : (
            <Bot size={18} className="text-white" />
          )}
        </div>

        {/* Message Bubble */}
        <div className={`rounded-2xl shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white px-4 py-3 rounded-tr-md'
            : 'bg-white text-gray-800 px-4 py-3 rounded-tl-md border border-gray-200'
        }`}>
          {isInitialLoading ? (
            <div className="flex items-center gap-2 py-1 px-1">
              <Loader2 className="animate-spin text-blue-500" size={16} />
              <span className="text-gray-400 text-sm animate-pulse">Escribiendo...</span>
            </div>
          ) : (
            <MessageContent content={message.content} isUser={isUser} />
          )}

          {message.status === 'pending_approval' && (
            <ApprovalPanel onApprove={onApprove} />
          )}
        </div>
      </div>
    </div>
  );
};