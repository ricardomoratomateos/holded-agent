import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

// Esto crea una base de datos local para que el agente no olvide las conversaciones
export const checkpointer = SqliteSaver.fromConnString(process.env.SQLITE_PATH ||"./checkpoints.sqlite");