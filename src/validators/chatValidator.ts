/**
 * Validación de requests del endpoint /chat
 */
export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatValidationError';
  }
}

export function validateChatRequest(body: any): void {
  if (!body.threadId) {
    throw new ChatValidationError("threadId es requerido");
  }

  if (!body.holdedKey) {
    throw new ChatValidationError("holdedKey es requerido");
  }

  // Si no es una acción de control, debe tener mensaje
  if (!body.action && !body.message) {
    throw new ChatValidationError("message o action son requeridos");
  }
}
