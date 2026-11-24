import { z } from "zod";

export const ESTADOS_ASISTENCIA = ["presente", "ausente", "justificado"] as const;

export const ETIQUETA_ASISTENCIA: Record<(typeof ESTADOS_ASISTENCIA)[number], string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
};

export const registroAsistenciaSchema = z.object({
  socioId: z.string().uuid(),
  estado: z.enum(ESTADOS_ASISTENCIA),
  motivo: z.string().max(300, "Máximo 300 caracteres").optional(),
});

export const guardarAsistenciaSchema = z.object({
  eventoId: z.string().uuid(),
  registros: z.array(registroAsistenciaSchema).min(1, "No hay asistencia que guardar").max(5000),
});

export interface RegistroAsistencia {
  socioId: string;
  estado: (typeof ESTADOS_ASISTENCIA)[number];
  motivo?: string;
}

export const filtrosInasistenciaSchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  socioId: z.string().uuid().optional(),
});

export type FiltrosInasistencia = z.infer<typeof filtrosInasistenciaSchema>;
