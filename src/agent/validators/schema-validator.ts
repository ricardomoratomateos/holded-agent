import Ajv2020Module from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import ajvFormatsModule from 'ajv-formats';

// Workaround para ESM + TypeScript con moduleResolution: NodeNext
const Ajv2020 = (Ajv2020Module as any).default || Ajv2020Module;
const ajvFormats = (ajvFormatsModule as any).default || ajvFormatsModule;

/**
 * Tipos de issues de validación
 */
export interface ValidationIssue {
  type: 'missing_data' | 'invalid_format' | 'invalid_type' | 'constraint_violation';
  field: string;
  message: string;
  severity: 'critical' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  missingData: string[];
}

/**
 * Validador genérico basado en schemas OpenAPI
 *
 * Valida:
 * 1. Schema compliance (usando AJV)
 * 2. Regla universal de Holded: timestamps en segundos (no milisegundos)
 *
 * NO valida reglas de negocio complejas (totales, relaciones, etc)
 * Esas validaciones las hace el Verification Agent después de crear el recurso.
 */
export class SchemaValidator {
  private ajv: any;

  constructor() {
    this.ajv = new Ajv2020({
      allErrors: true, // Obtener todos los errores, no solo el primero
      strict: false,   // Permitir keywords adicionales de OpenAPI
      coerceTypes: false, // NO coercionar tipos automáticamente
      removeAdditional: false // NO remover campos adicionales
    });

    // Añadir formatos estándar (email, date-time, uri, etc)
    ajvFormats(this.ajv);
  }

  /**
   * Validar datos contra un schema OpenAPI + reglas universales de Holded
   *
   * @param data Datos a validar
   * @param schema Schema OpenAPI (requestBody schema)
   * @returns Resultado de validación
   */
  validate(data: any, schema: any): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Validación de schema OpenAPI
    if (schema) {
      const schemaIssues = this.validateSchema(data, schema);
      issues.push(...schemaIssues);
    }

    // 2. ÚNICA regla universal de Holded: timestamps en segundos
    const timestampIssues = this.validateTimestamps(data);
    issues.push(...timestampIssues);

    // 3. Extraer campos faltantes
    const missingData = issues
      .filter(i => i.type === 'missing_data')
      .map(i => i.field);

    // 4. Determinar si es válido (solo issues críticos invalidan)
    const isValid = issues.filter(i => i.severity === 'critical').length === 0;

    return {
      isValid,
      issues,
      missingData: [...new Set(missingData)] // Eliminar duplicados
    };
  }

  /**
   * Validar datos contra schema OpenAPI usando AJV
   */
  private validateSchema(data: any, schema: any): ValidationIssue[] {
    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(data);

      if (valid) {
        return [];
      }

      // Convertir errores de AJV a nuestro formato
      return (validate.errors || []).map(err => this.mapAjvError(err));

    } catch (error: any) {
      console.error('Error compilando schema:', error);
      return [{
        type: 'invalid_format',
        field: 'schema',
        message: `Error en schema: ${error.message}`,
        severity: 'warning'
      }];
    }
  }

  /**
   * Validar que timestamps estén en SEGUNDOS (10 dígitos), no milisegundos (13 dígitos)
   * Esta es una regla universal de Holded API
   */
  private validateTimestamps(data: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    this.findTimestamps(data, '', issues);
    return issues;
  }

  /**
   * Buscar recursivamente campos que parezcan timestamps y validarlos
   */
  private findTimestamps(obj: any, path: string, issues: ValidationIssue[]): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Si es array, procesar cada elemento
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.findTimestamps(item, `${path}[${index}]`, issues);
      });
      return;
    }

    // Procesar cada campo del objeto
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      // Detectar campos que típicamente son timestamps
      const timestampFields = [
        'date',
        'timestamp',
        'dueDate',
        'duedate',
        'createdAt',
        'createdat',
        'updatedAt',
        'updatedat',
        'expireDate',
        'expiredate'
      ];

      if (timestampFields.includes(key.toLowerCase())) {
        if (typeof value === 'number') {
          const digits = value.toString().length;

          // Timestamp en milisegundos (13 dígitos) es incorrecto
          if (digits > 10) {
            issues.push({
              type: 'invalid_format',
              field: fullPath,
              message: `Timestamp debe estar en SEGUNDOS (10 dígitos). Recibiste ${digits} dígitos (probablemente milisegundos). Divide entre 1000.`,
              severity: 'critical'
            });
          }
        }
      }

      // Recursivo para objetos anidados
      if (typeof value === 'object' && value !== null) {
        this.findTimestamps(value, fullPath, issues);
      }
    }
  }

  /**
   * Mapear error de AJV a nuestro formato
   */
  private mapAjvError(err: ErrorObject): ValidationIssue {
    const field = err.instancePath
      ? err.instancePath.replace(/^\//, '').replace(/\//g, '.')
      : err.params?.missingProperty || 'unknown';

    let type: ValidationIssue['type'];
    let severity: ValidationIssue['severity'] = 'critical';
    let message = err.message || 'Error de validación';

    switch (err.keyword) {
      case 'required':
        type = 'missing_data';
        message = `Campo obligatorio '${err.params.missingProperty}' no proporcionado`;
        break;

      case 'type':
        type = 'invalid_type';
        message = `Campo debe ser tipo '${err.params.type}', recibiste '${typeof err.data}'`;
        break;

      case 'format':
        type = 'invalid_format';
        message = `Formato inválido. Se esperaba '${err.params.format}'`;
        break;

      case 'enum':
        type = 'constraint_violation';
        message = `Valor debe ser uno de: ${err.params.allowedValues?.join(', ')}`;
        break;

      case 'minimum':
      case 'maximum':
      case 'minLength':
      case 'maxLength':
      case 'minItems':
      case 'maxItems':
        type = 'constraint_violation';
        severity = 'warning';
        break;

      case 'pattern':
        type = 'invalid_format';
        message = `No cumple el patrón requerido: ${err.params.pattern}`;
        break;

      case 'additionalProperties':
        type = 'constraint_violation';
        message = `Campo adicional no permitido: '${err.params.additionalProperty}'`;
        severity = 'warning';
        break;

      default:
        type = 'invalid_format';
        severity = 'warning';
    }

    return {
      type,
      field,
      message,
      severity
    };
  }
}
