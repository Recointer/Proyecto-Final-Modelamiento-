import { z } from "zod";
import { normalizarCedula, validarCedula } from "./cedula";

/** Roles que el Administrador de la Junta puede asignar (nunca admin_junta ni super_admin). */
export const ROLES_GESTIONABLES = ["secretario", "tesorero", "socio"] as const;
export type RolGestionable = (typeof ROLES_GESTIONABLES)[number];

export const ETIQUETA_ROL: Record<string, string> = {
  super_admin: "Super Administrador",
  admin_junta: "Administrador de la Junta",
  secretario: "Secretario/a",
  tesorero: "Tesorero/a",
  socio: "Socio",
};

const vacioAUndefined = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const correoOpcional = z
  .string()
  .max(160)
  .optional()
  .transform(vacioAUndefined)
  .pipe(z.string().toLowerCase().email("Correo no válido").optional());

export const telefonoOpcional = z
  .string()
  .max(30)
  .optional()
  .transform(vacioAUndefined)
  .pipe(z.string().regex(/^[0-9+\s()-]{7,20}$/, "Teléfono no válido").optional());

const nombres = z.string().trim().min(3, "Ingrese los nombres completos").max(120);

export const crearUsuarioSchema = z.object({
  cedula: z
    .string()
    .transform(normalizarCedula)
    .refine(validarCedula, "La cédula no es válida"),
  nombres,
  correo: correoOpcional,
  telefono: telefonoOpcional,
  rol: z.enum(ROLES_GESTIONABLES, { message: "Seleccione un rol válido" }),
});

export const editarUsuarioSchema = z.object({
  nombres,
  correo: correoOpcional,
  telefono: telefonoOpcional,
  rol: z.enum(ROLES_GESTIONABLES, { message: "Seleccione un rol válido" }).optional(),
});

export const filtrosUsuarioSchema = z.object({
  busqueda: z.string().trim().max(120).optional(),
  rol: z.enum(["admin_junta", ...ROLES_GESTIONABLES]).optional(),
  estado: z.enum(["activo", "desactivado"]).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type FiltrosUsuario = z.infer<typeof filtrosUsuarioSchema>;

export interface EntradaCrearUsuario {
  cedula: string;
  nombres: string;
  correo?: string;
  telefono?: string;
  rol: RolGestionable;
}

export interface EntradaEditarUsuario {
  nombres: string;
  correo?: string;
  telefono?: string;
  rol?: RolGestionable;
}
