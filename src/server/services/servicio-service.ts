import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { sector, servicio, turno } from "../db/schema";
import type { EntradaServicio, EntradaTurno } from "../validation/servicio";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface ServicioListado {
  id: string;
  nombre: string;
  tipo: EntradaServicio["tipo"];
  estado: "activo" | "inactivo";
  turnos: number;
}

export interface TurnoDetalle {
  id: string;
  servicioId: string;
  sectorId: string;
  sectorNombre: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

const hhmm = (t: string) => t.slice(0, 5);

function mapearServicio(e: unknown): never {
  if (codigoPg(e).codigo === "23505") throw new AppError("SERVICIO_DUPLICADO", undefined, "nombre");
  throw e;
}

function mapearTurno(e: unknown): never {
  const c = codigoPg(e).codigo;
  if (c === "23P01") throw new AppError("TURNO_SOLAPADO");
  if (c === "23514") throw new AppError("TURNO_HORARIO_INVALIDO", undefined, "horaFin");
  throw e;
}

export async function listarServicios(ctx: CtxTenant, filtros: { estado?: "activo" | "inactivo" } = {}): Promise<ServicioListado[]> {
  return withTenant(ctx, async (tx) => {
    const filas = await tx
      .select({
        id: servicio.id,
        nombre: servicio.nombre,
        tipo: servicio.tipo,
        estado: servicio.estado,
        turnos: sql<number>`(select count(*)::int from turno t where t.servicio_id = "servicio"."id")`,
      })
      .from(servicio)
      .where(and(eq(servicio.tenantId, ctx.tenantId), filtros.estado ? eq(servicio.estado, filtros.estado) : undefined))
      .orderBy(asc(sql`lower(${servicio.nombre})`));
    return filas;
  });
}

export async function obtenerServicio(
  ctx: CtxTenant,
  id: string,
): Promise<(ServicioListado & { turnosDetalle: TurnoDetalle[] }) | null> {
  return withTenant(ctx, async (tx) => {
    const [s] = await tx
      .select({ id: servicio.id, nombre: servicio.nombre, tipo: servicio.tipo, estado: servicio.estado })
      .from(servicio)
      .where(and(eq(servicio.id, id), eq(servicio.tenantId, ctx.tenantId)))
      .limit(1);
    if (!s) return null;
    const filas = await tx
      .select({
        id: turno.id,
        servicioId: turno.servicioId,
        sectorId: turno.sectorId,
        sectorNombre: sector.nombre,
        diaSemana: turno.diaSemana,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
      })
      .from(turno)
      .innerJoin(sector, and(eq(sector.id, turno.sectorId), eq(sector.tenantId, turno.tenantId)))
      .where(and(eq(turno.servicioId, id), eq(turno.tenantId, ctx.tenantId)))
      .orderBy(asc(turno.diaSemana), asc(turno.horaInicio), asc(sql`lower(${sector.nombre})`));
    const turnosDetalle = filas.map((f) => ({ ...f, horaInicio: hhmm(f.horaInicio), horaFin: hhmm(f.horaFin) }));
    return { ...s, turnos: turnosDetalle.length, turnosDetalle };
  });
}

export async function crearServicio(ctx: CtxTenant, e: EntradaServicio): Promise<{ id: string }> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [nuevo] = await tx
        .insert(servicio)
        .values({ tenantId: ctx.tenantId, nombre: e.nombre.trim(), tipo: e.tipo })
        .returning({ id: servicio.id });
      if (!nuevo) throw new AppError("ERROR_INTERNO");
      await auditar(tx, { actorId: ctx.userId, tenantId: ctx.tenantId, accion: "servicio.crear", entidad: "servicio", entidadId: nuevo.id, despues: { nombre: e.nombre.trim(), tipo: e.tipo } });
      return nuevo;
    });
  } catch (err) {
    return mapearServicio(err);
  }
}

export async function editarServicio(ctx: CtxTenant, id: string, e: EntradaServicio): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx.select().from(servicio).where(and(eq(servicio.id, id), eq(servicio.tenantId, ctx.tenantId))).limit(1);
      if (!antes) throw new AppError("SERVICIO_NO_ENCONTRADO");
      await tx.update(servicio).set({ nombre: e.nombre.trim(), tipo: e.tipo }).where(and(eq(servicio.id, id), eq(servicio.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "servicio.editar",
        entidad: "servicio",
        entidadId: id,
        antes: { nombre: antes.nombre, tipo: antes.tipo },
        despues: { nombre: e.nombre.trim(), tipo: e.tipo },
      });
    });
  } catch (err) {
    return mapearServicio(err);
  }
}

async function cambiarEstado(ctx: CtxTenant, id: string, estado: "activo" | "inactivo"): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx.select({ estado: servicio.estado }).from(servicio).where(and(eq(servicio.id, id), eq(servicio.tenantId, ctx.tenantId))).limit(1);
    if (!antes) throw new AppError("SERVICIO_NO_ENCONTRADO");
    if (antes.estado === estado) return;
    await tx.update(servicio).set({ estado }).where(and(eq(servicio.id, id), eq(servicio.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: estado === "inactivo" ? "servicio.desactivar" : "servicio.reactivar",
      entidad: "servicio",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado },
    });
  });
}

export const desactivarServicio = (ctx: CtxTenant, id: string) => cambiarEstado(ctx, id, "inactivo");
export const reactivarServicio = (ctx: CtxTenant, id: string) => cambiarEstado(ctx, id, "activo");

async function exigirReferencias(tx: Db, ctx: CtxTenant, servicioId: string, sectorId: string): Promise<void> {
  const [s] = await tx.select({ id: servicio.id }).from(servicio).where(and(eq(servicio.id, servicioId), eq(servicio.tenantId, ctx.tenantId))).limit(1);
  if (!s) throw new AppError("SERVICIO_NO_ENCONTRADO");
  const [t] = await tx.select({ id: sector.id }).from(sector).where(and(eq(sector.id, sectorId), eq(sector.tenantId, ctx.tenantId))).limit(1);
  if (!t) throw new AppError("SECTOR_NO_ENCONTRADO", "El sector no existe.", "sectorId");
}

/** La restricción de exclusión de la BD impide solapamientos aun con guardados simultáneos. */
export async function crearTurno(ctx: CtxTenant, e: EntradaTurno): Promise<{ id: string }> {
  try {
    return await withTenant(ctx, async (tx) => {
      await exigirReferencias(tx, ctx, e.servicioId, e.sectorId);
      const [nuevo] = await tx
        .insert(turno)
        .values({ tenantId: ctx.tenantId, servicioId: e.servicioId, sectorId: e.sectorId, diaSemana: e.diaSemana, horaInicio: e.horaInicio, horaFin: e.horaFin })
        .returning({ id: turno.id });
      if (!nuevo) throw new AppError("ERROR_INTERNO");
      await auditar(tx, { actorId: ctx.userId, tenantId: ctx.tenantId, accion: "turno.crear", entidad: "turno", entidadId: nuevo.id, despues: e });
      return nuevo;
    });
  } catch (err) {
    return mapearTurno(err);
  }
}

export async function editarTurno(ctx: CtxTenant, id: string, e: Omit<EntradaTurno, "servicioId">): Promise<void> {
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx.select().from(turno).where(and(eq(turno.id, id), eq(turno.tenantId, ctx.tenantId))).limit(1);
      if (!antes) throw new AppError("TURNO_NO_ENCONTRADO");
      await exigirReferencias(tx, ctx, antes.servicioId, e.sectorId);
      await tx
        .update(turno)
        .set({ sectorId: e.sectorId, diaSemana: e.diaSemana, horaInicio: e.horaInicio, horaFin: e.horaFin })
        .where(and(eq(turno.id, id), eq(turno.tenantId, ctx.tenantId)));
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "turno.editar",
        entidad: "turno",
        entidadId: id,
        antes: { sectorId: antes.sectorId, diaSemana: antes.diaSemana, horaInicio: hhmm(antes.horaInicio), horaFin: hhmm(antes.horaFin) },
        despues: e,
      });
    });
  } catch (err) {
    return mapearTurno(err);
  }
}

export async function eliminarTurno(ctx: CtxTenant, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx.select().from(turno).where(and(eq(turno.id, id), eq(turno.tenantId, ctx.tenantId))).limit(1);
    if (!antes) throw new AppError("TURNO_NO_ENCONTRADO");
    await tx.delete(turno).where(and(eq(turno.id, id), eq(turno.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "turno.eliminar",
      entidad: "turno",
      entidadId: id,
      antes: { servicioId: antes.servicioId, sectorId: antes.sectorId, diaSemana: antes.diaSemana, horaInicio: hhmm(antes.horaInicio), horaFin: hhmm(antes.horaFin) },
    });
  });
}
