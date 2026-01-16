import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Conecta con el servidor MCP de Playwright (oficial de Microsoft)
 * para capacidades de navegación web y automatización de navegador.
 *
 * El MCP de Playwright permite:
 * - Navegar a URLs (playwright_navigate)
 * - Interactuar con elementos (playwright_click, playwright_fill)
 * - Extraer información (playwright_evaluate)
 * - Capturar pantallas (playwright_screenshot)
 */
export async function getBrowserTools() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      "@playwright/mcp@latest",
      "--headless",
      "--isolated"
    ],
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: "/root/.cache/ms-playwright"
    }
  });

  const client = new Client({
    name: "holded-browser-agent",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  const { tools } = await client.listTools();

  return tools.map(t => ({
    name: t.name,
    description: t.description ?? "Herramienta de automatización de navegador con Playwright.",
    schema: t.inputSchema,
    execute: async (args: any) => {
      try {
        const response = await client.callTool({
          name: t.name,
          arguments: args
        });
        return response.content;
      } catch (error) {
        console.error(`Error en herramienta Playwright MCP ${t.name}:`, error);
        throw error;
      }
    }
  }));
}
