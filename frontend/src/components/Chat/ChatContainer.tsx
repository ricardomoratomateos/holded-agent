import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { Message } from '../../types';

interface ChatContainerProps {
  messages: Message[];
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSend: (message: string) => void;
  onApprove?: () => void;
}

export const ChatContainer = ({
  messages,
  loading,
  messagesEndRef,
  onSend,
  onApprove
}: ChatContainerProps) => {
  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        loading={loading}
        messagesEndRef={messagesEndRef}
        onApprove={onApprove}
      />

      <div className="border-t border-gray-200 bg-white p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={onSend} disabled={loading} />
        </div>
      </div>
    </div>
  );
};
