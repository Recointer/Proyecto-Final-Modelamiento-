import { z } from "zod";
import { esFechaFutura } from "@/lib/fechas";

export const TIPOS_CONVOCATORIA = ["asamblea", "minga"] as const;
export const ETIQUETA_TIPO_CONVOCATORIA: Record<(typeof TIPOS_CONVOCATORIA)[number], string> = {
  asamblea: "Asamblea general",
  minga: "Minga",
};

export const TIPOS_DOCUMENTO = ["acta_asamblea", "acta_directiva", "resolucion"] as const;
export const ETIQUETA_TIPO_DOCUMENTO: Record<(typeof TIPOS_DOCUMENTO)[number], string> = {
  acta_asamblea: "Acta de asamblea",
  acta_directiva: "Acta de directiva",
  resolucion: "Resolución",
};

const fechaIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingrese una fecha válida")
  .refine((f) => new Date(`${f}T00:00:00Z`).toISOString().startsWith(f), "Ingrese una fecha válida");

const hora = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use una hora válida (HH:MM)");
const motivo = z.string().trim().min(3, "Indique el motivo").max(300, "El motivo admite hasta 300 caracteres");

export const convocatoriaSchema = z.object({
  tipo: z.enum(TIPOS_CONVOCATORIA, { message: "Seleccione el tipo" }),
  titulo: z.string().trim().min(3, "Ingrese un título de al menos 3 caracteres").max(150),
  fecha: fechaIso,
  hora,
  lugar: z.string().trim().min(1, "Indique el lugar").max(150),
  ordenDia: z.string().trim().max(2000, "El orden del día admite hasta 2.000 caracteres").optional(),
  eventoId: z.string().trim().optional(),
  avisar: z.string().optional(),
});

export const documentoSchema = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO, { message: "Seleccione el tipo de documento" }),
  titulo: z.string().trim().min(3, "Ingrese un título de al menos 3 caracteres").max(150),
  fecha: fechaIso,
  descripcion: z.string().trim().max(500, "La descripción admite hasta 500 caracteres").optional(),
  publicar: z.string().optional(),
});

export const comunicacionSchema = z.object({
  institucion: z.string().trim().min(2, "Ingrese la institución").max(120),
  asunto: z.string().trim().min(3, "Ingrese el asunto").max(200),
  referencia: z.string().trim().max(60, "La referencia admite hasta 60 caracteres").optional(),
  fechaRecepcion: fechaIso.refine((f) => !esFechaFutura(f), "La fecha de recepción no puede ser posterior a hoy"),
  resumen: z.string().trim().min(1, "Ingrese un resumen").max(2000, "El resumen admite hasta 2.000 caracteres"),
  publicar: z.string().optional(),
});

export const anulacionSchema = z.object({ id: z.string().uuid(), motivo });

export const nuevoHiloSchema = z.object({
  asunto: z.string().trim().min(3, "Ingrese un asunto de al menos 3 caracteres").max(150),
  texto: z.string().trim().min(1, "Escriba el mensaje").max(2000, "El mensaje admite hasta 2.000 caracteres"),
  usuarioId: z.string().optional(),
});

export const respuestaSchema = z.object({
  hiloId: z.string().uuid(),
  texto: z.string().trim().min(1, "Escriba el mensaje").max(2000, "El mensaje admite hasta 2.000 caracteres"),
});

export type EntradaConvocatoria = z.infer<typeof convocatoriaSchema>;
export type EntradaDocumento = z.infer<typeof documentoSchema>;
export type EntradaComunicacion = z.infer<typeof comunicacionSchema>;
