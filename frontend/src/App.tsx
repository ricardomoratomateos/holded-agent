import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Layout/Header';
import { SettingsModal } from './components/Settings/SettingsModal';
import { AssistantChat } from './components/AssistantChat';
import { useApiKey } from './hooks/useApiKey';

function App() {
  const { apiKey, isConfigured, isLoading, saveApiKey, clearApiKey } = useApiKey();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasInitialized = useRef(false);

  // Thread ID persistente
  const [threadId] = useState(() => {
    const saved = localStorage.getItem('holded_thread_id');
    if (saved) return saved;
    const newId = `session-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('holded_thread_id', newId);
    return newId;
  });

  // Mostrar settings solo la primera vez si no hay API key (después de cargar)
  useEffect(() => {
    if (!isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      if (!isConfigured) {
        setSettingsOpen(true);
      }
    }
  }, [isLoading, isConfigured]);

  const clearChat = async () => {
    // Generar nuevo thread ID
    const newThreadId = `session-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('holded_thread_id', newThreadId);
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen bg-[#212121]">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onClearChat={clearChat}
        hasApiKey={isConfigured}
      />

      {isConfigured ? (
        <div className="flex-1 overflow-hidden">
          <AssistantChat apiKey={apiKey} threadId={threadId} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#b4b4b4] mb-4">
              Configura tu API key para comenzar
            </p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="bg-white text-black px-6 py-2 rounded-xl hover:bg-white/90 font-medium transition-colors"
            >
              Abrir Configuración
            </button>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => isConfigured && setSettingsOpen(false)}
        currentApiKey={apiKey}
        onSaveApiKey={(key) => {
          saveApiKey(key);
          setSettingsOpen(false);
        }}
        onClearApiKey={clearApiKey}
      />

      {!isConfigured && !settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 shadow-2xl max-w-md mx-4 border border-white/10">
            <h2 className="text-xl font-semibold mb-3 text-[#eee]">API Key Requerida</h2>
            <p className="text-[#cdcdcd] mb-4">
              Por favor configura tu API key de Holded para usar el chat.
            </p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full bg-white text-black py-2.5 rounded-xl hover:bg-white/90 transition-colors font-medium"
            >
              Abrir Configuración
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
