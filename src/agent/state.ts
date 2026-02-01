import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// ===== TIPOS AUXILIARES =====

export interface PlanStep {
  description: string;
  agent: "holded_agent" | "analytics_agent";
  estimatedToolCalls: string[];
}

export interface Issue {
  type: "missing_data" | "invalid_format" | "invalid_type" | "inconsistency" | "constraint_violation";
  field: string;
  message: string;
  severity: "critical" | "warning";
}

export interface Discrepancy {
  field: string;
  expected: any;
  actual: any;
  reason: string;
}

export interface ExecutionStep {
  timestamp: number;
  agent: string;
  tool: string;
  params: Record<string, any>;
  result: string;
  duration: number;
  cacheHit: boolean;
}

export interface ResourceContext {
  id: string;
  type: "contact" | "invoice" | "product" | "purchase" | "payment" | "document";
  operation: "create" | "update" | "delete";
  originalIntent: Record<string, any>; // Datos que el usuario quería
  apiResponse: Record<string, any>;     // Respuesta de la API
  path: string; // Path del endpoint usado
}

// ===== ESTADO EXTENDIDO =====

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,

  // Routing (ya existente)
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "supervisor",
  }),

  // NUEVO: Plan generado por Planning Agent (solo como contexto)
  plan: Annotation<PlanStep[] | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // NUEVO: Reflexión pre-ejecución
  reflection: Annotation<{
    shouldProceed: boolean;
    issues: Issue[];
    missingData: string[];
  } | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // NUEVO: Verificación post-ejecución
  verification: Annotation<{
    status: "pending" | "verified" | "failed";
    discrepancies: Discrepancy[];
    attemptCount: number;
    resourceContext: ResourceContext | null;
    analysis?: any; // Análisis del Analyzer Agent
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({
      status: "pending",
      discrepancies: [],
      attemptCount: 0,
      resourceContext: null,
    }),
  }),

  // Habilitar verificación (configurable por usuario)
  enableVerification: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false, // Por defecto desactivado para mayor velocidad
  }),

  // NUEVO: Traza de ejecución para Judge
  executionTrace: Annotation<{
    steps: ExecutionStep[];
    totalDuration: number;
    toolCallsCount: number;
    errors: string[];
    cacheHits: number;
  }>({
    reducer: (x, y) => ({
      steps: [...(x?.steps || []), ...(y?.steps || [])],
      totalDuration: (x?.totalDuration || 0) + (y?.totalDuration || 0),
      toolCallsCount: (x?.toolCallsCount || 0) + (y?.toolCallsCount || 0),
      errors: [...(x?.errors || []), ...(y?.errors || [])],
      cacheHits: (x?.cacheHits || 0) + (y?.cacheHits || 0),
    }),
    default: () => ({
      steps: [],
      totalDuration: 0,
      toolCallsCount: 0,
      errors: [],
      cacheHits: 0,
    }),
  }),

  // NUEVO: Metadata para Judge async
  sessionMetadata: Annotation<{
    userId: string;
    threadId: string;
    startTimestamp: number;
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({
      userId: "",
      threadId: "",
      startTimestamp: Date.now(),
    }),
  }),
});

export type AgentStateType = typeof AgentState.State;
