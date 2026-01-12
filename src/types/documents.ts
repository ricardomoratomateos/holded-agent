/**
 * Estructura de datos extraída de documentos (facturas, recibos, etc.)
 */
export interface DocumentExtraction {
  merchant: string;           // Nombre del comercio/proveedor/cliente
  amount: number;             // Monto total
  currency: string;           // EUR, USD, etc.
  date: string;               // Formato YYYY-MM-DD
  category: string;           // food, transport, office, entertainment, etc.
  items?: string[];           // Lista de productos/servicios
  payment_method?: string;    // card, cash, transfer, etc.
}
