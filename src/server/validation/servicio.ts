import { z } from "zod";

export const TIPOS_SERVICIO = ["agua_riego", "agua_potable", "espacio_comunal", "maquinaria", "otro"] as const;

export const ETIQUETA_TIPO_SERVICIO: Record<(typeof TIPOS_SERVICIO)[number], string> = {
  agua_riego: "Agua de riego",
  agua_potable: "Agua potable",
  espacio_comunal: "Espacio comunal",
  maquinaria: "Maquinaria",
  otro: "Otro",
};

/** 1 = lunes … 7 = domingo */
export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

const hora = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use una hora válida (HH:MM)");

export const servicioSchema = z.object({
  nombre: z.string().trim().min(1, "Ingrese el nombre del servicio").max(100),
  tipo: z.enum(TIPOS_SERVICIO, { message: "Seleccione el tipo de servicio" }),
});

export const turnoSchema = z
  .object({
    servicioId: z.string().uuid(),
    sectorId: z.string().uuid("Seleccione un sector"),
    diaSemana: z.coerce.number().int().min(1, "Seleccione el día").max(7, "Seleccione el día"),
    horaInicio: hora,
    horaFin: hora,
  })
  .superRefine((v, ctx) => {
    // HH:MM se compara bien como texto
    if (v.horaInicio && v.horaFin && v.horaFin <= v.horaInicio) {
      ctx.addIssue({ code: "custom", path: ["horaFin"], message: "La hora de fin debe ser posterior a la de inicio" });
    }
  });

export interface EntradaServicio {
  nombre: string;
  tipo: (typeof TIPOS_SERVICIO)[number];
}

export interface EntradaTurno {
  servicioId: string;
  sectorId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}
