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
    <header className="bg-gray-800 border-b border-gray-700 shadow-sm">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-100">Holded AI Agent</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botón de Borrar Historial */}
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-all disabled:opacity-50"
              title="Borrar conversación"
            >
              {isDeleting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>

            {/* Botón de Configuración */}
            <button
              onClick={onOpenSettings}
              className="relative p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title="Configuración"
            >
              <Settings size={18} className="text-gray-400" />
              {!hasApiKey && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-800"></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};