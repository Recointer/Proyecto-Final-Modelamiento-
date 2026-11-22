import { z } from "zod";
import { normalizarCedula, validarCedula } from "./cedula";

const base = z.object({
  juntaId: z.string().uuid(),
  cedula: z
    .string()
    .transform(normalizarCedula)
    .refine(validarCedula, "La cédula no es válida"),
  nombres: z.string().trim().min(3, "Ingrese los nombres completos").max(120),
  correo: z.string().trim().toLowerCase().email("Correo no válido").max(160),
});

export const asignarAdministradorSchema = base;

export const cambiarAdministradorSchema = base.extend({
  motivo: z.string().trim().min(5, "Indique el motivo del cambio").max(500),
});

export interface EntradaAsignarAdministrador {
  juntaId: string;
  cedula: string;
  nombres: string;
  correo: string;
  acta: Uint8Array;
}

export interface EntradaCambiarAdministrador extends EntradaAsignarAdministrador {
  motivo: string;
}
