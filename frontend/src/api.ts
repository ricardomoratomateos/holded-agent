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
  onChunk: (chunk: any) => void
) => {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, threadId, holdedKey }),
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

export const approveAction = async (threadId: string, holdedKey: string) => {
  const response = await fetch(`${API_URL}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, holdedKey }),
  });
  return response.json();
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
