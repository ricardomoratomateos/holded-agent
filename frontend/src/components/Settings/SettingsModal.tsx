import { X, Info } from 'lucide-react';
import { ApiKeyInput } from './ApiKeyInput';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
  onClearApiKey: () => void;
  enableVerification: boolean;
  onToggleVerification: (enabled: boolean) => void;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  currentApiKey,
  onSaveApiKey,
  onClearApiKey,
  enableVerification,
  onToggleVerification
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

          {/* Verificación automática */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableVerification}
                  onChange={(e) => onToggleVerification(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-white/20 cursor-pointer"
                />
                <span className="text-[#eee] text-sm">Verificar datos automáticamente</span>
              </label>

              {/* Tooltip */}
              <div className="relative group">
                <Info size={16} className="text-[#b4b4b4] cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <p className="text-xs text-[#b4b4b4] leading-relaxed">
                    Cuando está activado, el agente verificará automáticamente que los datos creados o modificados en ERP coincidan con tu solicitud. Esto añade tiempo adicional, pero garantiza mayor precisión.
                  </p>
                </div>
              </div>
            </div>
          </div>
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
