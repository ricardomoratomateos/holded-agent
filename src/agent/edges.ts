import { AgentStateType } from "./state.js";
import { AIMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";

// ===== EDGE FUNCTIONS =====

/**
 * Después del Supervisor, decidir si necesita planning
 * El Supervisor ya responde con "planning_agent" si detecta complejidad
 */
export function afterSupervisor(state: AgentStateType): string {
  // Extraer solo la primera palabra/línea (ignorar justificaciones extra)
  const rawNext = state.next?.toLowerCase() || "";
  const next = rawNext.split('\n')[0].trim(); // Primera línea solamente

  if (next === "off_topic") return "off_topic";
  if (next === "planning_agent") return "planning_agent";
  if (next === "analytics_agent") return "analytics_agent";

  // Por defecto, holded_agent
  return "holded_agent";
}

/**
 * Después de Planning Agent, ir al agente apropiado
 */
export function afterPlanning(state: AgentStateType): string {
  if (!state.plan || state.plan.length === 0) {
    // No hay plan, ir directo a holded_agent (flujo normal)
    return "holded_agent";
  }

  // Hay plan - ver qué agente debe ejecutarlo
  // Usamos el primer step para decidir (normalmente todos los steps van al mismo agente)
  const firstStep = state.plan[0];
  return firstStep.agent; // "holded_agent" o "analytics_agent"
}

// ELIMINADAS: shouldReflect y afterReflection
// La validación ahora se hace mediante la herramienta validate_schema
// que el agente usa voluntariamente antes de POST/PUT

/**
 * Decide si necesita verificación después de ejecutar tools
 */
export function shouldVerify(state: AgentStateType): string {
  // Si la verificación está deshabilitada por el usuario, skip directamente
  if (!state.enableVerification) {
    return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
  }

  // Verificar si hubo una operación de escritura con resourceContext
  // SOLO verificar si el status es "pending" (recién creado/actualizado)
  if (state.verification.resourceContext?.id && state.verification.status === "pending") {
    // IMPORTANTE: Si attemptCount >= 1, significa que ya intentamos verificar/corregir
    // No volver a verification (evitar bucle infinito)
    if (state.verification.attemptCount >= 1) {
      // Ya se intentó corregir, no verificar de nuevo
      // Volver al agente para que continúe o responda
      return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
    }

    return "verification_agent"; // Primera vez, verificar recurso creado/modificado
  }

  // No hay nada que verificar - volver al agente para que continúe trabajando
  // El agente decidirá si hacer más tool_calls o responder (terminar)
  return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
}

/**
 * Decide qué hacer después de Verification
 */
export function afterVerification(state: AgentStateType): string {
  const { status, discrepancies, attemptCount } = state.verification;

  if (status === "verified") {
    // ✅ Todo OK - volver al agente para que continúe
    return state.next === "analytics_agent" ? "analytics_agent" : "holded_agent";
  }

  if (status === "failed") {
    // ❌ Hay discrepancias

    // IMPORTANTE: Solo 1 intento de corrección permitido
    if (attemptCount >= 1) {
      // Ya intentamos corregir una vez, no seguir en bucle
      // Volver al agente para informar al usuario o continuar
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
