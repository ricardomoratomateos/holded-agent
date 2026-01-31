import { AgentStateType } from "./state.js";
import { AIMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";

// ===== CONSTANTES =====
const MAX_CORRECTION_ATTEMPTS = 3;

// ===== EDGE FUNCTIONS =====

/**
 * Después del Supervisor, decidir si necesita planning
 * El Supervisor ya responde con "planning_agent" si detecta complejidad
 */
export function afterSupervisor(state: AgentStateType): string {
  const next = state.next?.toLowerCase();

  if (next === "off_topic") return "off_topic";
  if (next === "planning_agent") return "planning_agent";
  if (next === "analytics_agent") return "analytics_agent";

  // Por defecto, holded_agent
  return "holded_agent";
}

/**
 * Después de Planning Agent, ir al agente correspondiente
 */
export function afterPlanning(state: AgentStateType): string {
  if (!state.plan || state.plan.length === 0) {
    // No hay plan, ir directo a holded_agent
    return "holded_agent";
  }

  // Ir al primer step del plan
  const firstStep = state.plan[0];
  return firstStep.agent;
}

// ELIMINADAS: shouldReflect y afterReflection
// La validación ahora se hace mediante la herramienta validate_schema
// que el agente usa voluntariamente antes de POST/PUT

/**
 * Decide si necesita verificación después de ejecutar tools
 */
export function shouldVerify(state: AgentStateType): string {
  const lastToolResults = state.messages
    .slice(-5)
    .filter(m => m._getType() === "tool");

  if (lastToolResults.length === 0) {
    // No hay resultados de tools, volver al agente
    return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
  }

  // Verificar si hubo una operación de escritura con resourceContext
  if (state.verification.resourceContext?.id) {
    // IMPORTANTE: Si attemptCount >= 1, significa que ya intentamos verificar/corregir
    // No volver a verification (evitar bucle infinito)
    if (state.verification.attemptCount >= 1) {
      // Ya se intentó corregir, no verificar de nuevo
      return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
    }

    return "verification_agent"; // Primera vez, verificar recurso creado/modificado
  }

  // No hay nada que verificar, volver al agente para responder
  return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
}

/**
 * Decide qué hacer después de Verification
 */
export function afterVerification(state: AgentStateType): string {
  const { status, discrepancies, attemptCount } = state.verification;

  if (status === "verified") {
    // ✅ Todo OK, responder al usuario
    return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
  }

  if (status === "failed") {
    // ❌ Hay discrepancias

    // IMPORTANTE: Solo 1 intento de corrección permitido
    if (attemptCount >= 1) {
      // Ya intentamos corregir una vez, no seguir en bucle
      // Volver al agente para informar al usuario
      return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
    }

    if (discrepancies.length > 0) {
      return "analyzer_agent"; // Primera vez, analizar qué está mal
    }
  }

  // Fallback
  return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
}

/**
 * Después de Analyzer, siempre ir a Corrector
 */
export function afterAnalysis(state: AgentStateType): string {
  return "corrector_agent";
}

/**
 * Después de Corrector, re-verificar
 */
export function afterCorrection(state: AgentStateType): string {
  // Volver a verificar (el contador ya se incrementó en corrector)
  return "verification_agent";
}
