import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      <TextareaAutosize
        className="w-full bg-white border border-gray-300 rounded-2xl py-4 pl-5 pr-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm resize-none max-h-32"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu mensaje... (Shift+Enter para nueva línea)"
        disabled={disabled}
        minRows={1}
        maxRows={5}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="absolute right-2 top-2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
      >
        <Send size={20} />
      </button>
    </div>
  );
};
