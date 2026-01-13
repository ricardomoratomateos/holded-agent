import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { createAgent } from "./agent/graph.js";
import { SSEWriter } from "./utils/sseWriter.js";
import { getChatStrategy } from "./strategies/chatStrategy.js";
import { validateChatRequest, ChatValidationError } from "./validators/chatValidator.js";

const server = Fastify({ logger: true });

// Crear carpeta uploads si no existe
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Habilitar CORS para conectar con React
await server.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
});

// Habilitar soporte para multipart/form-data (file uploads)
await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * ENDPOINT DE UPLOAD: Subir archivos (imágenes/PDFs) antes del chat
 */
server.post("/chat/upload", async (request, reply) => {
  try {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const mimeType = data.mimetype;
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      return reply.code(400).send({ error: 'Solo se permiten imágenes y PDFs' });
    }

    const timestamp = Date.now();
    const filename = `${timestamp}-${data.filename}`;
    const filepath = path.join(uploadsDir, filename);
    const buffer = await data.toBuffer();

    fs.writeFileSync(filepath, buffer);

    console.log(`📎 Archivo subido: ${filepath}`);

    return { success: true, documentPath: filepath };
  } catch (error) {
    server.log.error(error);
    return reply.code(500).send({ error: 'Error al subir archivo' });
  }
});

/**
 * ENDPOINT PRINCIPAL: Streaming de mensajes con soporte para interrupciones
 */
server.post("/chat", async (request, reply) => {
  try {
    // Detectar si es multipart por el Content-Type header
    const contentType = request.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');

    let body: any = {};
    let documentPath: string | undefined;

    // Procesar request (multipart o JSON)
    if (isMultipart) {
      // Procesar multipart/form-data
      const parts = request.parts();

      for await (const part of parts) {
        if (part.type === 'file') {
          // Guardar archivo
          const buffer = await part.toBuffer();
          const timestamp = Date.now();
          const filename = `${timestamp}-${part.filename}`;
          const filepath = path.join(uploadsDir, filename);

          fs.writeFileSync(filepath, buffer);
          documentPath = filepath;

          console.log(`📎 Archivo guardado: ${filepath}`);
        } else {
          // Es un campo de texto
          body[part.fieldname] = (part as any).value;
        }
      }
    } else {
      // JSON normal
      body = request.body as any;
    }

    // Validar request
    validateChatRequest(body);

    // Si hay documento adjunto (ya sea del multipart o del body.documentPath)
    let finalMessage = body.message;
    const finalDocumentPath = documentPath || body.documentPath;

    if (finalDocumentPath) {
      finalMessage = `${body.message || 'Analiza el documento adjunto'}\n\n[Documento adjunto: ${finalDocumentPath}]`;
    }

    // Crear agente y configuración
    const agent = await createAgent(body.holdedKey);
    const config = { configurable: { thread_id: body.threadId } };

    // Crear writer SSE
    const writer = new SSEWriter(reply);
    writer.setupHeaders();

    // Obtener estrategia
    const strategy = await getChatStrategy();

    // Ejecutar estrategia
    await strategy.handle({
      agent,
      config,
      writer,
      message: finalMessage
    });

  } catch (error) {
    server.log.error(error);

    // Si es un error de validación, enviar error específico
    if (error instanceof ChatValidationError) {
      const errorPayload = JSON.stringify({
        error: error.message,
        status: "error"
      });
      reply.raw.write(`data: ${errorPayload}\n\n`);
      reply.raw.end();
    } else {
      // Error genérico
      const errorPayload = JSON.stringify({
        error: "Stream error",
        status: "error"
      });
      reply.raw.write(`data: ${errorPayload}\n\n`);
      reply.raw.end();
    }
  }
});

server.get("/history/:threadId", async (request, reply) => {
  const { threadId } = request.params as any;
  const { holdedKey } = request.query as any;
  
  const agent = await createAgent(holdedKey);
  const config = { configurable: { thread_id: threadId } };
  
  try {
    const state = await agent.getState(config);
    const history = state.values?.messages || [];
    
    const formattedHistory = history
      .map((m: any) => {
        const role = m._getType() === "human" ? "user" : "assistant";
        let content = "";

        // 1. Manejar contenido tipo Array (bloques de texto + tools de Claude)
        if (Array.isArray(m.content)) {
          content = m.content
            .filter((block: any) => block.type === "text")
            .map((block: any) => block.text)
            .join("\n");
        } 
        // 2. Manejar contenido tipo String
        else if (typeof m.content === "string") {
          content = m.content;
        }

        return {
          role,
          content: content.trim(),
          status: "success"
        };
      })
      /**
       * 3. FILTRO DE LIMPIEZA CRÍTICO:
       * Eliminamos mensajes que:
       * - Estén vacíos (mensajes que solo eran tool_calls sin texto).
       * - Sean respuestas crudas de la API (JSON de Holded que empieza por [ o {).
       */
      .filter((m: any) => {
        const isNotEmpty = m.content !== "";
        const isNotRawJson = !m.content.startsWith("[{") && !m.content.startsWith('{"');
        return isNotEmpty && isNotRawJson;
      });

    return formattedHistory;
  } catch (error) {
    server.log.error(error);
    return [];
  }
});

server.delete("/history/:threadId", async (request, reply) => {
  const { threadId } = request.params as any;
  const { holdedKey } = request.query as any;

  try {
    const agent = await createAgent(holdedKey);
    const config = { configurable: { thread_id: threadId } };

    await agent.updateState(config, { messages: [] }, "agent");

    return { status: "success", message: "Historial reseteado" };
  } catch (error) {
    return reply.code(500).send({ error: "No se pudo borrar el historial" });
  }
});

// Inicio del servidor en el puerto 3300
const start = async () => {
  try {
    await server.listen({ port: 3300, host: '0.0.0.0' });
    console.log("🚀 Servidor del Agente Holded listo en http://localhost:3300");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();