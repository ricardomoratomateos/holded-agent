import { ChatOpenAI } from "@langchain/openai";
import { getPlanningPrompt } from "../prompts/planning.js";
import { AgentState, PlanStep, ExecutionStep } from "../state.js";
import { HumanMessage } from "@langchain/core/messages";
import { withLLMTracing } from "../tracing.js";

// Array para acumular steps de este agente
const steps: ExecutionStep[] = [];

// Wrapear LLM con tracing
const planningModel = withLLMTracing(
  new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  }),
  "planning_agent",
  "gpt-4o-mini",
  steps
);

/**
 * Planning Agent
 * Descompone queries complejas en steps ejecutables
 */
export async function planningNode(state: typeof AgentState.State) {
  steps.length = 0; // Reset steps para esta ejecución

  // Obtener la query del usuario (últimos mensajes)
  const recentMessages = state.messages.slice(-3);
  const userQuery = recentMessages
    .filter(m => m._getType() === 'human')
    .map(m => m.content)
    .join('\n');

  const planningPrompt = `
Query del usuario:
${userQuery}

Analiza si necesita planificación o es simple. Responde SOLO con JSON.
`;

  try {
    const result = await planningModel.invoke([
      getPlanningPrompt(),
      { role: "user", content: planningPrompt }
    ]);

    let planData;
    try {
      planData = JSON.parse(result.content.toString());
    } catch {
      // Si no es JSON válido, asumir que no necesita planning
      return {
        plan: null,
        executionTrace: {
          steps: steps
        }
      };
    }

    if (!planData.plan || planData.plan.length === 0) {
      return {
        plan: null,
        executionTrace: {
          steps: steps
        }
      };
    }

    return {
      plan: planData.plan,
      currentStep: 0,
      stepStatus: {}, // Reset stepStatus cuando se genera un nuevo plan
      planStepResults: {}, // Reset planStepResults cuando se genera un nuevo plan
      executionTrace: {
        steps: steps
      }
    };

  } catch (error: any) {
    console.error('Planning error:', error);
    return {
      plan: null,
      executionTrace: {
        steps: steps,
        errors: [`Planning error: ${error.message}`]
      }
    };
  }
}
