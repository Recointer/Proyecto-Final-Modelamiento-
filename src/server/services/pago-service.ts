import { and, eq } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { cargo, conceptoCobro, junta, pago, socio } from "../db/schema";
import type { EntradaPago } from "../validation/finanzas";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

/** Traduce los errores de las reglas de dinero de la base de datos. */
function mapear(e: unknown): never {
  const { codigo, restriccion } = codigoPg(e);
  if (restriccion === "pago_excede_saldo") throw new AppError("PAGO_EXCEDE_SALDO", undefined, "monto");
  if (restriccion === "pago_cargo_anulado") throw new AppError("CARGO_ANULADO");
  if (restriccion === "pago_cargo_fk" || codigo === "23503") throw new AppError("CARGO_NO_ENCONTRADO");
  throw e;
}

/** Registra un pago (total o parcial). El consecutivo y la validación del saldo los hace la base de datos. */
export async function registrarPago(ctx: CtxTenant, e: EntradaPago): Promise<{ id: string; numero: number }> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [creado] = await tx
        .insert(pago)
        .values({
          tenantId: ctx.tenantId,
          cargoId: e.cargoId,
          monto: e.monto,
          fecha: e.fecha,
          forma: e.forma,
          referencia: e.referencia || null,
          creadoPor: ctx.userId,
        })
        .returning({ id: pago.id, numero: pago.numero });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "pago.registrar",
        entidad: "pago",
        entidadId: creado!.id,
        despues: { cargoId: e.cargoId, numero: creado!.numero, monto: e.monto, fecha: e.fecha, forma: e.forma },
      });
      return { id: creado!.id, numero: creado!.numero };
    });
  } catch (err) {
    return mapear(err);
  }
}

export async function anularPago(ctx: CtxTenant, id: string, motivo: string): Promise<{ cargoId: string }> {
  return withTenant(ctx, async (tx) => {
    const [p] = await tx
      .select()
      .from(pago)
      .where(and(eq(pago.id, id), eq(pago.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!p) throw new AppError("PAGO_NO_ENCONTRADO");
    if (p.anuladoEn) throw new AppError("PAGO_ANULADO");
    await tx
      .update(pago)
      .set({ anuladoEn: new Date(), anuladoPor: ctx.userId, motivoAnulacion: motivo })
      .where(and(eq(pago.id, id), eq(pago.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "pago.anular",
      entidad: "pago",
      entidadId: id,
      antes: { numero: p.numero, monto: p.monto, cargoId: p.cargoId },
      despues: { motivo },
    });
    return { cargoId: p.cargoId };
  });
}

export interface DatosComprobante {
  id: string;
  numero: number;
  monto: string;
  fecha: string;
  forma: string;
  referencia: string | null;
  anulado: boolean;
  motivoAnulacion: string | null;
  emitidoEn: Date;
  junta: string;
  concepto: string;
  anio: number;
  socioId: string;
  socioNombres: string;
  socioCedula: string;
  montoCargo: string;
}

/** Datos de un comprobante. `soloSocioId` acota a los pagos de ese socio (estado de cuenta del Socio). */
export async function obtenerComprobante(tx: Db, ctx: CtxTenant, id: string, soloSocioId?: string): Promise<DatosComprobante | null> {
  const [f] = await tx
    .select({
      id: pago.id,
      numero: pago.numero,
      monto: pago.monto,
      fecha: pago.fecha,
      forma: pago.forma,
      referencia: pago.referencia,
      anuladoEn: pago.anuladoEn,
      motivoAnulacion: pago.motivoAnulacion,
      emitidoEn: pago.creadoEn,
      junta: junta.nombre,
      concepto: conceptoCobro.nombre,
      anio: cargo.anio,
      socioId: socio.id,
      socioNombres: socio.nombres,
      socioCedula: socio.cedula,
      montoCargo: cargo.monto,
    })
    .from(pago)
    .innerJoin(cargo, and(eq(cargo.id, pago.cargoId), eq(cargo.tenantId, pago.tenantId)))
    .innerJoin(conceptoCobro, and(eq(conceptoCobro.id, cargo.conceptoId), eq(conceptoCobro.tenantId, cargo.tenantId)))
    .innerJoin(socio, and(eq(socio.id, cargo.socioId), eq(socio.tenantId, cargo.tenantId)))
    .innerJoin(junta, eq(junta.id, pago.tenantId))
    .where(and(eq(pago.id, id), eq(pago.tenantId, ctx.tenantId), soloSocioId ? eq(socio.id, soloSocioId) : undefined))
    .limit(1);
  if (!f) return null;
  const { anuladoEn, ...resto } = f;
  return { ...resto, anulado: anuladoEn !== null };
}

export async function comprobanteDe(ctx: CtxTenant, id: string, soloSocioId?: string): Promise<DatosComprobante | null> {
  return withTenant(ctx, (tx) => obtenerComprobante(tx, ctx, id, soloSocioId));
}
