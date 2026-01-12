/**
 * AgentStateDetector - Detecta el estado del agente (pausado o no)
 */
export class AgentStateDetector {
  static async isPaused(agent: any, config: any): Promise<boolean> {
    const state = await agent.getState(config);
    return state.next.includes("sensitive_tools");
  }
}
