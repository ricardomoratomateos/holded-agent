import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Layout/Header';
import { ChatContainer } from './components/Chat/ChatContainer';
import { SettingsModal } from './components/Settings/SettingsModal';
import { useApiKey } from './hooks/useApiKey';
import { useChat } from './hooks/useChat';

function App() {
  const { apiKey, isConfigured, isLoading, saveApiKey, clearApiKey } = useApiKey();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { messages, loading, sendMessage, handleApprove, handleReject, clearChat, messagesEndRef } = useChat(apiKey);
  const hasInitialized = useRef(false);

  // Mostrar settings solo la primera vez si no hay API key (después de cargar)
  useEffect(() => {
    if (!isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      if (!isConfigured) {
        setSettingsOpen(true);
      }
    }
  }, [isLoading, isConfigured]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onClearChat={clearChat}
        hasApiKey={isConfigured}
      />

      <ChatContainer
        messages={messages}
        loading={loading}
        messagesEndRef={messagesEndRef}
        onSend={sendMessage}
        onApprove={handleApprove}
        onReject={handleReject}
      />

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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-3">API Key Requerida</h2>
            <p className="text-gray-600 mb-4">
              Por favor configura tu API key de Holded para usar el chat.
            </p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
