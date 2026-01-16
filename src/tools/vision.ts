import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from '@langchain/openai';
import fs from 'fs';
import { convertPdfToImages } from './pdfProcessor.js';
import type { DocumentExtraction } from '../types/documents.js';

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  modelKwargs: {
    store: true // Prompt caching
  }
});

// Custom error types
export class VisionExtractionError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'VisionExtractionError';
  }
}

export class VisionValidationError extends Error {
  constructor(message: string, public readonly data?: any) {
    super(message);
    this.name = 'VisionValidationError';
  }
}

// Retry helper
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

async function extractExpenseFromReceipt(
  imageBase64: string
): Promise<DocumentExtraction[]> {
  const prompt = `Analiza esta imagen y extrae TODOS los gastos/transacciones que encuentres.

REGLAS CRÍTICAS:
1. Tu respuesta DEBE ser ÚNICAMENTE un array JSON válido
2. NO incluyas texto explicativo antes o después del JSON
3. NO uses markdown (sin \`\`\`json)
4. SIEMPRE devuelve un array [ ], incluso si solo hay 1 gasto
5. NUNCA devuelvas un objeto único { }

IMPORTANTE:
- Si hay múltiples transacciones (extracto bancario), devuelve todas
- Si no encuentras algún campo, usa null
- La fecha debe estar en formato YYYY-MM-DD
- El monto debe ser un número positivo (ignora signos negativos)
- Categorías válidas: food, transport, entertainment, shopping, health, utilities, other

Formato JSON requerido:
[
  {
    "merchant": "nombre del comercio",
    "amount": número positivo,
    "currency": "EUR/USD/GBP/etc",
    "date": "YYYY-MM-DD",
    "category": "food/transport/entertainment/shopping/health/utilities/other",
    "items": ["item1", "item2"] o null,
    "payment_method": "card/cash/transfer/other" o null
  }
]

RESPONDE SOLO CON EL ARRAY JSON, SIN TEXTO ADICIONAL.`;

  // Intentar con retry
  const result = await retryWithBackoff(async () => {
    const response = await model.invoke([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64,
              detail: 'high'
            }
          }
        ]
      }
    ]);

    const content = (response.content as string).trim();

    // Detectar si el modelo se niega a procesar
    const refusalPatterns = [
      /no puedo/i,
      /no puedo procesar/i,
      /no puedo analizar/i,
      /lo siento/i,
      /disculpa/i,
      /sorry/i,
      /cannot/i,
      /unable to/i
    ];

    const isRefusal = refusalPatterns.some(pattern => pattern.test(content));

    if (isRefusal && content.length < 200 && !content.includes('[')) {
      throw new VisionExtractionError(
        'El modelo se negó a procesar la imagen',
        { response: content }
      );
    }

    // Intentar extraer JSON del texto
    const firstBracket = content.indexOf('[');
    const lastBracket = content.lastIndexOf(']');
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');

    let extracted: DocumentExtraction[];
    let jsonString: string;

    // PRIORIDAD 1: Buscar array JSON
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonString = content.substring(firstBracket, lastBracket + 1);
      try {
        const parsed = JSON.parse(jsonString);

        if (!Array.isArray(parsed)) {
          extracted = [parsed];
        } else {
          extracted = parsed;
        }
      } catch (error) {
        throw new VisionExtractionError('JSON array inválido', { jsonString, error });
      }
    }
    // PRIORIDAD 2: Si solo hay objeto, envolver en array
    else if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = content.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(jsonString);
        extracted = [parsed];
      } catch (error) {
        throw new VisionExtractionError('JSON object inválido', { jsonString, error });
      }
    }
    // ERROR: No se encontró JSON
    else {
      throw new VisionExtractionError(
        'No se encontró JSON en la respuesta del modelo',
        { response: content }
      );
    }

    // Validar que extracted sea array no vacío
    if (!Array.isArray(extracted) || extracted.length === 0) {
      throw new VisionValidationError('El array de gastos está vacío', { extracted });
    }

    return extracted;
  });

  // Limpiar y validar cada gasto
  const cleaned = result.map((expense, index) => {
    // Limpiar valores "null" string a valores apropiados
    if (expense.merchant === 'null' || !expense.merchant) {
      expense.merchant = 'Desconocido';
    }
    if (expense.payment_method === 'null') {
      expense.payment_method = undefined;
    }
    // Convertir montos negativos a positivos
    if (expense.amount < 0) {
      expense.amount = Math.abs(expense.amount);
    }

    // Validar campos obligatorios
    if (!expense.merchant || !expense.amount || !expense.date || !expense.category) {
      throw new VisionValidationError(
        `Faltan campos obligatorios en el gasto ${index + 1}`,
        { expense, index }
      );
    }

    // Validar tipos
    if (typeof expense.amount !== 'number' || expense.amount <= 0) {
      throw new VisionValidationError(
        `Monto inválido en gasto ${index + 1}: debe ser número positivo`,
        { expense, amount: expense.amount }
      );
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expense.date)) {
      throw new VisionValidationError(
        `Fecha inválida en gasto ${index + 1}: debe ser YYYY-MM-DD`,
        { expense, date: expense.date }
      );
    }

    return expense;
  });

  return cleaned;
}

/**
 * Tool para analizar documentos (imágenes y PDFs) y extraer datos estructurados
 */
export const analyzeDocumentTool = tool(
  async ({ documentPath }) => {
    try {
      // Leer el archivo
      const buffer = fs.readFileSync(documentPath);
      const isPDF = documentPath.toLowerCase().endsWith('.pdf');

      let images: string[] = [];

      if (isPDF) {
        // Convertir PDF a imágenes
        images = await convertPdfToImages(buffer);
      } else {
        // Es una imagen, convertir a base64
        const mimeType = documentPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const base64 = buffer.toString('base64');
        images = [`data:${mimeType};base64,${base64}`];
      }

      // Procesar cada imagen
      const allExtractions: DocumentExtraction[] = [];
      for (const image of images) {
        const data = await extractExpenseFromReceipt(image);
        allExtractions.push(...data);
      }

      return JSON.stringify({
        success: true,
        extractedData: allExtractions,
        documentPath // Para adjuntar después a Holded
      });

    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },
  {
    name: "analyze_document",
    description: "Analiza documento (imagen/PDF) y extrae datos estructurados: merchant, amount, currency, date, items, payment_method. Usa esto cuando el usuario adjunte una factura, recibo o ticket.",
    schema: z.object({
      documentPath: z.string().describe("Ruta local al archivo de imagen o PDF a analizar")
    })
  }
);
