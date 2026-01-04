export interface Message {
  role: 'user' | 'assistant';
  content: string;
  status?: 'pending_approval' | 'approved' | 'success' | 'error' | 'streaming';
  timestamp?: number;
}

export interface ChatState {
  messages: Message[];
  loading: boolean;
  threadId: string;
}

export interface ApiKeyConfig {
  key: string;
  isConfigured: boolean;
}
