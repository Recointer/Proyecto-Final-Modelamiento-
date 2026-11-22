import { z } from "zod";
import { juntaSchema } from "./junta";

/**
 * Parámetros propios de cada junta (RF-02). Los usan los módulos posteriores:
 * multas por inasistencia y quórum de las asambleas.
 */
export interface ParametrosJunta {
  /** Multa en USD por inasistencia a una asamblea. */
  multaAsamblea: number;
  /** Multa en USD por inasistencia a una minga. */
  multaMinga: number;
  /** Porcentaje mínimo de asistencia para el quórum (1–100). */
  quorumPorcentaje: number;
}

export const PARAMETROS_POR_DEFECTO: ParametrosJunta = {
  multaAsamblea: 0,
  multaMinga: 0,
  quorumPorcentaje: 50,
};

export const MAX_MULTA = 1000;

/** Combina lo guardado con los valores por defecto, ignorando datos inválidos. */
export function parametrosDe(crudo: unknown): ParametrosJunta {
  const c = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;
  const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);
  return {
    multaAsamblea: num(c.multaAsamblea, PARAMETROS_POR_DEFECTO.multaAsamblea),
    multaMinga: num(c.multaMinga, PARAMETROS_POR_DEFECTO.multaMinga),
    quorumPorcentaje: num(c.quorumPorcentaje, PARAMETROS_POR_DEFECTO.quorumPorcentaje),
  };
}

/** Acepta "2.5" y "2,50"; hasta 2 decimales; entre 0 y el máximo. */
const dinero = z
  .string()
  .trim()
  .transform((s) => s.replace(",", "."))
  .refine((s) => /^\d{1,4}(\.\d{1,2})?$/.test(s), "Use un monto válido, con hasta 2 decimales")
  .transform(Number)
  .refine((n) => n >= 0 && n <= MAX_MULTA, `El monto debe estar entre 0 y ${MAX_MULTA}`);

const porcentaje = z
  .string()
  .trim()
  .refine((s) => /^\d{1,3}$/.test(s), "Use un número entero")
  .transform(Number)
  .refine((n) => n >= 1 && n <= 100, "Debe estar entre 1 y 100");

export const parametrosSchema = z.object({
  multaAsamblea: dinero,
  multaMinga: dinero,
  quorumPorcentaje: porcentaje,
});

export const configuracionSchema = juntaSchema.merge(parametrosSchema);

export const sectorSchema = z.object({
  nombre: z.string().trim().min(2, "Ingrese al menos 2 caracteres").max(80),
  descripcion: z
    .string()
    .trim()
    .max(300, "Máximo 300 caracteres")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export interface EntradaConfiguracion {
  nombre: string;
  tipo: "riego" | "agua_potable" | "parroquial" | "barrial" | "otra";
  provincia: string;
  canton: string;
  parroquia: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoCorreo?: string;
  parametros: ParametrosJunta;
}

export interface EntradaSector {
  nombre: string;
  descripcion?: string;
}
