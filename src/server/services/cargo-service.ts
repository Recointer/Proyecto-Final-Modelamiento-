import { and, asc, desc, eq, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { aCentavos, deCentavos } from "@/lib/dinero";
import { withTenant, type Db, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { cargo, cargoSaldo, conceptoCobro, pago, sector, socio } from "../db/schema";
import type { EntradaEmision } from "../validation/finanzas";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TAMANO_PAGINA = 25;

export interface FiltrosCargo {
  anio?: number;
  conceptoId?: string;
  sectorId?: string;
  socioId?: string;
  estado?: "pendiente" | "parcial" | "pagado" | "anulado";
  vencido?: boolean;
  /** Solo cargos con saldo por cobrar (pendientes y con pago parcial). */
  abiertos?: boolean;
  busqueda?: string;
  pagina?: number;
}

export interface FilaCargo {
  id: string;
  anio: number;
  monto: string;
  pagado: string;
  saldo: string;
  estado: string;
  vencido: boolean;
  vence: string | null;
  concepto: string;
  socioId: string;
  socioNombres: string;
  socioCedula: string;
  sectorNombre: string;
}

export interface ListadoCargos {
  items: FilaCargo[];
  total: number;
  totalSaldo: string;
  pagina: number;
  paginas: number;
}

function condiciones(ctx: CtxTenant, f: FiltrosCargo): SQL | undefined {
  const b = f.busqueda?.trim();
  return and(
    eq(cargoSaldo.tenantId, ctx.tenantId),
    f.anio ? eq(cargoSaldo.anio, f.anio) : undefined,
    f.conceptoId ? eq(cargoSaldo.conceptoId, f.conceptoId) : undefined,
    f.sectorId ? eq(socio.sectorId, f.sectorId) : undefined,
    f.socioId ? eq(cargoSaldo.socioId, f.socioId) : undefined,
    f.estado ? eq(cargoSaldo.estado, f.estado) : undefined,
    f.vencido ? eq(cargoSaldo.vencido, true) : undefined,
    f.abiertos ? inArray(cargoSaldo.estado, ["pendiente", "parcial"]) : undefined,
    b ? or(ilike(socio.nombres, `%${b.replace(/[%_\\]/g, "\\$&")}%`), eq(socio.cedula, b)) : undefined,
  );
}

const columnas = {
  id: cargoSaldo.id,
  anio: cargoSaldo.anio,
  monto: cargoSaldo.monto,
  pagado: cargoSaldo.pagado,
  saldo: cargoSaldo.saldo,
  estado: cargoSaldo.estado,
  vencido: cargoSaldo.vencido,
  vence: cargoSaldo.vence,
  concepto: conceptoCobro.nombre,
  socioId: socio.id,
  socioNombres: socio.nombres,
  socioCedula: socio.cedula,
  sectorNombre: sector.nombre,
};

function desde(tx: Db) {
  return tx
    .select(columnas)
    .from(cargoSaldo)
    .innerJoin(conceptoCobro, and(eq(conceptoCobro.id, cargoSaldo.conceptoId), eq(conceptoCobro.tenantId, cargoSaldo.tenantId)))
    .innerJoin(socio, and(eq(socio.id, cargoSaldo.socioId), eq(socio.tenantId, cargoSaldo.tenantId)))
    .innerJoin(sector, and(eq(sector.id, socio.sectorId), eq(sector.tenantId, socio.tenantId)));
}

/** Cuentas por cobrar con filtros y paginación. `totalSaldo` suma el saldo vigente de TODO el filtro. */
export async function listarCargos(ctx: CtxTenant, f: FiltrosCargo = {}): Promise<ListadoCargos> {
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1));
  return withTenant(ctx, async (tx) => {
    const where = condiciones(ctx, f);
    const [t] = await tx
      .select({
        n: sql<number>`count(*)::int`,
        saldo: sql<string>`coalesce(sum(${cargoSaldo.saldo}) filter (where ${cargoSaldo.estado} <> 'anulado'), 0)::numeric(12,2)::text`,
      })
      .from(cargoSaldo)
      .innerJoin(socio, and(eq(socio.id, cargoSaldo.socioId), eq(socio.tenantId, cargoSaldo.tenantId)))
      .where(where);
    const total = t?.n ?? 0;
    const items = await desde(tx)
      .where(where)
      .orderBy(desc(cargoSaldo.anio), asc(sql`lower(${socio.nombres})`), asc(conceptoCobro.nombre))
      .limit(TAMANO_PAGINA)
      .offset((pagina - 1) * TAMANO_PAGINA);
    return { items, total, totalSaldo: t?.saldo ?? "0.00", pagina, paginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA)) };
  });
}

/** Todas las filas de un filtro (para reportes), sin paginar. */
export async function cargosParaReporte(ctx: CtxTenant, f: FiltrosCargo): Promise<FilaCargo[]> {
  return withTenant(ctx, (tx) =>
    desde(tx).where(condiciones(ctx, f)).orderBy(desc(cargoSaldo.anio), asc(sql`lower(${socio.nombres})`), asc(conceptoCobro.nombre)),
  );
}

export interface PagoDeCargo {
  id: string;
  numero: number;
  monto: string;
  fecha: string;
  forma: string;
  referencia: string | null;
  anulado: boolean;
  motivoAnulacion: string | null;
}

export interface DetalleCargo extends FilaCargo {
  motivoAnulacion: string | null;
  eventoId: string | null;
  pagos: PagoDeCargo[];
}

export async function obtenerCargo(ctx: CtxTenant, id: string): Promise<DetalleCargo | null> {
  return withTenant(ctx, async (tx) => {
    const [c] = await desde(tx)
      .where(and(eq(cargoSaldo.id, id), eq(cargoSaldo.tenantId, ctx.tenantId)))
      .limit(1);
    if (!c) return null;
    const [extra] = await tx
      .select({ motivo: cargoSaldo.motivoAnulacion, eventoId: cargoSaldo.eventoId })
      .from(cargoSaldo)
      .where(eq(cargoSaldo.id, id))
      .limit(1);
    const pagos = await tx
      .select()
      .from(pago)
      .where(and(eq(pago.cargoId, id), eq(pago.tenantId, ctx.tenantId)))
      .orderBy(asc(pago.numero));
    return {
      ...c,
      motivoAnulacion: extra?.motivo ?? null,
      eventoId: extra?.eventoId ?? null,
      pagos: pagos.map((p) => ({
        id: p.id,
        numero: p.numero,
        monto: p.monto,
        fecha: p.fecha,
        forma: p.forma,
        referencia: p.referencia,
        anulado: p.anuladoEn !== null,
        motivoAnulacion: p.motivoAnulacion,
      })),
    };
  });
}

export interface ResultadoEmision {
  emitidos: number;
  existentes: number;
  monto: string;
}

/**
 * Emite el cargo de un concepto y año a todos los socios activos, a un sector o a un socio.
 * Idempotente: el índice único (concepto, socio, año) evita duplicados y se informa cuántos ya existían.
 */
export async function emitirCargos(ctx: CtxTenant, e: EntradaEmision): Promise<ResultadoEmision> {
  return withTenant(ctx, async (tx) => {
    const [c] = await tx
      .select()
      .from(conceptoCobro)
      .where(and(eq(conceptoCobro.id, e.conceptoId), eq(conceptoCobro.tenantId, ctx.tenantId)))
      .limit(1);
    if (!c || c.tipo === "multa") throw new AppError("CONCEPTO_NO_ENCONTRADO", undefined, "conceptoId");
    if (c.estado !== "activo") throw new AppError("CONCEPTO_INACTIVO", undefined, "conceptoId");

    const centavos = aCentavos(e.monto ? e.monto : c.montoDefecto);
    if (!centavos || centavos <= 0) throw new AppError("MONTO_INVALIDO", "Ingrese el monto del cargo.", "monto");
    const monto = deCentavos(centavos);

    const filtroSocios: (SQL | undefined)[] = [eq(socio.tenantId, ctx.tenantId)];
    if (e.alcance === "socio") filtroSocios.push(eq(socio.id, e.socioId!));
    else {
      filtroSocios.push(eq(socio.estado, "activo"), lte(socio.fechaIngreso, `${e.anio}-12-31`));
      if (e.alcance === "sector") filtroSocios.push(eq(socio.sectorId, e.sectorId!));
    }
    const socios = await tx.select({ id: socio.id }).from(socio).where(and(...filtroSocios));
    if (socios.length === 0) throw new AppError(e.alcance === "socio" ? "SOCIO_NO_ENCONTRADO" : "SIN_SOCIOS");

    let emitidos = 0;
    for (let i = 0; i < socios.length; i += 500) {
      const lote = socios.slice(i, i + 500).map((s) => ({
        tenantId: ctx.tenantId,
        conceptoId: c.id,
        socioId: s.id,
        anio: e.anio,
        monto,
        vence: e.vence || null,
        creadoPor: ctx.userId,
      }));
      const creados = await tx.insert(cargo).values(lote).onConflictDoNothing().returning({ id: cargo.id });
      emitidos += creados.length;
    }
    const existentes = socios.length - emitidos;
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "cargo.emitir",
      entidad: "concepto_cobro",
      entidadId: c.id,
      despues: { anio: e.anio, alcance: e.alcance, monto, vence: e.vence || null, emitidos, existentes },
    });
    return { emitidos, existentes, monto };
  });
}

export async function anularCargo(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [c] = await tx
        .select()
        .from(cargo)
        .where(and(eq(cargo.id, id), eq(cargo.tenantId, ctx.tenantId)))
        .for("update")
        .limit(1);
      if (!c) throw new AppError("CARGO_NO_ENCONTRADO");
      if (c.anuladoEn) throw new AppError("CARGO_ANULADO");
      await tx
        .update(cargo)
        .set({ anuladoEn: new Date(), anuladoPor: ctx.userId, motivoAnulacion: motivo })
        .where(and(eq(cargo.id, id), eq(cargo.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "cargo.anular",
        entidad: "cargo",
        entidadId: id,
        antes: { monto: c.monto, socioId: c.socioId, anio: c.anio },
        despues: { motivo },
      });
    });
  } catch (e) {
    if (codigoPg(e).restriccion === "cargo_con_pagos") throw new AppError("CARGO_CON_PAGOS");
    throw e;
  }
}

/** Socios activos para elegir a quién se emite un cargo individual. */
export async function sociosParaEmision(ctx: CtxTenant): Promise<{ id: string; nombres: string; cedula: string }[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({ id: socio.id, nombres: socio.nombres, cedula: socio.cedula })
      .from(socio)
      .where(and(eq(socio.tenantId, ctx.tenantId), eq(socio.estado, "activo")))
      .orderBy(asc(sql`lower(${socio.nombres})`))
      .limit(1000),
  );
}
