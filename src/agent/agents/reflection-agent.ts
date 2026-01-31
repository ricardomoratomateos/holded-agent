import { AgentState, Issue } from "../state.js";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { SchemaValidator } from "../validators/schema-validator.js";

const schemaValidator = new SchemaValidator();

/**
 * Crear Reflection Agent Node con acceso a apiDocsTool
 */
export function createReflectionNode(apiDocsTool: any | null) {
  return async function reflectionNode(state: typeof AgentState.State) {
  const lastMessage = state.messages.at(-1) as AIMessage;
  const toolCalls = lastMessage?.tool_calls || [];

  if (toolCalls.length === 0) {
    return {
      reflection: {
        shouldProceed: true,
        issues: [],
        missingData: []
      }
    };
  }

  const allIssues: Issue[] = [];
  const allMissingData: string[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.name !== 'call_holded_api') continue;

    const { method, path, data } = toolCall.args as any;

    // Solo validar operaciones de escritura
    if (!['POST', 'PUT'].includes(method?.toUpperCase())) continue;

    try {
      // PASO 1: Obtener schema del endpoint usando get_api_documentation
      let requestSchema = { type: 'object' }; // Fallback si no hay apiDocsTool

      if (apiDocsTool) {
        try {
          const docsQuery = `${method} ${path} request format schema`;
          console.log(`[REFLECTION] Consultando schema: "${docsQuery}"`);

          const docsResult = await apiDocsTool.invoke({ query: docsQuery });

          // La tool retorna un JSON con { requestSchema, responseSchema, ... }
          // Parsear y usar directamente el requestSchema
          try {
            const docsJson = JSON.parse(docsResult);
            if (docsJson.requestSchema) {
              requestSchema = docsJson.requestSchema;
              console.log(`[REFLECTION] Schema obtenido. Required fields:`, (requestSchema as any).required || 'none');
            }
          } catch (parseError) {
            // Si no es JSON directo, buscar dentro de un code block
            const schemaMatch = docsResult.match(/```json\s*([\s\S]*?)```/);
            if (schemaMatch) {
              const docsJson = JSON.parse(schemaMatch[1]);
              if (docsJson.requestSchema) {
                requestSchema = docsJson.requestSchema;
                console.log(`[REFLECTION] Schema obtenido. Required fields:`, (requestSchema as any).required || 'none');
              }
            }
          }
        } catch (error: any) {
          console.warn(`[REFLECTION] No se pudo obtener schema: ${error.message}`);
          // Continuar con schema vacío
        }
      }

      // PASO 2: Validar con SchemaValidator (AJV + reglas de timestamps)
      const validation = schemaValidator.validate(data, requestSchema);
      allIssues.push(...validation.issues);
      allMissingData.push(...validation.missingData);

    } catch (error: any) {
      allIssues.push({
        type: 'invalid_format',
        field: 'validation',
        message: `Error en validación: ${error.message}`,
        severity: 'warning'
      });
    }
  }

  // Determinar si proceder basándose en issues críticos
  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const shouldProceed = criticalIssues.length === 0;

  // Si hay issues críticos, generar ToolMessages para responder a los tool_calls pendientes
  // Esto evita el error "tool_calls must be followed by tool messages"
  if (!shouldProceed) {
    const issuesSummary = criticalIssues
      .map(i => `- ${i.field}: ${i.message}`)
      .join('\n');

    // Crear ToolMessages para cada tool_call pendiente
    const toolResponses = toolCalls.map(tc =>
      new ToolMessage({
        tool_call_id: tc.id!,
        content: `⚠️ BLOQUEADO POR VALIDACIÓN:\n${issuesSummary}\n\nPor favor, corrige estos datos antes de continuar.`
      })
    );

    return {
      messages: toolResponses,
      reflection: {
        shouldProceed: false,
        issues: allIssues,
        missingData: [...new Set(allMissingData)]
      }
    };
  }

  // ✅ Validación OK - ser completamente transparente
  // No modificar messages, dejar que los tool_calls pasen al ToolNode
  console.log('[REFLECTION] ✅ Validación aprobada, pasando al ToolNode');
  return {};
  }; // Cierre de reflectionNode
} // Cierre de createReflectionNode
