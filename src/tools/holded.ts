import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from 'fs';
import * as pathModule from 'path';

/**
 * Función que genera la herramienta inyectando la API Key dinámicamente.
 * Esto permite que el agente funcione para cualquier usuario que envíe su clave.
 */
export const createHoldedTool = (apiKey: string, toolOptions?: { readOnly?: boolean }) => tool(
  async ({ method, path, data, filePath }) => {
    // Si está en modo readOnly, bloquear operaciones de escritura
    if (toolOptions?.readOnly && !["GET"].includes(method.toUpperCase())) {
      return "Error: El agente analista solo tiene acceso de LECTURA. Para realizar operaciones de creación, actualización o borrado, solicita al 'holded_agent' que lo haga.";
    }

    // Usamos la apiKey pasada por parámetro en lugar de process.env
    const url = `https://api.holded.com/api/invoicing/v1/${path.replace(/^\//, "")}`;

    let options: RequestInit;

    // Si hay filePath, usar multipart/form-data
    if (filePath) {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = pathModule.basename(filePath);

      formData.append('file', fileBuffer, fileName);

      options = {
        method: method.toUpperCase(),
        headers: {
          "key": apiKey,
          ...formData.getHeaders()
        },
        body: formData as any
      };
    } else {
      // Request JSON normal
      options = {
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
    }

    console.log(`--- Llamando a Holded (Multi-Account): ${options.method} ${url} ---`);
    if (options.body && typeof options.body === 'string') {
      console.log('📤 Request Body:', options.body.substring(0, 1000));
    }

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();

      if (!response.ok) {
        console.log(`❌ Error ${response.status}:`, responseText.substring(0, 500));
        // Si hay error, se lo pasamos a Claude para que investigue con Brave
        return `Error de la API: ${response.status} - ${responseText}`;
      }

      console.log('✅ Respuesta exitosa:', responseText);
      return responseText;
    } catch (error: any) {
      return `Error de red: ${error.message}`;
    }
  },
  {
    name: "call_holded_api",
    description: "Ejecuta una petición a la API de Holded (Invoicing v1). Ejemplos de path: 'contacts', 'documents/invoice', 'products'.",
    schema: z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      path: z.string().describe("Path del endpoint (sin prefijos). Ej: 'contacts', 'documents/purchase', 'products/{id}'"),
      data: z.any().optional().describe("Objeto JSON con los datos para POST/PUT"),
      filePath: z.string().optional().describe("Ruta local al archivo para adjuntar (para endpoints que aceptan archivos)"),
    }),
  }
);