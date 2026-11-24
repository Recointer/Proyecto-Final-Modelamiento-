import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { activoFijo } from "../db/schema";
import type { EntradaActivo } from "../validation/finanzas";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;
export type ActivoFijo = typeof activoFijo.$inferSelect;

function mapear(e: unknown): never {
  if (codigoPg(e).codigo === "23505") throw new AppError("ACTIVO_DUPLICADO", undefined, "codigo");
  throw e;
}

export async function listarActivos(ctx: CtxTenant): Promise<ActivoFijo[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select()
      .from(activoFijo)
      .where(eq(activoFijo.tenantId, ctx.tenantId))
      .orderBy(asc(activoFijo.estado), asc(sql`lower(${activoFijo.codigo})`)),
  );
}

export async function obtenerActivo(ctx: CtxTenant, id: string): Promise<ActivoFijo | null> {
  return withTenant(ctx, async (tx) => {
    const [a] = await tx
      .select()
      .from(activoFijo)
      .where(and(eq(activoFijo.id, id), eq(activoFijo.tenantId, ctx.tenantId)))
      .limit(1);
    return a ?? null;
  });
}

export async function crearActivo(ctx: CtxTenant, e: EntradaActivo): Promise<{ id: string }> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [a] = await tx
        .insert(activoFijo)
        .values({
          tenantId: ctx.tenantId,
          codigo: e.codigo,
          nombre: e.nombre,
          fechaAdquisicion: e.fechaAdquisicion,
          valor: e.valor,
          ubicacion: e.ubicacion,
        })
        .returning({ id: activoFijo.id });
      await auditar(tx, { actorId: ctx.userId, tenantId: ctx.tenantId, accion: "activo.crear", entidad: "activo_fijo", entidadId: a!.id, despues: e });
      return { id: a!.id };
    });
  } catch (err) {
    return mapear(err);
  }
}

export async function editarActivo(ctx: CtxTenant, id: string, e: EntradaActivo): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx
        .select()
        .from(activoFijo)
        .where(and(eq(activoFijo.id, id), eq(activoFijo.tenantId, ctx.tenantId)))
        .limit(1);
      if (!antes) throw new AppError("ACTIVO_NO_ENCONTRADO");
      if (antes.estado === "baja") throw new AppError("ACTIVO_EN_BAJA");
      await tx
        .update(activoFijo)
        .set({ codigo: e.codigo, nombre: e.nombre, fechaAdquisicion: e.fechaAdquisicion, valor: e.valor, ubicacion: e.ubicacion })
        .where(and(eq(activoFijo.id, id), eq(activoFijo.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "activo.editar",
        entidad: "activo_fijo",
        entidadId: id,
        antes: { codigo: antes.codigo, nombre: antes.nombre, valor: antes.valor, ubicacion: antes.ubicacion },
        despues: e,
      });
    });
  } catch (err) {
    mapear(err);
  }
}

export async function darDeBajaActivo(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx
      .select()
      .from(activoFijo)
      .where(and(eq(activoFijo.id, id), eq(activoFijo.tenantId, ctx.tenantId)))
      .limit(1);
    if (!antes) throw new AppError("ACTIVO_NO_ENCONTRADO");
    if (antes.estado === "baja") throw new AppError("ACTIVO_EN_BAJA");
    await tx
      .update(activoFijo)
      .set({ estado: "baja", motivoBaja: motivo, bajaEn: new Date() })
      .where(and(eq(activoFijo.id, id), eq(activoFijo.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "activo.baja",
      entidad: "activo_fijo",
      entidadId: id,
      antes: { estado: "vigente" },
      despues: { estado: "baja", motivo },
    });
  });
}
