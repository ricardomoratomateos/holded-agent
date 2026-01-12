import { useState, useRef } from 'react';
import type { KeyboardEvent, DragEvent } from 'react';
import { Send, Image as ImageIcon, X, FileText } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!input.trim() && !selectedFile) return;
    if (disabled) return;

    onSend(input, selectedFile || undefined);
    setInput('');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (file: File) => {
    // Aceptar imágenes y PDFs
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      setSelectedFile(file);

      // Preview solo para imágenes
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || selectedFile) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de drag & drop */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-2xl z-10 flex items-center justify-center">
          <div className="text-blue-600 font-semibold text-lg">
            Suelta el archivo aquí
          </div>
        </div>
      )}

      {/* Preview de imagen o indicador de PDF */}
      {selectedFile && (
        <div className="mb-2 relative inline-block">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-32 rounded-lg border border-gray-300"
            />
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg border border-gray-300">
              <FileText size={20} className="text-red-600" />
              <span className="text-sm text-gray-700">{selectedFile.name}</span>
            </div>
          )}
          <button
            onClick={handleRemoveFile}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleImageSelect}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !!selectedFile}
          className="bg-gray-200 text-gray-700 p-3 rounded-xl hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Adjuntar archivo"
        >
          <ImageIcon size={20} />
        </button>

        <div className="flex-1 relative">
          <TextareaAutosize
            className="w-full bg-white border border-gray-300 rounded-2xl py-4 pl-5 pr-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm resize-none max-h-32"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? "Opcional: añade una nota..." : "Arrastra un archivo o escribe..."}
            disabled={disabled}
            minRows={1}
            maxRows={5}
          />
          <button
            onClick={handleSend}
            disabled={disabled || (!input.trim() && !selectedFile)}
            className="absolute right-2 top-2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
