import { tool } from "@langchain/core/tools";
import { z } from "zod";

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Tool para obtener rangos de fechas predefinidos
 */
export const getDateRangeTool = tool(
  async ({ period }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const dayOfWeek = now.getDay(); // 0 = domingo

    let start: Date;
    let end: Date;
    let description: string;

    switch (period) {
      case "this_week":
        // Lunes de esta semana
        const mondayThis = new Date(now);
        mondayThis.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        mondayThis.setHours(0, 0, 0, 0);
        start = mondayThis;
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        description = "Esta semana";
        break;

      case "last_week":
        const mondayLast = new Date(now);
        mondayLast.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
        mondayLast.setHours(0, 0, 0, 0);
        start = mondayLast;
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        description = "Semana pasada";
        break;

      case "this_month":
        start = new Date(year, month, 1, 0, 0, 0);
        end = new Date(year, month + 1, 0, 23, 59, 59);
        description = "Este mes";
        break;

      case "last_month":
        start = new Date(year, month - 1, 1, 0, 0, 0);
        end = new Date(year, month, 0, 23, 59, 59);
        description = "Mes pasado";
        break;

      case "this_quarter":
        const qStart = Math.floor(month / 3) * 3;
        start = new Date(year, qStart, 1, 0, 0, 0);
        end = new Date(year, qStart + 3, 0, 23, 59, 59);
        description = `Q${Math.floor(month / 3) + 1} ${year}`;
        break;

      case "last_quarter":
        const lqStart = Math.floor(month / 3) * 3 - 3;
        const lqYear = lqStart < 0 ? year - 1 : year;
        const lqMonth = lqStart < 0 ? lqStart + 12 : lqStart;
        start = new Date(lqYear, lqMonth, 1, 0, 0, 0);
        end = new Date(lqYear, lqMonth + 3, 0, 23, 59, 59);
        description = `Q${Math.floor(lqMonth / 3) + 1} ${lqYear}`;
        break;

      case "this_year":
        start = new Date(year, 0, 1, 0, 0, 0);
        end = new Date(year, 11, 31, 23, 59, 59);
        description = `Año ${year}`;
        break;

      case "last_year":
        start = new Date(year - 1, 0, 1, 0, 0, 0);
        end = new Date(year - 1, 11, 31, 23, 59, 59);
        description = `Año ${year - 1}`;
        break;

      default:
        return JSON.stringify({ error: "Periodo no válido" });
    }

    return JSON.stringify({
      period,
      description,
      start: { date: formatDate(start), timestamp: Math.floor(start.getTime() / 1000) },
      end: { date: formatDate(end), timestamp: Math.floor(end.getTime() / 1000) }
    });
  },
  {
    name: "get_date_range",
    description: `Obtiene timestamps para periodos comunes.

Periodos:
- "this_week" / "last_week" → esta/la semana pasada
- "this_month" / "last_month" → este/el mes pasado
- "this_quarter" / "last_quarter" → este/el trimestre pasado
- "this_year" / "last_year" → este/el año pasado`,
    schema: z.object({
      period: z.enum(["this_week", "last_week", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year"]).describe("Periodo")
    })
  }
);

/**
 * Tool para calcular "últimos N días"
 */
export const getLastNDaysTool = tool(
  async ({ days }) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(now.getDate() - days);
    start.setHours(0, 0, 0, 0);

    return JSON.stringify({
      days,
      description: `Últimos ${days} días`,
      start: { date: formatDate(start), timestamp: Math.floor(start.getTime() / 1000) },
      end: { date: formatDate(end), timestamp: Math.floor(end.getTime() / 1000) }
    });
  },
  {
    name: "get_last_n_days",
    description: `Calcula el rango de fechas para los "últimos N días" desde hoy.

Ejemplos:
- get_last_n_days({ days: 7 }) → últimos 7 días
- get_last_n_days({ days: 15 }) → últimos 15 días
- get_last_n_days({ days: 30 }) → últimos 30 días

USA ESTA TOOL cuando el usuario pida "últimos X días", NO uses get_date_range("last_month").`,
    schema: z.object({
      days: z.number().describe("Número de días hacia atrás desde hoy")
    })
  }
);

/**
 * Tool simple para convertir fecha a timestamp
 */
export const getTimestampTool = tool(
  async ({ date }) => {
    // Parsear fecha en formato DD/MM/YYYY o DD-MM-YYYY
    const parts = date.split(/[\/\-]/);

    if (parts.length !== 3) {
      return JSON.stringify({ error: "Formato inválido. Usa DD/MM/YYYY" });
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return JSON.stringify({ error: "Fecha inválida" });
    }

    const dateObj = new Date(year, month, day, 0, 0, 0);
    const timestamp = Math.floor(dateObj.getTime() / 1000);

    return JSON.stringify({
      date,
      timestamp,
      iso: dateObj.toISOString()
    });
  },
  {
    name: "get_timestamp",
    description: `Convierte una fecha en formato DD/MM/YYYY a timestamp Unix (segundos).

Ejemplos:
- get_timestamp("01/01/2025") → 1735689600
- get_timestamp("31/12/2025") → 1767139200
- get_timestamp("14/11/2025") → 1731538800

Usa esta herramienta cuando necesites timestamps para filtrar por fechas en la API de Holded.`,
    schema: z.object({
      date: z.string().describe("Fecha en formato DD/MM/YYYY")
    })
  }
);
