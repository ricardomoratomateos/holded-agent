import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Función que genera la herramienta inyectando la API Key dinámicamente.
 * Esto permite que el agente funcione para cualquier usuario que envíe su clave.
 */
export const createHoldedTool = (apiKey: string) => tool(
  async ({ method, path, data }) => {
    // Usamos la apiKey pasada por parámetro en lugar de process.env
    const url = `https://api.holded.com/api/${path.replace(/^\//, "")}`;

    const options: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "key": apiKey, 
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    };

    if (method.toUpperCase() !== "GET" && data) {
      options.body = JSON.stringify(data);
    }

    console.log(`--- Llamando a Holded (Multi-Account): ${options.method} ${url} ---`);

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.text();
        // Si hay error, se lo pasamos a Claude para que investigue con Brave
        return `Error de la API: ${response.status} - ${errorData}`;
      }

      return JSON.stringify(await response.json());
    } catch (error: any) {
      return `Error de red: ${error.message}`;
    }
  },
  {
    name: "call_holded_api",
    description: "Ejecuta una petición técnica a la API de Holded. IMPORTANTE: El path no debe empezar por 'api/'. Ejemplo: 'invoicing/v1/contacts'.",
    schema: z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      path: z.string().describe("El path del endpoint sin el prefijo /api/"),
      data: z.any().optional().describe("Objeto JSON con los datos para POST/PUT"),
    }),
  }
);