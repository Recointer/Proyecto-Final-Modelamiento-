import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { sumarDinero } from "@/lib/dinero";
import { withTenant, type DbContext } from "../db/context";
import { cargo, cargoSaldo, conceptoCobro, pago, type Usuario } from "../db/schema";
import { socioDeSesionTx } from "./socio-sesion";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface PagoEstadoCuenta {
  id: string;
  numero: number;
  monto: string;
  fecha: string;
  forma: string;
}

export interface CargoEstadoCuenta {
  id: string;
  anio: number;
  concepto: string;
  esMulta: boolean;
  monto: string;
  pagado: string;
  saldo: string;
  estado: string;
  vencido: boolean;
  vence: string | null;
  pagos: PagoEstadoCuenta[];
}

export interface EstadoCuenta {
  socio: { id: string; nombres: string; cedula: string };
  anios: number[];
  cargos: CargoEstadoCuenta[];
  /** Saldo pendiente de los cargos vigentes mostrados y lo vencido. */
  totalPendiente: string;
  totalVencido: string;
}

/**
 * Estado de cuenta del Socio de la sesión. El socio se deriva de la cédula de la sesión, nunca de un
 * parámetro del cliente (FR-015). Devuelve null si su cédula aún no figura en el padrón.
 */
export async function obtenerMiEstadoCuenta(ctx: CtxTenant, user: Pick<Usuario, "cedula">, opciones: { anio?: number } = {}): Promise<EstadoCuenta | null> {
  return withTenant(ctx, async (tx) => {
    const s = await socioDeSesionTx(tx, ctx, user);
    if (!s) return null;

    const todos = await tx
      .select({ anio: cargoSaldo.anio })
      .from(cargoSaldo)
      .where(and(eq(cargoSaldo.tenantId, ctx.tenantId), eq(cargoSaldo.socioId, s.id)))
      .groupBy(cargoSaldo.anio)
      .orderBy(desc(cargoSaldo.anio));

    const filas = await tx
      .select({
        id: cargoSaldo.id,
        anio: cargoSaldo.anio,
        concepto: conceptoCobro.nombre,
        tipo: conceptoCobro.tipo,
        monto: cargoSaldo.monto,
        pagado: cargoSaldo.pagado,
        saldo: cargoSaldo.saldo,
        estado: cargoSaldo.estado,
        vencido: cargoSaldo.vencido,
        vence: cargoSaldo.vence,
      })
      .from(cargoSaldo)
      .innerJoin(conceptoCobro, and(eq(conceptoCobro.id, cargoSaldo.conceptoId), eq(conceptoCobro.tenantId, cargoSaldo.tenantId)))
      .where(
        and(
          eq(cargoSaldo.tenantId, ctx.tenantId),
          eq(cargoSaldo.socioId, s.id),
          opciones.anio ? eq(cargoSaldo.anio, opciones.anio) : undefined,
        ),
      )
      .orderBy(desc(cargoSaldo.anio), asc(conceptoCobro.nombre));

    const vigentes = filas.filter((f) => f.estado !== "anulado");
    const ids = vigentes.map((f) => f.id);
    const pagos = ids.length
      ? await tx
          .select({ id: pago.id, cargoId: pago.cargoId, numero: pago.numero, monto: pago.monto, fecha: pago.fecha, forma: pago.forma })
          .from(pago)
          .innerJoin(cargo, and(eq(cargo.id, pago.cargoId), eq(cargo.tenantId, pago.tenantId)))
          .where(and(eq(pago.tenantId, ctx.tenantId), eq(cargo.socioId, s.id), isNull(pago.anuladoEn)))
          .orderBy(asc(pago.numero))
      : [];

    const cargos = vigentes.map((f) => ({
      id: f.id,
      anio: f.anio,
      concepto: f.concepto,
      esMulta: f.tipo === "multa",
      monto: f.monto,
      pagado: f.pagado,
      saldo: f.saldo,
      estado: f.estado,
      vencido: f.vencido,
      vence: f.vence,
      pagos: pagos
        .filter((p) => p.cargoId === f.id)
        .map((p) => ({ id: p.id, numero: p.numero, monto: p.monto, fecha: p.fecha, forma: p.forma })),
    }));
    return {
      socio: { id: s.id, nombres: s.nombres, cedula: s.cedula },
      anios: todos.map((t) => t.anio),
      cargos,
      totalPendiente: sumarDinero(cargos.filter((c) => c.estado !== "pagado").map((c) => c.saldo)),
      totalVencido: sumarDinero(cargos.filter((c) => c.vencido).map((c) => c.saldo)),
    };
  });
}
