/** Estado que devuelven las acciones de formulario (mismo formato que el módulo administrativo). */
export interface EstadoFormulario {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
}

export interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "date" | "time" | "number" | "select" | "textarea" | "file" | "checkbox";
  requerido?: boolean;
  ayuda?: string;
  placeholder?: string;
  /** Para `select`. */
  opciones?: { valor: string; etiqueta: string }[];
  /** Texto de la opción vacía de un `select`. */
  vacio?: string;
  /** Para `date`. */
  max?: string;
  /** Para `file`. */
  accept?: string;
  inicial?: string;
  /** Pista de entrada móvil (p. ej. "decimal"). */
  modo?: "decimal" | "numeric";
}
