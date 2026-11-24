import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { aCentavos, deCentavos } from "@/lib/dinero";
import { withTenant, type DbContext } from "../db/context";
import { cargoSaldo, egreso, pago } from "../db/schema";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface RangoFinanciero {
  anio?: number;
  desde?: string;
  hasta?: string;
}

export interface ResumenFinanciero {
  desde: string | null;
  hasta: string | null;
  ingresos: string;
  egresos: string;
  /** ingresos − egresos */
  caja: string;
  /** Saldo pendiente de los cargos vigentes (del año, si se filtra por año). */
  porCobrar: string;
  porCobrarVencido: string;
  pagos: number;
  egresosPorCategoria: { categoria: string; total: string }[];
}

/** Resuelve el rango de fechas: el año completo, o desde/hasta explícitos. */
export function rangoDe(r: RangoFinanciero): { desde: string | null; hasta: string | null } {
  if (r.anio) return { desde: `${r.anio}-01-01`, hasta: `${r.anio}-12-31` };
  return { desde: r.desde || null, hasta: r.hasta || null };
}

/** Totales de caja del período. Los pagos y egresos anulados nunca suman. */
export async function resumenFinanciero(ctx: CtxTenant, r: RangoFinanciero = {}): Promise<ResumenFinanciero> {
  const { desde, hasta } = rangoDe(r);
  return withTenant(ctx, async (tx) => {
    const [i] = await tx
      .select({
        suma: sql<string>`coalesce(sum(${pago.monto}), 0)::numeric(12,2)::text`,
        n: sql<number>`count(*)::int`,
      })
      .from(pago)
      .where(and(eq(pago.tenantId, ctx.tenantId), isNull(pago.anuladoEn), desde ? gte(pago.fecha, desde) : undefined, hasta ? lte(pago.fecha, hasta) : undefined));
    const porCategoria = await tx
      .select({ categoria: egreso.categoria, total: sql<string>`sum(${egreso.monto})::numeric(12,2)::text` })
      .from(egreso)
      .where(and(eq(egreso.tenantId, ctx.tenantId), isNull(egreso.anuladoEn), desde ? gte(egreso.fecha, desde) : undefined, hasta ? lte(egreso.fecha, hasta) : undefined))
      .groupBy(egreso.categoria)
      .orderBy(egreso.categoria);
    const [c] = await tx
      .select({
        saldo: sql<string>`coalesce(sum(${cargoSaldo.saldo}), 0)::numeric(12,2)::text`,
        vencido: sql<string>`coalesce(sum(${cargoSaldo.saldo}) filter (where ${cargoSaldo.vencido}), 0)::numeric(12,2)::text`,
      })
      .from(cargoSaldo)
      .where(and(eq(cargoSaldo.tenantId, ctx.tenantId), inArray(cargoSaldo.estado, ["pendiente", "parcial"]), r.anio ? eq(cargoSaldo.anio, r.anio) : undefined));

    const ingresos = i?.suma ?? "0.00";
    const egresos = deCentavos(porCategoria.reduce((a, f) => a + (aCentavos(f.total) ?? 0), 0));
    return {
      desde,
      hasta,
      ingresos,
      egresos,
      caja: deCentavos((aCentavos(ingresos) ?? 0) - (aCentavos(egresos) ?? 0)),
      porCobrar: c?.saldo ?? "0.00",
      porCobrarVencido: c?.vencido ?? "0.00",
      pagos: i?.n ?? 0,
      egresosPorCategoria: porCategoria,
    };
  });
}
