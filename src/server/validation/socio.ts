import { z } from "zod";
import { esFechaFutura } from "@/lib/fechas";
import { normalizarCedula, validarCedula } from "./cedula";
import { correoOpcional, telefonoOpcional } from "./usuario";

/** AAAA-MM-DD, fecha real del calendario y no posterior a hoy (hora de Ecuador). */
const fechaIngreso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use una fecha válida")
  .refine((v) => {
    // una fecha inexistente (p. ej. 2026-02-30) da Invalid Date y toISOString() lanzaría RangeError
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Use una fecha válida")
  .refine((v) => !esFechaFutura(v), "La fecha no puede ser posterior a hoy");

const nombres = z.string().trim().min(3, "Ingrese los nombres completos").max(120);

export const crearSocioSchema = z.object({
  cedula: z
    .string()
    .transform(normalizarCedula)
    .refine(validarCedula, "La cédula no es válida"),
  nombres,
  sectorId: z.string().uuid("Seleccione un sector"),
  telefono: telefonoOpcional,
  correo: correoOpcional,
  fechaIngreso,
});

/** La cédula no se puede modificar. */
export const editarSocioSchema = crearSocioSchema.omit({ cedula: true });

export const filtrosSocioSchema = z.object({
  busqueda: z.string().trim().max(120).optional(),
  sectorId: z.string().uuid().optional(),
  estado: z.enum(["activo", "inactivo"]).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type FiltrosSocio = z.infer<typeof filtrosSocioSchema>;

export interface EntradaCrearSocio {
  cedula: string;
  nombres: string;
  sectorId: string;
  telefono?: string;
  correo?: string;
  fechaIngreso: string;
}

export type EntradaEditarSocio = Omit<EntradaCrearSocio, "cedula">;
