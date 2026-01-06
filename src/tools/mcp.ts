import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Conecta con el servidor MCP de Brave Search y exporta las herramientas
 * en un formato compatible con nuestra lógica de grafos.
 */
export async function getResearcherTools() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { 
        ...process.env, 
        // El servidor espera exactamente este nombre de variable
        BRAVE_API_KEY: process.env.BRAVE_SEARCH_API_KEY as string
    }
  });

  const client = new Client({
    name: "holded-researcher",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  const { tools } = await client.listTools();
  
  return tools.map(t => ({
    name: t.name,
    description: t.description ?? "Herramienta de búsqueda para documentación técnica.",
    schema: t.inputSchema,
    // La ejecución ahora es más robusta para evitar el error -32603
    execute: async (args: any) => {
        try {
            const response = await client.callTool({ 
                name: t.name, 
                arguments: args 
            });
            return response.content; 
        } catch (error) {
            console.error(`Error en herramienta MCP ${t.name}:`, error);
            throw error;
        }
    }
  }));
}