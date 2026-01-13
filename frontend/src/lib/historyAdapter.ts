const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3300";

/**
 * Adapter para cargar/guardar historial desde el backend
 */
export async function loadHistoryFromBackend(threadId: string, apiKey: string) {
  try {
    const response = await fetch(
      `${API_URL}/history/${threadId}?holdedKey=${encodeURIComponent(apiKey)}`
    );

    if (!response.ok) {
      return [];
    }

    const history = await response.json();

    if (Array.isArray(history) && history.length > 0) {
      // Convertir al formato de assistant-ui ThreadMessage
      return history.map((msg: any, idx: number) => ({
        id: `history-${idx}-${Date.now()}`,
        role: msg.role,
        content: [
          {
            type: "text" as const,
            text: msg.content,
          },
        ],
        createdAt: new Date(),
      }));
    }

    return [];
  } catch (error) {
    console.error("Error loading history:", error);
    return [];
  }
}
