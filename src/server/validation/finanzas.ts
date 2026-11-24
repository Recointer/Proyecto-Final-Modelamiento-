import { z } from "zod";
import { aCentavos, deCentavos } from "@/lib/dinero";
import { esFechaFutura } from "@/lib/fechas";

export const TIPOS_CONCEPTO = ["cuota", "servicio"] as const;
export const ETIQUETA_TIPO_CONCEPTO: Record<string, string> = { cuota: "Cuota", servicio: "Servicio", multa: "Multa" };

export const FORMAS_PAGO = ["efectivo", "transferencia", "deposito"] as const;
export const ETIQUETA_FORMA_PAGO: Record<(typeof FORMAS_PAGO)[number], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  deposito: "Depósito",
};

export const CATEGORIAS_EGRESO = ["compras", "trabajos", "honorarios", "tasas", "otros"] as const;
export const ETIQUETA_CATEGORIA: Record<(typeof CATEGORIAS_EGRESO)[number], string> = {
  compras: "Compras",
  trabajos: "Trabajos",
  honorarios: "Honorarios",
  tasas: "Tasas",
  otros: "Otros",
};

export const ETIQUETA_ESTADO_CARGO: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  pagado: "Pagado",
  anulado: "Anulado",
};

/** Importe de texto → "12.50". Acepta coma o punto, hasta 2 decimales. */
const importe = (min: "positivo" | "cero") =>
  z
    .string()
    .trim()
    .min(1, "Ingrese el monto")
    .transform((t, ctx) => {
      const c = aCentavos(t);
      if (c === null) {
        ctx.addIssue({ code: "custom", message: "Use un monto válido, con hasta 2 decimales" });
        return z.NEVER;
      }
      if (min === "positivo" && c <= 0) {
        ctx.addIssue({ code: "custom", message: "El monto debe ser mayor que cero" });
        return z.NEVER;
      }
      return deCentavos(c);
    });

export const montoPositivo = importe("positivo");
export const montoMinimoCero = importe("cero");

const fechaIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingrese una fecha válida")
  .refine((f) => !Number.isNaN(new Date(`${f}T00:00:00Z`).getTime()) && new Date(`${f}T00:00:00Z`).toISOString().startsWith(f), "Ingrese una fecha válida");

/** Fecha que no puede ser posterior a hoy (pagos y egresos). */
const fechaNoFutura = fechaIso.refine((f) => !esFechaFutura(f), "La fecha no puede ser posterior a hoy");

const anio = z.coerce.number().int("Ingrese un año válido").min(2000, "Ingrese un año válido").max(2100, "Ingrese un año válido");
const motivo = z.string().trim().min(3, "Indique el motivo").max(300, "El motivo admite hasta 300 caracteres");

export const conceptoSchema = z.object({
  nombre: z.string().trim().min(1, "Ingrese el nombre del concepto").max(100),
  tipo: z.enum(TIPOS_CONCEPTO, { message: "Seleccione el tipo" }),
  montoDefecto: montoMinimoCero,
});

export const emisionSchema = z
  .object({
    conceptoId: z.string().uuid("Seleccione el concepto"),
    anio,
    alcance: z.enum(["todos", "sector", "socio"], { message: "Seleccione a quién se emite" }),
    sectorId: z.string().optional(),
    socioId: z.string().optional(),
    monto: z.string().trim().optional(),
    vence: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.alcance === "sector" && !z.string().uuid().safeParse(v.sectorId).success) {
      ctx.addIssue({ code: "custom", path: ["sectorId"], message: "Seleccione el sector" });
    }
    if (v.alcance === "socio" && !z.string().uuid().safeParse(v.socioId).success) {
      ctx.addIssue({ code: "custom", path: ["socioId"], message: "Seleccione el socio" });
    }
    if (v.monto && !montoPositivo.safeParse(v.monto).success) {
      ctx.addIssue({ code: "custom", path: ["monto"], message: "Use un monto válido mayor que cero" });
    }
    if (v.vence && !fechaIso.safeParse(v.vence).success) {
      ctx.addIssue({ code: "custom", path: ["vence"], message: "Ingrese una fecha válida" });
    }
  });

export const pagoSchema = z.object({
  cargoId: z.string().uuid(),
  monto: montoPositivo,
  fecha: fechaNoFutura,
  forma: z.enum(FORMAS_PAGO, { message: "Seleccione la forma de pago" }),
  referencia: z.string().trim().max(80, "La referencia admite hasta 80 caracteres").optional(),
});

export const anulacionSchema = z.object({ id: z.string().uuid(), motivo });

export const egresoSchema = z.object({
  fecha: fechaNoFutura,
  categoria: z.enum(CATEGORIAS_EGRESO, { message: "Seleccione la categoría" }),
  descripcion: z.string().trim().min(3, "Describa el egreso").max(300),
  beneficiario: z.string().trim().min(2, "Ingrese el beneficiario").max(120),
  monto: montoPositivo,
});

export const materialSchema = z.object({
  nombre: z.string().trim().min(1, "Ingrese el nombre del material").max(100),
  unidad: z.string().trim().min(1, "Ingrese la unidad").max(20),
  stockInicial: montoMinimoCero,
  minimo: montoMinimoCero,
});

export const movimientoSchema = z.object({
  materialId: z.string().uuid(),
  tipo: z.enum(["entrada", "salida"], { message: "Seleccione el tipo de movimiento" }),
  cantidad: montoPositivo,
  motivo: z.string().trim().min(3, "Indique el motivo").max(200),
});

export const activoSchema = z.object({
  codigo: z.string().trim().min(2, "Mínimo 2 caracteres").max(20),
  nombre: z.string().trim().min(1, "Ingrese el nombre").max(120),
  fechaAdquisicion: fechaNoFutura,
  valor: montoMinimoCero,
  ubicacion: z.string().trim().min(1, "Ingrese la ubicación").max(120),
});

export type EntradaConcepto = z.infer<typeof conceptoSchema>;
export type EntradaEmision = z.infer<typeof emisionSchema>;
export type EntradaPago = z.infer<typeof pagoSchema>;
export type EntradaEgreso = z.infer<typeof egresoSchema>;
export type EntradaMaterial = z.infer<typeof materialSchema>;
export type EntradaMovimiento = z.infer<typeof movimientoSchema>;
export type EntradaActivo = z.infer<typeof activoSchema>;
