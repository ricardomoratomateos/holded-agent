import { useState } from 'react';
import { Key, Eye, EyeOff, Check, Trash2 } from 'lucide-react';

interface ApiKeyInputProps {
  currentApiKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
}

export const ApiKeyInput = ({ currentApiKey, onSave, onClear }: ApiKeyInputProps) => {
  const [key, setKey] = useState(currentApiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (key.trim()) {
      onSave(key);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleClear = () => {
    setKey('');
    onClear();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#cdcdcd]">
        <Key size={20} />
        <h3 className="font-medium">ERP API Key</h3>
      </div>

      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Ingresa tu API key de ERP..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-12 text-[#eee] placeholder-white/40 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none transition-all"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b4b4b4] hover:text-[#eee]"
        >
          {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-2 rounded-xl hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saved ? <Check size={18} /> : <Key size={18} />}
          {saved ? 'Guardado!' : 'Guardar'}
        </button>

        {currentApiKey && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <p className="text-xs text-[#b4b4b4]">
        Tu API key se guarda localmente en tu navegador.
      </p>
    </div>
  );
};
