import type { Message as MessageType } from '../../types';
import { Message } from './Message';

interface MessageListProps {
  messages: MessageType[];
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onApprove?: () => void;
}

export const MessageList = ({ messages, messagesEndRef, onApprove }: MessageListProps) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Inicia una conversación...</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message
            key={i}
            message={msg}
            onApprove={onApprove}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
