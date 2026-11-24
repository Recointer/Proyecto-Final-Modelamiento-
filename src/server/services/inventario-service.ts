import { and, asc, desc, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { aCentavos } from "@/lib/dinero";
import { withTenant, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { material, movimientoMaterial } from "../db/schema";
import type { EntradaMaterial, EntradaMovimiento } from "../validation/finanzas";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface FilaMaterial {
  id: string;
  nombre: string;
  unidad: string;
  stock: string;
  minimo: string;
  estado: "activo" | "inactivo";
  /** Stock igual o menor al mínimo. */
  bajo: boolean;
}

export interface FilaMovimiento {
  id: string;
  tipo: "entrada" | "salida";
  cantidad: string;
  motivo: string;
  creadoEn: Date;
}

function mapearMaterial(e: unknown): never {
  if (codigoPg(e).codigo === "23505") throw new AppError("MATERIAL_DUPLICADO", undefined, "nombre");
  throw e;
}

export async function listarMateriales(ctx: CtxTenant): Promise<FilaMaterial[]> {
  return withTenant(ctx, async (tx) => {
    const filas = await tx
      .select()
      .from(material)
      .where(eq(material.tenantId, ctx.tenantId))
      .orderBy(asc(sql`lower(${material.nombre})`));
    return filas.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidad,
      stock: m.stock,
      minimo: m.minimo,
      estado: m.estado,
      bajo: m.estado === "activo" && (aCentavos(m.stock) ?? 0) <= (aCentavos(m.minimo) ?? 0),
    }));
  });
}

export async function crearMaterial(ctx: CtxTenant, e: EntradaMaterial): Promise<{ id: string }> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [m] = await tx
        .insert(material)
        .values({ tenantId: ctx.tenantId, nombre: e.nombre, unidad: e.unidad, stock: e.stockInicial, minimo: e.minimo })
        .returning({ id: material.id });
      if ((aCentavos(e.stockInicial) ?? 0) > 0) {
        await tx.insert(movimientoMaterial).values({
          tenantId: ctx.tenantId,
          materialId: m!.id,
          tipo: "entrada",
          cantidad: e.stockInicial,
          motivo: "Stock inicial",
          creadoPor: ctx.userId,
        });
      }
      await auditar(tx, { actorId: ctx.userId, tenantId: ctx.tenantId, accion: "material.crear", entidad: "material", entidadId: m!.id, despues: e });
      return { id: m!.id };
    });
  } catch (err) {
    return mapearMaterial(err);
  }
}

export async function editarMaterial(
  ctx: CtxTenant,
  id: string,
  e: { nombre: string; unidad: string; minimo: string; estado: "activo" | "inactivo" },
): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx
        .select()
        .from(material)
        .where(and(eq(material.id, id), eq(material.tenantId, ctx.tenantId)))
        .limit(1);
      if (!antes) throw new AppError("MATERIAL_NO_ENCONTRADO");
      await tx
        .update(material)
        .set({ nombre: e.nombre, unidad: e.unidad, minimo: e.minimo, estado: e.estado })
        .where(and(eq(material.id, id), eq(material.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "material.editar",
        entidad: "material",
        entidadId: id,
        antes: { nombre: antes.nombre, unidad: antes.unidad, minimo: antes.minimo, estado: antes.estado },
        despues: e,
      });
    });
  } catch (err) {
    mapearMaterial(err);
  }
}

/** Entrada o salida de stock. La base de datos impide el stock negativo (CHECK) aun con salidas simultáneas. */
export async function registrarMovimiento(ctx: CtxTenant, e: EntradaMovimiento): Promise<{ stock: string }> {
  try {
    return await withTenant(ctx, async (tx) => {
      const signo = e.tipo === "entrada" ? sql`+` : sql`-`;
      const [m] = await tx
        .update(material)
        .set({ stock: sql`${material.stock} ${signo} ${e.cantidad}::numeric` })
        .where(and(eq(material.id, e.materialId), eq(material.tenantId, ctx.tenantId)))
        .returning({ stock: material.stock });
      if (!m) throw new AppError("MATERIAL_NO_ENCONTRADO");
      await tx.insert(movimientoMaterial).values({
        tenantId: ctx.tenantId,
        materialId: e.materialId,
        tipo: e.tipo,
        cantidad: e.cantidad,
        motivo: e.motivo,
        creadoPor: ctx.userId,
      });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "movimiento.registrar",
        entidad: "material",
        entidadId: e.materialId,
        despues: { tipo: e.tipo, cantidad: e.cantidad, motivo: e.motivo, stock: m.stock },
      });
      return { stock: m.stock };
    });
  } catch (err) {
    const { codigo, restriccion } = codigoPg(err);
    if (codigo === "23514" && restriccion === "material_stock_ck") throw new AppError("STOCK_INSUFICIENTE", undefined, "cantidad");
    throw err;
  }
}

export async function listarMovimientos(ctx: CtxTenant, materialId: string, limite = 20): Promise<FilaMovimiento[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({
        id: movimientoMaterial.id,
        tipo: movimientoMaterial.tipo,
        cantidad: movimientoMaterial.cantidad,
        motivo: movimientoMaterial.motivo,
        creadoEn: movimientoMaterial.creadoEn,
      })
      .from(movimientoMaterial)
      .where(and(eq(movimientoMaterial.materialId, materialId), eq(movimientoMaterial.tenantId, ctx.tenantId)))
      .orderBy(desc(movimientoMaterial.creadoEn))
      .limit(limite),
  );
}
