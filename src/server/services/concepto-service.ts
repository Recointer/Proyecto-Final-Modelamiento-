import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { conceptoCobro, type ConceptoCobro } from "../db/schema";
import type { EntradaConcepto } from "../validation/finanzas";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

function mapear(e: unknown): never {
  if (codigoPg(e).codigo === "23505") throw new AppError("CONCEPTO_DUPLICADO", undefined, "nombre");
  throw e;
}

export async function listarConceptos(ctx: CtxTenant, filtros: { soloActivos?: boolean; sinMultas?: boolean } = {}): Promise<ConceptoCobro[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select()
      .from(conceptoCobro)
      .where(
        and(
          eq(conceptoCobro.tenantId, ctx.tenantId),
          filtros.soloActivos ? eq(conceptoCobro.estado, "activo") : undefined,
          filtros.sinMultas ? sql`${conceptoCobro.tipo} <> 'multa'` : undefined,
        ),
      )
      .orderBy(asc(sql`lower(${conceptoCobro.nombre})`)),
  );
}

export async function crearConcepto(ctx: CtxTenant, e: EntradaConcepto): Promise<{ id: string }> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [c] = await tx
        .insert(conceptoCobro)
        .values({ tenantId: ctx.tenantId, nombre: e.nombre, tipo: e.tipo, montoDefecto: e.montoDefecto })
        .returning({ id: conceptoCobro.id });
      await auditar(tx, { actorId: ctx.userId, tenantId: ctx.tenantId, accion: "concepto.crear", entidad: "concepto_cobro", entidadId: c!.id, despues: e });
      return { id: c!.id };
    });
  } catch (err) {
    return mapear(err);
  }
}

async function cargar(tx: Db, ctx: CtxTenant, id: string): Promise<ConceptoCobro> {
  const [c] = await tx
    .select()
    .from(conceptoCobro)
    .where(and(eq(conceptoCobro.id, id), eq(conceptoCobro.tenantId, ctx.tenantId)))
    .limit(1);
  if (!c) throw new AppError("CONCEPTO_NO_ENCONTRADO");
  if (c.tipo === "multa") throw new AppError("CONCEPTO_PROTEGIDO");
  return c;
}

export async function editarConcepto(ctx: CtxTenant, id: string, e: EntradaConcepto): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const antes = await cargar(tx, ctx, id);
      await tx
        .update(conceptoCobro)
        .set({ nombre: e.nombre, tipo: e.tipo, montoDefecto: e.montoDefecto })
        .where(and(eq(conceptoCobro.id, id), eq(conceptoCobro.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "concepto.editar",
        entidad: "concepto_cobro",
        entidadId: id,
        antes: { nombre: antes.nombre, tipo: antes.tipo, montoDefecto: antes.montoDefecto },
        despues: e,
      });
    });
  } catch (err) {
    mapear(err);
  }
}

export async function cambiarEstadoConcepto(ctx: CtxTenant, id: string, estado: "activo" | "inactivo"): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const antes = await cargar(tx, ctx, id);
    await tx.update(conceptoCobro).set({ estado }).where(and(eq(conceptoCobro.id, id), eq(conceptoCobro.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: estado === "activo" ? "concepto.reactivar" : "concepto.desactivar",
      entidad: "concepto_cobro",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado },
    });
  });
}

/** Concepto de multa del sistema (uno por tipo de evento); se crea al primer uso. */
export async function conceptoDeMulta(tx: Db, ctx: CtxTenant, tipoEvento: "asamblea" | "minga"): Promise<string> {
  const nombre = `Multa por inasistencia a ${tipoEvento}`;
  await tx
    .insert(conceptoCobro)
    .values({ tenantId: ctx.tenantId, nombre, tipo: "multa" })
    .onConflictDoNothing();
  const [c] = await tx
    .select({ id: conceptoCobro.id })
    .from(conceptoCobro)
    .where(and(eq(conceptoCobro.tenantId, ctx.tenantId), sql`lower(${conceptoCobro.nombre}) = lower(${nombre})`))
    .limit(1);
  return c!.id;
}
