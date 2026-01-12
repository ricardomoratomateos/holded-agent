/**
 * SSEWriter - Maneja la escritura de Server-Sent Events
 */
export class SSEWriter {
  constructor(private reply: any) {}

  setupHeaders(): void {
    this.reply.raw.setHeader("Content-Type", "text/event-stream");
    this.reply.raw.setHeader("Cache-Control", "no-cache");
    this.reply.raw.setHeader("Connection", "keep-alive");
    this.reply.raw.setHeader("Access-Control-Allow-Origin", "*");
  }

  write(data: any): void {
    this.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  end(): void {
    this.reply.raw.end();
  }
}
