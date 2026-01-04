import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export const useApiKey = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedKey = storage.getApiKey();
    if (storedKey) {
      setApiKey(storedKey);
      setIsConfigured(true);
    }
    setIsLoading(false);
  }, []);

  const saveApiKey = (key: string) => {
    storage.setApiKey(key);
    setApiKey(key);
    setIsConfigured(true);
  };

  const clearApiKey = () => {
    storage.clearApiKey();
    setApiKey('');
    setIsConfigured(false);
  };

  return { apiKey, isConfigured, isLoading, saveApiKey, clearApiKey };
};
