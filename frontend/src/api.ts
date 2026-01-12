const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3300";

export const chatWithAgent = async (message: string, threadId: string, holdedKey: string) => {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, threadId, holdedKey }),
  });
  return response.json();
};

export const chatWithAgentStreaming = async (
  message: string,
  threadId: string,
  holdedKey: string,
  file: File | undefined,
  onChunk: (chunk: any) => void,
  action?: 'approve' | 'reject'
) => {
  let body: FormData | string;
  let headers: Record<string, string> = {};

  // Si hay archivo, usar FormData
  if (file) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('threadId', threadId);
    formData.append('holdedKey', holdedKey);
    formData.append('file', file);

    if (action) {
      formData.append('action', action);
    }

    body = formData;
    // NO establecer Content-Type, el browser lo hace automáticamente con boundary
  } else {
    // JSON normal
    const jsonBody: any = { message, threadId, holdedKey };
    if (action) {
      jsonBody.action = action;
    }
    body = JSON.stringify(jsonBody);
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers,
    body,
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n\n");
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.replace("data: ", ""));
        onChunk(data);
      }
    }
  }
};

export const getChatHistory = async (threadId: string, holdedKey: string) => {
  const response = await fetch(`${API_URL}/history/${threadId}?holdedKey=${holdedKey}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) return [];
  return response.json();
};

export const deleteChatHistory = async (threadId: string, holdedKey: string) => {
  await fetch(`${API_URL}/history/${threadId}?holdedKey=${holdedKey}`, {
    method: "DELETE",
  });
};
