import { z } from "zod";

export const TIPOS_EVENTO = ["asamblea", "minga"] as const;
export const ETIQUETA_TIPO_EVENTO: Record<(typeof TIPOS_EVENTO)[number], string> = {
  asamblea: "Asamblea",
  minga: "Minga",
};

/** AAAA-MM-DD y fecha real del calendario (los eventos pueden ser pasados o futuros). */
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use una fecha válida")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Use una fecha válida");

export const eventoSchema = z.object({
  tipo: z.enum(TIPOS_EVENTO, { message: "Seleccione el tipo de evento" }),
  titulo: z.string().trim().min(3, "Ingrese un título de al menos 3 caracteres").max(150),
  fecha,
  lugar: z.string().trim().min(1, "Indique el lugar").max(150),
});

export const anularEventoSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(5, "Indique el motivo de la anulación").max(500),
});

export const filtrosEventoSchema = z.object({
  tipo: z.enum(TIPOS_EVENTO).optional(),
  estado: z.enum(["activo", "anulado"]).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type FiltrosEvento = z.infer<typeof filtrosEventoSchema>;

export interface EntradaEvento {
  tipo: (typeof TIPOS_EVENTO)[number];
  titulo: string;
  fecha: string;
  lugar: string;
}
