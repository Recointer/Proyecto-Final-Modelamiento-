import { z } from "zod";

/** Acepta coma o punto decimal. */
const aPunto = (s: string) => s.trim().replace(",", ".");

const superficie = z
  .string()
  .transform(aPunto)
  .refine((s) => /^\d{1,6}(\.\d{1,4})?$/.test(s), "Use una superficie válida, con hasta 4 decimales")
  .transform(Number)
  .refine((n) => n > 0, "La superficie debe ser mayor que cero");

const coordenada = (nombre: string, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? aPunto(v) : undefined))
    .pipe(
      z
        .string()
        .regex(/^-?\d{1,3}(\.\d{1,6})?$/, `${nombre} no válida`)
        .transform(Number)
        .refine((n) => n >= min && n <= max, `${nombre} fuera de rango (${min} a ${max})`)
        .optional(),
    );

export const predioSchema = z
  .object({
    codigo: z.string().trim().min(2, "El código debe tener al menos 2 caracteres").max(20, "Máximo 20 caracteres"),
    nombre: z.string().trim().min(1, "Ingrese el nombre del predio").max(120),
    superficieHa: superficie,
    sectorId: z.string().uuid("Seleccione un sector"),
    socioId: z.string().uuid("Seleccione el socio titular"),
    latitud: coordenada("Latitud", -90, 90),
    longitud: coordenada("Longitud", -180, 180),
  })
  .superRefine((v, ctx) => {
    // ambas coordenadas o ninguna
    if ((v.latitud === undefined) !== (v.longitud === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [v.latitud === undefined ? "latitud" : "longitud"],
        message: "Ingrese latitud y longitud juntas",
      });
    }
  });

export const filtrosPredioSchema = z.object({
  sectorId: z.string().uuid().optional(),
  socioId: z.string().uuid().optional(),
  busqueda: z.string().trim().max(120).optional(),
  estado: z.enum(["activo", "inactivo"]).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type FiltrosPredio = z.infer<typeof filtrosPredioSchema>;

export interface EntradaPredio {
  codigo: string;
  nombre: string;
  superficieHa: number;
  sectorId: string;
  socioId: string;
  latitud?: number;
  longitud?: number;
}

/**
 * Cuadro aproximado de Ecuador continental e insular. Fuera de él las coordenadas se aceptan (puede
 * haber predios cercanos a la frontera) pero se muestra un aviso.
 */
export function fueraDeEcuador(latitud: number, longitud: number): boolean {
  return !(latitud >= -5.1 && latitud <= 1.5 && longitud >= -92.5 && longitud <= -75);
}
