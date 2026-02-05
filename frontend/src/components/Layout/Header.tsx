import { Settings, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './Logo';

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
    <header className="bg-[#212121] border-b border-white/10">
      <div className="max-w-screen-md mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <div>
              <h1 className="text-base font-semibold text-[#eee]">ERP AI Agent</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botón de Borrar Historial */}
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="p-2 rounded-lg text-[#b4b4b4] hover:text-red-400 hover:bg-white/5 transition-all disabled:opacity-50"
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
              className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Configuración"
            >
              <Settings size={18} className="text-[#b4b4b4]" />
              {!hasApiKey && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#212121]"></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};