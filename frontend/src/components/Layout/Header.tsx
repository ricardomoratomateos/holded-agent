import { Bot, Settings, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  onOpenSettings: () => void;
  onClearChat: () => Promise<void>;
  hasApiKey: boolean;
}

export const Header = ({ onOpenSettings, onClearChat, hasApiKey }: HeaderProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = async () => {
    if (window.confirm("¿Estás seguro de que quieres borrar todo el historial? Esta acción no se puede deshacer.")) {
      setIsDeleting(true);
      try {
        await onClearChat();
      } catch (error) {
        console.error("Error al borrar:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">Holded AI Agent</h1>
              <p className="text-xs text-gray-500">Powered by Claude</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón de Borrar Historial */}
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
              title="Borrar conversación"
            >
              {isDeleting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
            </button>

            {/* Botón de Configuración */}
            <button
              onClick={onOpenSettings}
              className="relative p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Configuración"
            >
              <Settings size={20} className="text-gray-600" />
              {!hasApiKey && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};