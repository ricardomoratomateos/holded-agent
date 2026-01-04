import Fastify from "fastify";
import cors from "@fastify/cors";
import { createAgent } from "./agent/graph.js";
import { HumanMessage } from "@langchain/core/messages";

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
  const { message, threadId, holdedKey } = request.body as any;
  const agent = await createAgent(holdedKey);
  const config = { configurable: { thread_id: threadId } };

  // Configuración manual de cabeceras para Server-Sent Events (SSE)
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const stream = await agent.stream({
      messages: [new HumanMessage(message)]
    }, { ...config, streamMode: "messages" });

    for await (const [msg, metadata] of stream) {
      // Extraemos el texto de forma segura, ya sea string o bloques de Claude
      let textContent = "";
      
      if (typeof msg.content === 'string') {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join("");
      }

      // Solo enviamos si hay texto y proviene del nodo del agente
      if (textContent && metadata.langgraph_node === "agent") {
        const payload = JSON.stringify({
          content: textContent,
          status: "streaming"
        });
        // El formato "data: ...\n\n" es obligatorio para que el navegador lo procese
        reply.raw.write(`data: ${payload}\n\n`);
      }
    }

    // Al finalizar el stream, comprobamos si LangGraph se detuvo por una acción sensible
    const state = await agent.getState(config);
    const isPaused = state.next.includes("sensitive_tools");

    const finalPayload = JSON.stringify({ 
      status: isPaused ? "pending_approval" : "success",
      final: true 
    });
    
    reply.raw.write(`data: ${finalPayload}\n\n`);
    reply.raw.end();

  } catch (error) {
    server.log.error(error);
    const errorPayload = JSON.stringify({ error: "Stream error", status: "error" });
    reply.raw.write(`data: ${errorPayload}\n\n`);
    reply.raw.end();
  }
});

/**
 * ENDPOINT DE APROBACIÓN: Reanuda el hilo pausado
 */
server.post("/approve", async (request, reply) => {
  const { threadId, holdedKey } = request.body as any;

  if (!threadId || !holdedKey) {
    return reply.code(400).send({ error: "Faltan threadId o holdedKey" });
  }

  try {
    const agent = await createAgent(holdedKey);
    const config = { configurable: { thread_id: threadId } };

    // Continuar la ejecución desde el punto de interrupción
    const result = await agent.invoke(null, config);

    return {
      status: "success",
      response: result.messages.at(-1)?.content,
      threadId
    };
  } catch (error: any) {
    server.log.error(error);
    return reply.code(500).send({ error: "Error al aprobar la acción" });
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