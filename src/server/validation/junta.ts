import { z } from "zod";

export const TIPOS_JUNTA = ["riego", "agua_potable", "parroquial", "barrial", "otra"] as const;

export const ETIQUETA_TIPO: Record<(typeof TIPOS_JUNTA)[number], string> = {
  riego: "Junta de riego",
  agua_potable: "Junta de agua potable",
  parroquial: "Junta parroquial",
  barrial: "Comité barrial",
  otra: "Otra organización",
};

const texto = (max: number) => z.string().trim().min(1, "Campo obligatorio").max(max);
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const juntaSchema = z.object({
  nombre: texto(120),
  tipo: z.enum(TIPOS_JUNTA),
  provincia: texto(80),
  canton: texto(80),
  parroquia: texto(80),
  contactoNombre: opcional(120),
  contactoTelefono: opcional(30),
  contactoCorreo: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().email("Correo no válido").optional()),
});

export const crearJuntaSchema = juntaSchema.extend({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().regex(SLUG_RE, "Use minúsculas, números y guiones").optional()),
});

/** Entrada del servicio: los campos de contacto y el identificador son opcionales. */
export interface EntradaJunta {
  nombre: string;
  tipo: (typeof TIPOS_JUNTA)[number];
  provincia: string;
  canton: string;
  parroquia: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoCorreo?: string;
}

export interface EntradaCrearJunta extends EntradaJunta {
  slug?: string;
}

export const filtrosJuntaSchema = z.object({
  busqueda: z.string().trim().max(120).optional(),
  provincia: z.string().trim().max(80).optional(),
  canton: z.string().trim().max(80).optional(),
  parroquia: z.string().trim().max(80).optional(),
  estado: z.enum(["activa", "desactivada"]).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type FiltrosJunta = z.infer<typeof filtrosJuntaSchema>;

/** Convierte un nombre en un identificador de junta (slug). */
export function slugify(nombre: string): string {
  const s = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return s || "junta";
}
