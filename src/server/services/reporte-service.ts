import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { sumarDinero } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { withTenant, type DbContext } from "../db/context";
import { cargo, conceptoCobro, pago, socio } from "../db/schema";
import { ETIQUETA_CATEGORIA, ETIQUETA_FORMA_PAGO } from "../validation/finanzas";
import { cargosParaReporte } from "./cargo-service";
import { egresosParaReporte } from "./egreso-service";
import { rangoDe, resumenFinanciero, type RangoFinanciero } from "./resumen-service";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TIPOS_REPORTE = ["ingresos", "egresos", "por-cobrar", "caja"] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const TITULO_REPORTE: Record<TipoReporte, string> = {
  ingresos: "Libro de ingresos",
  egresos: "Libro de egresos",
  "por-cobrar": "Cuentas por cobrar",
  caja: "Estado de caja",
};

export interface Reporte {
  tipo: TipoReporte;
  titulo: string;
  /** Texto del rango, p. ej. «Del 01/01/2026 al 31/12/2026». */
  periodo: string;
  columnas: { etiqueta: string; derecha?: boolean }[];
  filas: string[][];
  totales: { etiqueta: string; valor: string }[];
}

function textoPeriodo(r: RangoFinanciero): string {
  const { desde, hasta } = rangoDe(r);
  if (desde && hasta) return `Del ${formatoFecha(desde)} al ${formatoFecha(hasta)}`;
  if (desde) return `Desde el ${formatoFecha(desde)}`;
  if (hasta) return `Hasta el ${formatoFecha(hasta)}`;
  return "Todo el historial";
}

async function reporteIngresos(ctx: CtxTenant, r: RangoFinanciero): Promise<Reporte> {
  const { desde, hasta } = rangoDe(r);
  const filas = await withTenant(ctx, (tx) =>
    tx
      .select({
        numero: pago.numero,
        fecha: pago.fecha,
        socio: socio.nombres,
        cedula: socio.cedula,
        concepto: conceptoCobro.nombre,
        anio: cargo.anio,
        forma: pago.forma,
        monto: pago.monto,
      })
      .from(pago)
      .innerJoin(cargo, and(eq(cargo.id, pago.cargoId), eq(cargo.tenantId, pago.tenantId)))
      .innerJoin(conceptoCobro, and(eq(conceptoCobro.id, cargo.conceptoId), eq(conceptoCobro.tenantId, cargo.tenantId)))
      .innerJoin(socio, and(eq(socio.id, cargo.socioId), eq(socio.tenantId, cargo.tenantId)))
      .where(and(eq(pago.tenantId, ctx.tenantId), isNull(pago.anuladoEn), desde ? gte(pago.fecha, desde) : undefined, hasta ? lte(pago.fecha, hasta) : undefined))
      .orderBy(asc(pago.fecha), asc(pago.numero)),
  );
  return {
    tipo: "ingresos",
    titulo: TITULO_REPORTE.ingresos,
    periodo: textoPeriodo(r),
    columnas: [
      { etiqueta: "N.º" },
      { etiqueta: "Fecha" },
      { etiqueta: "Socio" },
      { etiqueta: "Cédula" },
      { etiqueta: "Concepto" },
      { etiqueta: "Año" },
      { etiqueta: "Forma de pago" },
      { etiqueta: "Monto (USD)", derecha: true },
    ],
    filas: filas.map((f) => [String(f.numero), formatoFecha(f.fecha), f.socio, f.cedula, f.concepto, String(f.anio), ETIQUETA_FORMA_PAGO[f.forma], f.monto]),
    totales: [{ etiqueta: "Total ingresos", valor: sumarDinero(filas.map((f) => f.monto)) }],
  };
}

async function reporteEgresos(ctx: CtxTenant, r: RangoFinanciero): Promise<Reporte> {
  const { desde, hasta } = rangoDe(r);
  const todos = await egresosParaReporte(ctx, { desde: desde ?? undefined, hasta: hasta ?? undefined });
  const filas = todos.filter((e) => !e.anulado);
  return {
    tipo: "egresos",
    titulo: TITULO_REPORTE.egresos,
    periodo: textoPeriodo(r),
    columnas: [
      { etiqueta: "Fecha" },
      { etiqueta: "Categoría" },
      { etiqueta: "Descripción" },
      { etiqueta: "Beneficiario" },
      { etiqueta: "Monto (USD)", derecha: true },
    ],
    filas: filas.map((e) => [formatoFecha(e.fecha), ETIQUETA_CATEGORIA[e.categoria], e.descripcion, e.beneficiario, e.monto]),
    totales: [{ etiqueta: "Total egresos", valor: sumarDinero(filas.map((e) => e.monto)) }],
  };
}

async function reportePorCobrar(ctx: CtxTenant, r: RangoFinanciero): Promise<Reporte> {
  const filas = await cargosParaReporte(ctx, { abiertos: true, anio: r.anio });
  return {
    tipo: "por-cobrar",
    titulo: TITULO_REPORTE["por-cobrar"],
    periodo: r.anio ? `Año ${r.anio}` : "Todos los años",
    columnas: [
      { etiqueta: "Socio" },
      { etiqueta: "Cédula" },
      { etiqueta: "Sector" },
      { etiqueta: "Concepto" },
      { etiqueta: "Año" },
      { etiqueta: "Vence" },
      { etiqueta: "Monto (USD)", derecha: true },
      { etiqueta: "Pagado (USD)", derecha: true },
      { etiqueta: "Saldo (USD)", derecha: true },
      { etiqueta: "Vencido" },
    ],
    filas: filas.map((f) => [f.socioNombres, f.socioCedula, f.sectorNombre, f.concepto, String(f.anio), f.vence ? formatoFecha(f.vence) : "—", f.monto, f.pagado, f.saldo, f.vencido ? "Sí" : "No"]),
    totales: [
      { etiqueta: "Total por cobrar", valor: sumarDinero(filas.map((f) => f.saldo)) },
      { etiqueta: "De ello, vencido", valor: sumarDinero(filas.filter((f) => f.vencido).map((f) => f.saldo)) },
    ],
  };
}

async function reporteCaja(ctx: CtxTenant, r: RangoFinanciero): Promise<Reporte> {
  const s = await resumenFinanciero(ctx, r);
  const filas: string[][] = [
    ["Ingresos cobrados", s.ingresos],
    ["Egresos", s.egresos],
    ...s.egresosPorCategoria.map((c) => [`   Egresos: ${ETIQUETA_CATEGORIA[c.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? c.categoria}`, c.total]),
    ["Total por cobrar", s.porCobrar],
    ["   De ello, vencido", s.porCobrarVencido],
  ];
  return {
    tipo: "caja",
    titulo: TITULO_REPORTE.caja,
    periodo: textoPeriodo(r),
    columnas: [{ etiqueta: "Concepto" }, { etiqueta: "Importe (USD)", derecha: true }],
    filas,
    totales: [{ etiqueta: "Saldo de caja", valor: s.caja }],
  };
}

export async function generarReporte(ctx: CtxTenant, tipo: TipoReporte, r: RangoFinanciero): Promise<Reporte> {
  if (tipo === "ingresos") return reporteIngresos(ctx, r);
  if (tipo === "egresos") return reporteEgresos(ctx, r);
  if (tipo === "por-cobrar") return reportePorCobrar(ctx, r);
  return reporteCaja(ctx, r);
}

/** Filas del CSV: encabezado, filas y totales, con los mismos importes que el detalle. */
export function filasCsv(rep: Reporte): string[][] {
  const vacias = Array.from({ length: Math.max(0, rep.columnas.length - 2) }, () => "");
  return [
    [rep.titulo],
    [rep.periodo],
    rep.columnas.map((c) => c.etiqueta),
    ...rep.filas,
    ...rep.totales.map((t) => [t.etiqueta, ...vacias, t.valor]),
  ];
}
