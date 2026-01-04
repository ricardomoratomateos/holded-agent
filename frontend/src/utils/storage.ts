const STORAGE_KEYS = {
  API_KEY: 'holded_api_key',
} as const;

export const storage = {
  getApiKey: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
  },

  setApiKey: (key: string): void => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  },

  clearApiKey: (): void => {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  },

  hasApiKey: (): boolean => {
    return !!localStorage.getItem(STORAGE_KEYS.API_KEY);
  }
};
