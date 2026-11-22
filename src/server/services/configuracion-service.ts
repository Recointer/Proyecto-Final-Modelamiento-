import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type DbContext } from "../db/context";
import { junta, sector, type Junta } from "../db/schema";
import {
  parametrosDe,
  type EntradaConfiguracion,
  type EntradaSector,
  type ParametrosJunta,
} from "../validation/configuracion";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface Sector {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Configuracion {
  junta: Pick<
    Junta,
    | "id"
    | "slug"
    | "nombre"
    | "tipo"
    | "provincia"
    | "canton"
    | "parroquia"
    | "contactoNombre"
    | "contactoTelefono"
    | "contactoCorreo"
    | "estado"
  >;
  parametros: ParametrosJunta;
  sectores: Sector[];
}

function codigoPg(e: unknown): { codigo?: string; restriccion?: string } {
  const c = ((e as { cause?: unknown })?.cause ?? e) as { code?: string; constraint_name?: string };
  return { codigo: c?.code, restriccion: c?.constraint_name };
}

export async function obtenerConfiguracion(ctx: CtxTenant): Promise<Configuracion> {
  return withTenant(ctx, async (tx) => {
    const [j] = await tx.select().from(junta).where(eq(junta.id, ctx.tenantId)).limit(1);
    if (!j) throw new AppError("JUNTA_NO_ENCONTRADA");
    const sectores = await tx
      .select({ id: sector.id, nombre: sector.nombre, descripcion: sector.descripcion })
      .from(sector)
      .where(eq(sector.tenantId, ctx.tenantId))
      .orderBy(asc(sql`lower(${sector.nombre})`));
    return {
      junta: {
        id: j.id,
        slug: j.slug,
        nombre: j.nombre,
        tipo: j.tipo,
        provincia: j.provincia,
        canton: j.canton,
        parroquia: j.parroquia,
        contactoNombre: j.contactoNombre,
        contactoTelefono: j.contactoTelefono,
        contactoCorreo: j.contactoCorreo,
        estado: j.estado,
      },
      parametros: parametrosDe(j.parametros),
      sectores,
    };
  });
}

/**
 * Actualiza solo los datos que la propia junta puede cambiar. El estado y el identificador de
 * acceso son de la plataforma y nunca se modifican desde aquí.
 */
export async function actualizarConfiguracion(ctx: CtxTenant, e: EntradaConfiguracion): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx.select().from(junta).where(eq(junta.id, ctx.tenantId)).limit(1);
      if (!antes) throw new AppError("JUNTA_NO_ENCONTRADA");
      const [despues] = await tx
        .update(junta)
        .set({
          nombre: e.nombre,
          tipo: e.tipo,
          provincia: e.provincia,
          canton: e.canton,
          parroquia: e.parroquia,
          contactoNombre: e.contactoNombre ?? null,
          contactoTelefono: e.contactoTelefono ?? null,
          contactoCorreo: e.contactoCorreo ?? null,
          parametros: { ...(antes.parametros ?? {}), ...e.parametros },
          actualizadaEn: new Date(),
        })
        .where(eq(junta.id, ctx.tenantId))
        .returning();
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "junta.configurar",
        entidad: "junta",
        entidadId: ctx.tenantId,
        antes: {
          nombre: antes.nombre,
          tipo: antes.tipo,
          provincia: antes.provincia,
          canton: antes.canton,
          parroquia: antes.parroquia,
          parametros: antes.parametros,
        },
        despues: {
          nombre: despues?.nombre,
          tipo: despues?.tipo,
          provincia: despues?.provincia,
          canton: despues?.canton,
          parroquia: despues?.parroquia,
          parametros: despues?.parametros,
        },
      });
    });
  } catch (err) {
    // La junta no puede ver a las demás: el índice único de nombre y parroquia lo detecta sin filtrar datos
    if (codigoPg(err).codigo === "23505") throw new AppError("JUNTA_DUPLICADA", undefined, "nombre");
    throw err;
  }
}

export async function crearSector(ctx: CtxTenant, e: EntradaSector): Promise<Sector> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [nuevo] = await tx
        .insert(sector)
        .values({ tenantId: ctx.tenantId, nombre: e.nombre, descripcion: e.descripcion ?? null })
        .returning({ id: sector.id, nombre: sector.nombre, descripcion: sector.descripcion });
      if (!nuevo) throw new AppError("ERROR_INTERNO");
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "sector.crear",
        entidad: "sector",
        entidadId: nuevo.id,
        despues: nuevo,
      });
      return nuevo;
    });
  } catch (err) {
    if (codigoPg(err).codigo === "23505") throw new AppError("SECTOR_DUPLICADO", undefined, "nombre");
    throw err;
  }
}

export async function editarSector(ctx: CtxTenant, id: string, e: EntradaSector): Promise<Sector> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [antes] = await tx
        .select()
        .from(sector)
        .where(and(eq(sector.id, id), eq(sector.tenantId, ctx.tenantId)))
        .limit(1);
      if (!antes) throw new AppError("SECTOR_NO_ENCONTRADO");
      const [despues] = await tx
        .update(sector)
        .set({ nombre: e.nombre, descripcion: e.descripcion ?? null })
        .where(and(eq(sector.id, id), eq(sector.tenantId, ctx.tenantId)))
        .returning({ id: sector.id, nombre: sector.nombre, descripcion: sector.descripcion });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "sector.editar",
        entidad: "sector",
        entidadId: id,
        antes: { nombre: antes.nombre, descripcion: antes.descripcion },
        despues,
      });
      return despues!;
    });
  } catch (err) {
    if (codigoPg(err).codigo === "23505") throw new AppError("SECTOR_DUPLICADO", undefined, "nombre");
    throw err;
  }
}

/**
 * Elimina un sector. Si tiene socios o predios asociados, la clave foránea (ON DELETE RESTRICT) de
 * esas tablas lo impide y se informa al usuario (FR-014); así la regla se cumple aunque los módulos
 * que usan sectores se agreguen después.
 */
export async function eliminarSector(ctx: CtxTenant, id: string): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx
        .select()
        .from(sector)
        .where(and(eq(sector.id, id), eq(sector.tenantId, ctx.tenantId)))
        .limit(1);
      if (!antes) throw new AppError("SECTOR_NO_ENCONTRADO");
      await tx.delete(sector).where(and(eq(sector.id, id), eq(sector.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "sector.eliminar",
        entidad: "sector",
        entidadId: id,
        antes: { nombre: antes.nombre, descripcion: antes.descripcion },
      });
    });
  } catch (err) {
    if (codigoPg(err).codigo === "23503") throw new AppError("SECTOR_CON_ASOCIADOS");
    throw err;
  }
}
