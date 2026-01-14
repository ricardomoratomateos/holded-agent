# Plan de Implementación: Arquitectura Multi-Agente con Supervisor

## Objetivo
Transformar el agente monolítico actual en una arquitectura supervisor multi-agente para:
- Reducir costos ~85% usando GPT-4o-mini para operaciones CRUD
- Mejorar calidad con prompts especializados
- Añadir capacidades avanzadas (reflexión, memoria, plan-execute)

---

## Arquitectura Propuesta

```
Usuario → Supervisor (Haiku - routing)
          ↓
    ┌─────┴─────────────────┐
    │                       │
Holded Agent          Analytics Agent
(GPT-4o-mini)         (Haiku + Reflexión)
    │                       │
Tools:                Tools:
- call_holded_api     - call_holded_api (solo GET)
- brave_search        - analyze_document
- analyze_document    - brave_search
```

---

## Fase 1: Supervisor + Especialización ⭐ PRIORITARIO

### Objetivo
Crear arquitectura supervisor con 2 agentes especializados + reducción de costos 85%

### Estructura de Archivos

```
src/agent/
  ├── graph.ts                    # Grafo supervisor principal (MODIFICAR)
  ├── state.ts                    # Estado compartido (MODIFICAR)
  ├── agents/
  │   ├── supervisor.ts           # CREAR - Nodo routing (Haiku)
  │   ├── holded-agent.ts         # CREAR - CRUD operations (GPT-4o-mini)
  │   └── analytics-agent.ts      # CREAR - Informes/análisis (Haiku)
  ├── prompts/
  │   ├── supervisor.ts           # CREAR - Prompt de routing
  │   ├── holded.ts               # CREAR - Prompt operaciones
  │   └── analytics.ts            # CREAR - Prompt análisis
```

### Estado Compartido

```typescript
// src/agent/state.ts
export const SupervisorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  next: Annotation<string>({ // Qué agente ejecutar
    reducer: (x, y) => y ?? x,
  }),
});
```

### Supervisor Node

```typescript
// src/agent/agents/supervisor.ts
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { SUPERVISOR_PROMPT } from "../prompts/supervisor.js";

const supervisorModel = new ChatAnthropic({
  modelName: "claude-haiku-4-5",
  temperature: 0,
});

const options = ["holded_agent", "analytics_agent", "FINISH"];

export async function supervisorNode(state: typeof SupervisorState.State) {
  const lastMessage = state.messages[state.messages.length - 1];

  const response = await supervisorModel.invoke([
    SUPERVISOR_PROMPT,
    ...state.messages,
    new HumanMessage(`Basándote en la conversación, ¿qué agente debe manejar esto? Opciones: ${options.join(", ")}`)
  ]);

  // Parse la respuesta para obtener el next agent
  const next = parseNextAgent(response.content);

  return { next };
}

function parseNextAgent(content: string): string {
  // Lógica simple: buscar el nombre del agente en la respuesta
  if (content.includes("holded_agent")) return "holded_agent";
  if (content.includes("analytics_agent")) return "analytics_agent";
  return "FINISH";
}
```

### Holded Agent Node (GPT-4o-mini)

```typescript
// src/agent/agents/holded-agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HOLDED_AGENT_PROMPT } from "../prompts/holded.js";

export function createHoldedAgentNode(tools: any[]) {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  }).bindTools(tools);

  return async (state: typeof SupervisorState.State) => {
    const response = await model.invoke([
      HOLDED_AGENT_PROMPT,
      ...state.messages
    ]);

    return {
      messages: [response],
      next: "supervisor" // Volver al supervisor
    };
  };
}

export function createHoldedToolNode(tools: any[]) {
  return new ToolNode(tools);
}
```

### Analytics Agent Node (Haiku)

```typescript
// src/agent/agents/analytics-agent.ts
import { ChatAnthropic } from "@langchain/anthropic";
import { ANALYTICS_AGENT_PROMPT } from "../prompts/analytics.js";

export function createAnalyticsAgentNode(tools: any[]) {
  const model = new ChatAnthropic({
    modelName: "claude-haiku-4-5",
    temperature: 0,
  }).bindTools(tools);

  return async (state: typeof SupervisorState.State) => {
    const response = await model.invoke([
      ANALYTICS_AGENT_PROMPT,
      ...state.messages
    ]);

    return {
      messages: [response],
      next: "supervisor"
    };
  };
}
```

### Grafo Principal

```typescript
// src/agent/graph.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { supervisorNode } from "./agents/supervisor.js";
import { createHoldedAgentNode, createHoldedToolNode } from "./agents/holded-agent.js";
import { createAnalyticsAgentNode } from "./agents/analytics-agent.js";
import { SupervisorState } from "./state.js";

export async function createAgent(holdedApiKey: string) {
  // Herramientas para Holded Agent
  const holdedTools = [
    createHoldedTool(holdedApiKey),
    analyzeDocumentTool,
    ...formattedMcpTools
  ];

  // Herramientas para Analytics Agent (solo lectura)
  const analyticsTools = [
    createHoldedTool(holdedApiKey, { readOnly: true }),
    ...formattedMcpTools
  ];

  const workflow = new StateGraph(SupervisorState)
    .addNode("supervisor", supervisorNode)
    .addNode("holded_agent", createHoldedAgentNode(holdedTools))
    .addNode("holded_tools", createHoldedToolNode(holdedTools))
    .addNode("analytics_agent", createAnalyticsAgentNode(analyticsTools))
    .addNode("analytics_tools", new ToolNode(analyticsTools))

    // Flujo principal
    .addEdge(START, "supervisor")

    // Supervisor decide qué agente usar
    .addConditionalEdges("supervisor", (state) => state.next)

    // Holded Agent: ejecuta herramientas si es necesario
    .addConditionalEdges("holded_agent", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.tool_calls?.length) return "holded_tools";
      return "supervisor";
    })
    .addEdge("holded_tools", "holded_agent")

    // Analytics Agent: ejecuta herramientas si es necesario
    .addConditionalEdges("analytics_agent", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.tool_calls?.length) return "analytics_tools";
      return "supervisor";
    })
    .addEdge("analytics_tools", "analytics_agent");

  return workflow.compile({ checkpointer });
}
```

### Prompts

```typescript
// src/agent/prompts/supervisor.ts
export const SUPERVISOR_PROMPT = new SystemMessage(`
Eres un supervisor que enruta peticiones a agentes especializados.

AGENTES DISPONIBLES:
1. holded_agent - Para operaciones CRUD en Holded (crear, actualizar, consultar datos)
2. analytics_agent - Para análisis, informes, resúmenes, estadísticas

REGLAS:
- Si el usuario pide crear/modificar/consultar datos → holded_agent
- Si el usuario pide analizar/resumir/reportar → analytics_agent
- Si ya terminaste → FINISH

Responde SOLO con el nombre del agente: holded_agent, analytics_agent, o FINISH
`);

// src/agent/prompts/holded.ts
export const HOLDED_AGENT_PROMPT = new SystemMessage(`
Eres un agente especializado en operaciones CRUD de Holded.

TU TRABAJO:
- Consultar datos de Holded (contactos, facturas, documentos)
- Crear nuevos registros (facturas, contactos, etc.)
- Actualizar/eliminar registros existentes
- Procesar documentos adjuntos (PDFs, imágenes)
- Buscar documentación técnica cuando necesites información de endpoints

REGLAS DE APROBACIÓN:
- ANTES de cualquier POST/PUT/DELETE, PREGUNTA al usuario si desea proceder
- Muestra los datos que vas a enviar
- Espera confirmación explícita

NO hagas análisis complejos ni generes informes, eso es trabajo del analytics_agent.
`);

// src/agent/prompts/analytics.ts
export const ANALYTICS_AGENT_PROMPT = new SystemMessage(`
Eres un agente especializado en análisis y reportes de datos de Holded.

TU TRABAJO:
- Analizar tendencias de ventas, gastos, clientes
- Generar resúmenes e informes
- Responder preguntas analíticas ("¿Quiénes son mis mejores clientes?")
- Crear visualizaciones de datos (descripciones textuales)
- Buscar información contextual cuando sea necesario

IMPORTANTE:
- Solo tienes acceso de LECTURA a la API de Holded
- NO puedes crear/modificar datos
- Si el usuario pide crear algo, di "Eso lo debe hacer holded_agent"
`);
```

### Modificaciones en call_holded_api

```typescript
// src/tools/holded.ts - Añadir opción readOnly
export const createHoldedTool = (apiKey: string, options?: { readOnly?: boolean }) => {
  return tool(
    async ({ method, path, data, filePath }) => {
      // Si está en modo readOnly, bloquear operaciones de escritura
      if (options?.readOnly && !["GET", "get"].includes(method)) {
        throw new Error("Analytics agent only has read-only access. Use holded_agent for write operations.");
      }

      // ... resto del código actual
    },
    // ... schema
  );
};
```

### Testing Manual

```bash
# Test 1: Operación CRUD simple
Usuario: "Dame mis contactos"
Esperado: supervisor → holded_agent → llama API → responde

# Test 2: Análisis
Usuario: "¿Quiénes son mis 3 mejores clientes?"
Esperado: supervisor → analytics_agent → consulta API → analiza → responde

# Test 3: Operación con aprobación
Usuario: "Crea un contacto para Juan Pérez"
Esperado: supervisor → holded_agent → pregunta confirmación → crea

# Test 4: Procesamiento de documento
Usuario: "Analiza esta factura" + [PDF]
Esperado: supervisor → holded_agent → analyze_document → pregunta tipo → crea
```

---

## Fase 2: Reflexión en Analytics Agent

### Objetivo
Mejorar calidad de informes con auto-reflexión

### Implementación

```typescript
// src/agent/agents/analytics-agent.ts (actualizar)
const analyticsGraph = new StateGraph(AnalyticsState)
  .addNode("generate", generateReportNode)
  .addNode("reflect", reflectNode)
  .addEdge(START, "generate")
  .addConditionalEdges("reflect", (state) => {
    if (state.qualityScore > 0.8) return END;
    if (state.iterations > 2) return END; // Max 3 intentos
    return "generate";
  })
  .addEdge("generate", "reflect");
```

### Nodo de Reflexión

```typescript
async function reflectNode(state: AnalyticsState) {
  const reflection = await model.invoke([
    new SystemMessage("Evalúa este informe. ¿Está completo? ¿Tiene sentido? ¿Falta algo?"),
    new HumanMessage(state.report)
  ]);

  const score = calculateQualityScore(reflection.content);
  const feedback = extractFeedback(reflection.content);

  return {
    qualityScore: score,
    feedback,
    iterations: state.iterations + 1
  };
}
```

### Cuándo usar
- Informes financieros
- Análisis de tendencias
- Resúmenes ejecutivos
- Respuestas a "¿Por qué...?"

---

## Fase 3: Memoria Semántica

### Objetivo
Recordar preferencias y contexto histórico del usuario

### Dependencias

```bash
npm install @langchain/community @langchain/openai chromadb
```

### Implementación

```typescript
// src/memory/semantic-memory.ts
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

export class SemanticMemory {
  private vectorStore: Chroma;

  async init() {
    this.vectorStore = await Chroma.fromExistingCollection(
      new OpenAIEmbeddings({ modelName: "text-embedding-3-small" }),
      { collectionName: "holded_memory" }
    );
  }

  async remember(query: string, k = 3) {
    const results = await this.vectorStore.similaritySearch(query, k);
    return results.map(r => r.pageContent);
  }

  async store(content: string, metadata: any) {
    await this.vectorStore.addDocuments([{
      pageContent: content,
      metadata
    }]);
  }
}
```

### Integración en Supervisor

```typescript
// Al inicio de cada request
const relevantMemories = await memory.remember(userMessage);

const contextMessage = new SystemMessage(
  `Contexto relevante de conversaciones pasadas:\n${relevantMemories.join("\n")}`
);

// Añadir al prompt del agente
```

### Qué guardar
- Preferencias: "Este usuario siempre usa EUR"
- Decisiones: "Rechazó crear factura X porque..."
- Patrones: "Suele pedir informes los lunes"
- Contexto: "Su negocio es de consultoría IT"

---

## Fase 4: Plan-and-Execute (Operaciones Batch)

### Objetivo
Manejar tareas complejas multi-paso con planificación explícita

### Cuándo activar
Supervisor detecta keywords:
- "importa", "migra", "batch", "múltiples", "todos los..."
- Usuario adjunta Excel/CSV con muchos registros
- Operación requiere >5 pasos

### Implementación

```typescript
// src/agent/agents/planner-agent.ts
const planExecuteGraph = new StateGraph(PlanExecuteState)
  .addNode("planner", plannerNode)
  .addNode("executor", executorNode)
  .addNode("reviewer", reviewerNode)
  .addEdge(START, "planner")
  .addEdge("planner", "executor")
  .addConditionalEdges("reviewer", (state) => {
    if (state.allStepsComplete) return END;
    return "planner"; // Re-plan si falló algo
  })
  .addEdge("executor", "reviewer");
```

### Planner Node

```typescript
async function plannerNode(state: PlanExecuteState) {
  const response = await model.invoke([
    new SystemMessage("Crea un plan paso a paso detallado para esta tarea"),
    ...state.messages
  ]);

  const plan = parsePlan(response.content); // ["Paso 1: ...", "Paso 2: ..."]

  return { plan, currentStep: 0 };
}
```

### Executor Node

```typescript
async function executorNode(state: PlanExecuteState) {
  const currentStep = state.plan[state.currentStep];

  // Ejecutar el paso usando holded_agent
  const result = await executeStep(currentStep);

  return {
    results: [...state.results, result],
    currentStep: state.currentStep + 1
  };
}
```

### Ejemplo

```
Usuario: "Importa estos 50 contactos del Excel"

Plan:
1. Leer archivo Excel
2. Validar formato de cada fila
3. Verificar que no existan duplicados en Holded
4. Crear contactos nuevos (batch de 10)
5. Reportar éxitos y fallos

Executor:
✅ Paso 1: Leídos 50 contactos
✅ Paso 2: 48 válidos, 2 con errores
✅ Paso 3: 12 ya existen, 36 nuevos
⏳ Paso 4: Creando batch 1/4...
```

---

## Costos Estimados

### Actual (Monolítico con Haiku)
- Haiku: $1/M input, $5/M output
- Request típico: 2K input + 500 output
- Costo por request: ~$0.003

### Propuesta (Multi-agente)

#### Operación CRUD (80% del tráfico)
- Supervisor (Haiku): 1K input → $0.001
- Holded Agent (GPT-4o-mini): 2K input + 500 output → $0.0003 + $0.0003 = $0.0006
- **Total: $0.0016 (~50% reducción)**

#### Informe Analítico (20% del tráfico)
- Supervisor (Haiku): 1K input → $0.001
- Analytics (Haiku con reflexión): 3K input + 1K output → $0.003 + $0.005 = $0.008
- **Total: $0.009 (~3x más caro, pero solo 20% del tráfico)**

#### Ahorro total estimado: **~30-40%** en costos globales

---

## Métricas de Éxito

### Fase 1
- ✅ Routing correcto >95% de las veces
- ✅ Reducción de costos >30%
- ✅ Tiempo de respuesta <2s para operaciones CRUD
- ✅ Sin regresión en calidad de respuestas

### Fase 2
- ✅ Informes más completos (+20% de longitud)
- ✅ Menos respuestas ambiguas (-50%)

### Fase 3
- ✅ Reducción de preguntas repetidas (-60%)
- ✅ Respuestas más personalizadas

### Fase 4
- ✅ Operaciones batch exitosas >90%
- ✅ Usuario ve progreso en tiempo real

---

## Próximos Pasos

1. **Crear estructura de carpetas** para agentes y prompts
2. **Implementar SupervisorState** con campo `next`
3. **Migrar prompts actuales** a archivos separados
4. **Implementar supervisor node** con routing básico
5. **Crear holded-agent node** con GPT-4o-mini
6. **Testing manual** de los 4 casos de prueba
7. **Deploy y monitoreo** de costos reales

---

## Notas Técnicas

### Handling de Errores
- Si un agente falla, supervisor debe intentar con otro agente
- Max 3 intentos antes de reportar error al usuario

### State Management
- Estado compartido entre todos los nodos
- Cada agente añade sus mensajes al array
- Supervisor lee último mensaje para decidir routing

### Tool Calling
- Cada agente mantiene su propio loop de tool calling
- Solo vuelve a supervisor cuando termina completamente

### Streaming
- Mantener SSE streaming actual
- Cada nodo puede emitir eventos de progreso
- Frontend recibe eventos de múltiples agentes
