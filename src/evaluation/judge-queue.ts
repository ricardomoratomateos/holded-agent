import { ChatAnthropic } from "@langchain/anthropic";
import { getJudgePrompt } from "../agent/prompts/judge.js";

/**
 * Cola async para evaluaciones del Judge
 * Se ejecuta en background sin bloquear la respuesta al usuario
 */
class JudgeQueue {
  private queue: Array<{ threadId: string; trace: any }> = [];
  private processing = false;

  private judgeModel = new ChatAnthropic({
    modelName: "claude-sonnet-4-5",
    temperature: 0,
  });

  /**
   * Añadir evaluación a la cola (no bloqueante)
   */
  enqueue(threadId: string, trace: any): void {
    this.queue.push({ threadId, trace });

    // Iniciar procesamiento si no está corriendo
    if (!this.processing) {
      this.processAsync().catch(err => {
        console.error('Error en Judge queue:', err);
      });
    }
  }

  /**
   * Procesar cola de forma asíncrona
   */
  private async processAsync(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        console.log(`[JUDGE] Evaluando thread ${item.threadId}...`);
        const evaluation = await this.evaluate(item.trace);
        await this.storeEvaluation(item.threadId, evaluation);
        console.log(`[JUDGE] Evaluación completada. Score: ${evaluation.score}/10`);
      } catch (error) {
        console.error(`[JUDGE] Error evaluando ${item.threadId}:`, error);
      }
    }

    this.processing = false;
  }

  /**
   * Evaluar una traza completa
   */
  private async evaluate(trace: any): Promise<any> {
    const evaluationPrompt = `
Traza de ejecución completa:

Plan generado: ${trace.plan ? JSON.stringify(trace.plan, null, 2) : 'N/A'}

Reflexiones pre-ejecución: ${trace.reflection ? JSON.stringify(trace.reflection, null, 2) : 'N/A'}

Steps ejecutados:
${JSON.stringify(trace.executionTrace.steps, null, 2)}

Verificaciones:
${JSON.stringify(trace.verification, null, 2)}

Métricas:
- Duración total: ${trace.executionTrace.totalDuration}ms
- Tool calls: ${trace.executionTrace.toolCallsCount}
- Cache hits: ${trace.executionTrace.cacheHits}
- Errores: ${trace.executionTrace.errors.length}

Evalúa el proceso completo. Responde SOLO con JSON.
`;

    const result = await this.judgeModel.invoke([
      getJudgePrompt(),
      { role: "user", content: evaluationPrompt }
    ]);

    try {
      return JSON.parse(result.content.toString());
    } catch {
      return {
        score: 5,
        evaluation: {},
        issues: [],
        suggestions: ["Error al parsear evaluación del Judge"],
        metrics: {}
      };
    }
  }

  /**
   * Almacenar evaluación (placeholder - implementar con DB real)
   */
  private async storeEvaluation(threadId: string, evaluation: any): Promise<void> {
    // TODO: Guardar en DB (PostgreSQL, Pinecone, etc)
    // Por ahora, solo log
    console.log(`[JUDGE] Evaluación de ${threadId}:`, {
      score: evaluation.score,
      issuesCount: evaluation.issues?.length || 0,
      suggestionsCount: evaluation.suggestions?.length || 0
    });
  }

  /**
   * Obtener tamaño de la cola
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

// Singleton
export const judgeQueue = new JudgeQueue();
