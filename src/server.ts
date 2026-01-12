import Fastify from "fastify";
import cors from "@fastify/cors";
import { createAgent } from "./agent/graph.js";
import { SSEWriter } from "./utils/sseWriter.js";
import { getChatStrategy } from "./strategies/chatStrategy.js";
import { validateChatRequest, ChatValidationError } from "./validators/chatValidator.js";

const server = Fastify({ logger: true });

// Habilitar CORS para conectar con React
await server.register(cors, { 
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
});

/**
 * ENDPOINT PRINCIPAL: Streaming de mensajes con soporte para interrupciones
 */
server.post("/chat", async (request, reply) => {
  try {
    const body = request.body as any;

    // Validar request
    validateChatRequest(body);

    // Crear agente y configuración
    const agent = await createAgent(body.holdedKey);
    const config = { configurable: { thread_id: body.threadId } };

    // Crear writer SSE
    const writer = new SSEWriter(reply);
    writer.setupHeaders();

    // Obtener estrategia según tipo de request
    // TODO: detectar isMultipart cuando añadamos soporte de archivos
    const strategy = getChatStrategy(body.action, false);

    // Ejecutar estrategia
    await strategy.handle({
      agent,
      config,
      writer,
      message: body.message
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