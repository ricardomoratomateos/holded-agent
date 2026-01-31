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

## Paralelización de Operaciones

### Objetivo
Permitir que el agente ejecute múltiples operaciones IGUALES en paralelo (ej: "crea 3 contactos")

### Problema Actual
Los LLMs tienden a hacer tool calls **secuenciales**:
```
POST contacto 1 → esperar → POST contacto 2 → esperar → POST contacto 3
```

### Solución: Múltiples Tool Calls Simultáneos

El LLM debe hacer todos los tool calls en **una sola respuesta**:

```typescript
// Respuesta ideal del LLM:
{
  "tool_calls": [
    {
      "id": "call_1",
      "name": "call_holded_api",
      "arguments": {"method": "POST", "path": "contacts", "data": {"name": "Contact 1"}}
    },
    {
      "id": "call_2",
      "name": "call_holded_api",
      "arguments": {"method": "POST", "path": "contacts", "data": {"name": "Contact 2"}}
    },
    {
      "id": "call_3",
      "name": "call_holded_api",
      "arguments": {"method": "POST", "path": "contacts", "data": {"name": "Contact 3"}}
    }
  ]
}
```

### Implementación

**1. Añadir instrucción al prompt de holded_agent:**

```typescript
// src/agent/prompts/holded.ts
PARALELIZACIÓN:
- Si necesitas crear MÚLTIPLES recursos IGUALES (ej: 3 contactos, 5 productos), haz TODAS las llamadas en PARALELO en una sola respuesta
- NO esperes el resultado de una antes de hacer la siguiente
- Usa múltiples tool_calls simultáneos en lugar de uno a uno
- Ejemplo: Para "crea 3 contactos A, B, C" → haz 3 tool_calls de call_holded_api en paralelo

EXCEPCIONES (cuando NO paralelizar):
- Si un recurso DEPENDE del ID de otro (ej: "crea contacto y luego factura para ese contacto")
- En ese caso, ejecuta secuencialmente: contacto → esperar ID → factura con contactId
```

**2. Modificar ToolNode para ejecutar en paralelo:**

```typescript
// El ToolNode de LangGraph ya ejecuta múltiples tool_calls en paralelo por defecto
// Solo necesitamos que el LLM los genere en una sola respuesta
```

**3. Ajustar verificación para batch:**

Actualmente la verificación es 1 recurso a la vez. Para operaciones batch:

```typescript
// Opción A: Verificar 1 por 1 (actual - más lento pero más simple)
POST contacto1 → verify → POST contacto2 → verify → POST contacto3 → verify

// Opción B: Verificar en batch (futuro - más rápido pero complejo)
POST contacto1, contacto2, contacto3 (paralelo)
  ↓
GET contacto1, contacto2, contacto3 (paralelo)
  ↓
verification_agent recibe array de recursos
  ↓
verifica todos en batch
```

### Casos de Uso

**Paralelizable:**
- "Crea 3 contactos: A, B, C"
- "Crea 5 productos con precio 100€"
- "Elimina los contactos con IDs X, Y, Z"

**NO paralelizable (requiere secuencia):**
- "Crea contacto y luego factura para ese contacto" (factura necesita contactId)
- "Crea producto y añádelo a la factura" (necesita productId)
- "Actualiza el contacto que acabas de crear" (necesita ID del paso anterior)

### Ventajas

- **Velocidad:** 3 contactos en ~1s en lugar de ~3s
- **Eficiencia:** Menos roundtrips al LLM
- **Mejor UX:** Usuario ve resultados más rápido

### Limitaciones

- **Verificación:** Sigue siendo 1 por 1 (por ahora)
- **Dependencias:** El agente debe ser inteligente para detectar cuando NO paralelizar
- **Rate limits:** Holded API podría tener límites de requests simultáneos

### Testing

```bash
# Test 1: Paralelización básica
Usuario: "Crea 3 contactos: Ana, Juan, Pedro"
Esperado: 3 POST simultáneos → 3 verificaciones → respuesta

# Test 2: Secuencial (dependencia)
Usuario: "Crea contacto Luis y factura para él"
Esperado: POST contacto → verificar → POST factura con contactId → verificar

# Test 3: Mixto
Usuario: "Crea 2 contactos A y B, luego una factura para cada uno"
Esperado: 2 POST contactos (paralelo) → 2 POST facturas (paralelo)
```

---

## Verificación y Análisis en Background

### Problema Actual

Cuando se crea un recurso, el flujo es **bloqueante**:

```
POST contacto → esperar respuesta API
  ↓
GET contacto (verificar que existe)
  ↓
verification_agent (analizar si se guardó correctamente)
  ↓
[Si falla] analyzer + corrector
  ↓
Responder al usuario
```

**Latencia total:** ~3-5 segundos para una creación simple.

### Solución: Verificación Asíncrona

**Flujo propuesto:**

```
POST contacto → esperar respuesta API (1s)
  ↓
Responder al usuario INMEDIATAMENTE ✅
  ↓
[BACKGROUND] GET + verification + correction (no bloqueante)
  ↓
[Si falla] Notificar al usuario en siguiente mensaje o log
```

### Implementación

**1. Modificar shouldVerify para fork async:**

```typescript
// src/agent/edges.ts
export function shouldVerify(state: AgentStateType): string {
  if (state.verification.resourceContext?.id && state.verification.status === "pending") {

    // OPCIÓN A: Verificación en background (no bloqueante)
    if (state.asyncVerification === true) {
      // Lanzar verificación en background
      verifyInBackground(state);

      // Volver al agente inmediatamente
      return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
    }

    // OPCIÓN B: Verificación síncrona (actual - bloqueante)
    if (state.verification.attemptCount >= 1) {
      return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
    }

    return "verification_agent";
  }

  return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
}

async function verifyInBackground(state: AgentStateType) {
  // NO esperar la respuesta - fire and forget
  setTimeout(async () => {
    try {
      const result = await verificationAgent(state);

      if (result.status === "failed") {
        // Logear o notificar
        console.warn("Background verification failed:", result.discrepancies);

        // Opcional: Intentar corrección automática
        await analyzerAgent(state);
        await correctorAgent(state);

        // Re-verificar
        const finalResult = await verificationAgent(state);
        console.log("Background correction result:", finalResult.status);
      }
    } catch (error) {
      console.error("Background verification error:", error);
    }
  }, 0);
}
```

**2. Añadir campo asyncVerification al state:**

```typescript
// src/agent/state.ts
export const AgentState = Annotation.Root({
  // ... campos existentes

  asyncVerification: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false, // Por defecto síncrono (más seguro)
  }),
});
```

**3. Configurar desde el prompt/supervisor:**

```typescript
// Para operaciones CRUD simples → async true
if (operation === "create" && !hasDependencies) {
  return { asyncVerification: true };
}

// Para operaciones con plan → async false (necesitamos el resultado)
if (state.plan) {
  return { asyncVerification: false };
}
```

### Ventajas

- **Latencia percibida:** 3-5s → 1s (reducción 60-80%)
- **UX:** Usuario ve respuesta inmediata
- **Reliability:** Verificación sigue ocurriendo, solo que no bloquea

### Desventajas

- **Complejidad:** Manejo de errores async más difícil
- **Notificación:** Si falla verificación, ¿cómo notificar al usuario?
- **Debugging:** Más difícil rastrear problemas

### Cuándo usar verificación async vs sync

**Async (background) - Recomendado para:**
- ✅ Creaciones simples sin dependencias ("crea un contacto")
- ✅ Actualizaciones menores ("actualiza el email de Juan")
- ✅ Operaciones batch independientes ("crea 10 productos")

**Sync (bloqueante) - Recomendado para:**
- ⚠️ Operaciones con plan multi-paso (necesitamos el ID para siguiente step)
- ⚠️ Usuario específicamente pide confirmación ("¿se creó correctamente?")
- ⚠️ Operaciones críticas donde error NO es aceptable (facturas legales)

### Estrategia híbrida (Recomendada)

```typescript
// Por defecto: async para creaciones simples
const shouldUseAsync = (
  operation === "create" &&
  !state.plan &&
  !state.requiresStrictVerification
);

return {
  asyncVerification: shouldUseAsync
};
```

### Notificación de errores async

**Opción 1: Log silencioso (simple)**
```typescript
// Solo logear en consola, no notificar al usuario
console.warn("Resource verification failed but already responded to user");
```

**Opción 2: Notificación en próximo mensaje (mejor UX)**
```typescript
// Guardar en state
state.pendingWarnings.push("El contacto se creó pero hubo un problema menor con el campo X");

// En el siguiente mensaje del agente:
if (state.pendingWarnings.length > 0) {
  message += `\n\n⚠️ Nota: ${state.pendingWarnings.join(", ")}`;
}
```

**Opción 3: Webhook/Event (avanzado)**
```typescript
// Emitir evento SSE al frontend
emitSSE({
  type: "verification_warning",
  resourceId: "123",
  message: "Verificación falló en background"
});
```

### Implementación incremental

**Fase 1 (actual):** Verificación 100% síncrona (bloqueante) ✅
- Más seguro
- Fácil de debugear
- Garantiza que todo está correcto antes de responder

**Fase 2 (futuro):** Verificación async con flag
- Añadir `asyncVerification` flag
- Solo activar para operaciones simples
- Mantener sync para operaciones críticas

**Fase 3 (avanzado):** Verificación batch en background
- Múltiples creaciones → verificar todas en paralelo async
- Sistema de notificaciones para errores

### Métricas de éxito

- **Latencia p95:** <1.5s (vs 5s actual)
- **Tasa de verificación exitosa:** >99% (igual que sync)
- **Tasa de notificación de errores:** <1% (errores reales que requieren atención)

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
