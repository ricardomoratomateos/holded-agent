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
      <div className="flex items-center gap-2 text-gray-700">
        <Key size={20} />
        <h3 className="font-medium">Holded API Key</h3>
      </div>

      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Ingresa tu API key de Holded..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saved ? <Check size={18} /> : <Key size={18} />}
          {saved ? 'Guardado!' : 'Guardar'}
        </button>

        {currentApiKey && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Tu API key se guarda localmente en tu navegador.
      </p>
    </div>
  );
};
