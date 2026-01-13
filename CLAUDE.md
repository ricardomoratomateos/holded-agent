# CLAUDE.md - Guía para Claude Code

Este documento contiene información para que Claude Code pueda entender y trabajar efectivamente con este proyecto.

## 📌 Resumen del Proyecto

**Holded AI Agent** es un agente conversacional que permite interactuar con la API de Holded mediante lenguaje natural. El agente puede consultar datos, procesar documentos (facturas) y realizar operaciones con aprobación manual del usuario.

## 🏗️ Arquitectura

### Stack Tecnológico

**Backend:**
- **Framework**: Fastify (servidor HTTP)
- **Agente**: LangGraph con Claude Sonnet 3.5
- **Modelo de visión**: GPT-4o-mini para análisis de documentos
- **LangChain**: Orquestación de LLMs y herramientas
- **TypeScript**: Lenguaje principal

**Frontend:**
- **Framework**: React 18 + TypeScript
- **Build tool**: Vite
- **UI Library**: assistant-ui (chat interface primitives)
- **Styling**: Tailwind CSS
- **Estado**: LocalRuntime (in-memory)

### Flujo de Datos

```
Usuario → Frontend (React) → Backend (Fastify/SSE) → LangGraph → Claude API
                                                    ↓
                                                Holded API
```

## 🔑 Conceptos Clave

### 1. LangGraph Workflow

El agente usa un grafo de estados (`src/agent/graph.ts`) con:
- **Nodo principal**: `agent` (Claude que decide qué hacer)
- **Nodo de herramientas**: `tools` (ejecuta herramientas)
- **Interrupciones**: Para operaciones sensibles que requieren aprobación

### 2. Estrategias de Chat

En `src/strategies/chatStrategy.ts` hay 3 estrategias:

- **StreamingChatStrategy**: Chat normal con streaming
- **InterruptedStreamingStrategy**: Chat con interrupciones para aprobación
- **ContinueAfterApprovalStrategy**: Continuar tras aprobación del usuario

### 3. Herramientas (Tools)

**call_holded_api** (`src/tools/holded.ts`):
- Wrapper de la API de Holded
- Maneja GET, POST, PUT, DELETE
- Soporta multipart para archivos adjuntos

**analyze_document** (`src/tools/vision.ts`):
- Usa GPT-4o-mini vision para extraer datos de facturas
- Convierte PDFs a imágenes primero
- Retorna: merchant, amount, date, items, etc.

**brave_search** (MCP):
- Búsqueda web para consultar documentación de Holded
- Solo se usa cuando el agente no sabe cómo usar la API

### 4. Server-Sent Events (SSE)

El backend usa SSE (`src/utils/sseWriter.ts`) para streaming en tiempo real:

```typescript
// Formato de eventos SSE
{
  content: "texto del agente",
  status: "streaming" | "pending_approval" | "complete" | "error",
  final: boolean,
  error?: string
}
```

### 5. Frontend Runtime Adapter

**holdedRuntime.ts**: Adapter personalizado que:
- Conecta al backend SSE
- Maneja multipart/form-data para archivos
- Acumula texto durante streaming
- Gestiona estados (streaming, complete, requires-action)

**attachmentAdapter.ts**: Maneja uploads:
- Guarda attachments en array temporal
- El runtime los lee antes de enviar
- Genera previews con URLs blob

## 📂 Estructura de Archivos Importante

```
src/
├── agent/
│   ├── graph.ts              # LangGraph workflow definition
│   └── prompts.ts            # System prompt del agente
├── strategies/
│   └── chatStrategy.ts       # Estrategias de manejo de mensajes
├── tools/
│   ├── holded.ts            # Herramienta para Holded API
│   ├── vision.ts            # Análisis de documentos con vision
│   └── pdfProcessor.ts      # Convertir PDFs a imágenes
├── utils/
│   └── sseWriter.ts         # Utilidad para SSE streaming
├── validators/
│   └── chatValidator.ts     # Validación de requests
└── server.ts                # Servidor Fastify principal

frontend/src/
├── components/
│   ├── ui/assistant-ui/
│   │   └── thread.tsx       # Componentes de chat (Thread, Composer, Messages)
│   └── Layout/
│       ├── Header.tsx       # Header con botones
│       └── SettingsModal.tsx
├── lib/
│   ├── holdedRuntime.ts     # Adapter SSE para assistant-ui
│   ├── attachmentAdapter.ts # Manejo de uploads
│   └── historyAdapter.ts    # Carga de historial
└── App.tsx                  # Componente principal
```

## 🎯 Patrones y Convenciones

### System Prompt

El agente tiene instrucciones detalladas en `src/agent/prompts.ts`:
- Siempre pedir confirmación para operaciones de escritura
- Usar brave_search solo cuando no sabe algo
- Extraer datos estructurados de documentos
- Mapear campos a formato de Holded

### Interrupciones

Las operaciones sensibles usan interrupciones:

```typescript
// En graph.ts
.addConditionalEdges("agent", (state) => {
  // Si hay tool_calls sensibles → "approval_required"
  // Si no → "__end__"
})
```

El frontend muestra un panel de aprobación cuando `status.type === "requires-action"`.

### Manejo de Archivos

1. Usuario selecciona archivo → `attachmentAdapter.add()`
2. Se guarda en array temporal `pendingAttachments`
3. Al enviar mensaje → `holdedRuntime` lee de `pendingAttachments`
4. Envía multipart al backend
5. Backend procesa y llama a `analyze_document`

### Streaming

```typescript
// En holdedRuntime.ts
yield {
  content: [{ type: "text", text: accumulatedText }],
} satisfies ChatModelRunResult;
```

Se acumula texto y se va enviando incrementalmente.

## 🐛 Problemas Comunes y Soluciones

### 1. Attachments se pierden al enviar

**Causa**: assistant-ui limpia los attachments antes de que lleguen al runtime.

**Solución**: Usar array temporal `pendingAttachments` en `attachmentAdapter.ts`.

### 2. CORS errors

**Causa**: Backend no tiene CORS configurado o frontend usa URL incorrecta.

**Solución**: Verificar `src/server.ts` tiene `@fastify/cors` y frontend usa `VITE_API_URL`.

### 3. Historial no se carga

**Causa**: LocalRuntime no soporta nativamente cargar historial inicial.

**Solución**: El historial se mantiene en el backend (LangGraph checkpoints). Frontend solo hace fetches.

### 4. Visión no extrae datos correctamente

**Causa**: Imagen de mala calidad o prompt no optimizado.

**Solución**:
- Verificar conversión PDF → imagen en `pdfProcessor.ts`
- Ajustar prompt en `vision.ts` (líneas 51-230)

### 5. El agente no respeta interrupciones

**Causa**: `sensitive_tools` no está bien configurado o el nodo de aprobación falta.

**Solución**: Revisar `graph.ts` línea 145 (lista de sensitive_tools).

## 🔧 Cómo Modificar

### Añadir nueva herramienta

1. Crear en `src/tools/nueva-herramienta.ts`:
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const miHerramienta = tool(
  async ({ param }) => {
    // Lógica aquí
    return "resultado";
  },
  {
    name: "mi_herramienta",
    description: "Descripción clara de qué hace",
    schema: z.object({
      param: z.string().describe("Descripción del parámetro")
    })
  }
);
```

2. Registrar en `graph.ts`:
```typescript
import { miHerramienta } from "./tools/nueva-herramienta.js";

const allTools = [holdedTool, miHerramienta, ...otrasTools];
```

3. Actualizar `prompts.ts` con instrucciones de cuándo usarla.

### Modificar UI del chat

Todo está en `frontend/src/components/ui/assistant-ui/thread.tsx`:
- `Thread`: Contenedor principal
- `Composer`: Input de mensajes + botón adjuntar
- `AssistantMessage`: Burbuja del asistente
- `UserMessage`: Burbuja del usuario

### Cambiar comportamiento del agente

Editar `src/agent/prompts.ts`:
- Línea 15-50: Instrucciones principales
- Línea 51-100: Ejemplos de uso
- Línea 145: Lista de operaciones sensibles

## 📚 Referencias Externas

- **LangGraph**: https://langchain-ai.github.io/langgraphjs/
- **assistant-ui**: https://www.assistant-ui.com/docs
- **Holded API**: https://developers.holded.com/reference
- **Fastify**: https://fastify.dev/

## 💡 Tips para Claude Code

1. **Siempre lee antes de modificar**: Los archivos tienen lógica compleja interconectada.

2. **Cuidado con TypeScript**: El proyecto usa `type: "module"` en package.json, usa `.js` en imports aunque sean `.ts`.

3. **Logs temporales**: Si añades logs para debug, márcalos claramente para eliminarlos después.

4. **Testing**: No hay tests automatizados aún. Testea manualmente:
   - Chat normal
   - Upload de archivo
   - Aprobación de operaciones
   - Historial

5. **Hot reload**: Ambos proyectos tienen hot reload activado. No necesitas reiniciar en desarrollo.

6. **Build para producción**:
```bash
# Backend
npm run build

# Frontend
cd frontend && npm run build
```

## 🎨 Decisiones de Diseño

### ¿Por qué assistant-ui?

- Primitives de bajo nivel muy flexibles
- Soporte nativo para attachments
- Streaming built-in
- Mejor que construir desde cero

### ¿Por qué LangGraph?

- Manejo robusto de interrupciones
- Persistencia automática de estado (checkpoints)
- Debugging con LangSmith
- Mejor que cadenas simples de LangChain

### ¿Por qué SSE en lugar de WebSockets?

- Más simple para streaming unidireccional
- No requiere mantener conexión persistente
- Funciona bien con HTTP/2

### ¿Por qué array temporal para attachments?

- assistant-ui limpia attachments antes de enviar
- Necesitábamos acceso al File object original
- Solución pragmática que funciona

## 🚨 Advertencias

1. **API Keys**: Nunca commitees `.env` al repo
2. **Uploads folder**: Añade `/uploads` a `.gitignore`
3. **Tamaño de archivos**: Límite 10MB configurado en `server.ts`
4. **Rate limits**: Holded API tiene límites, el agente debe manejarlos
5. **Seguridad**: Sanitiza nombres de archivo en uploads

---

**Última actualización**: 2026-01-12
