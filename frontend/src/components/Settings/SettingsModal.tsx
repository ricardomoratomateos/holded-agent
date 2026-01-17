import { X } from 'lucide-react';
import { ApiKeyInput } from './ApiKeyInput';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
  onClearApiKey: () => void;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  currentApiKey,
  onSaveApiKey,
  onClearApiKey
}: SettingsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-[#eee]">Configuración</h2>
          <button
            onClick={onClose}
            className="text-[#b4b4b4] hover:text-[#eee] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <ApiKeyInput
            currentApiKey={currentApiKey}
            onSave={onSaveApiKey}
            onClear={onClearApiKey}
          />
        </div>

        <div className="p-6 border-t border-white/10 bg-[#212121] rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full bg-white text-black py-2.5 rounded-xl hover:bg-white/90 transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
