import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { esFechaFutura } from "@/lib/fechas";
import { withTenant, type Db, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { sector, socio } from "../db/schema";
import { normalizarCedula, validarCedula } from "../validation/cedula";
import type { EntradaCrearSocio, EntradaEditarSocio, FiltrosSocio } from "../validation/socio";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TAMANO_PAGINA_SOCIOS = 20;

export interface SocioListado {
  id: string;
  cedula: string;
  nombres: string;
  correo: string | null;
  telefono: string | null;
  sectorId: string;
  sectorNombre: string;
  estado: "activo" | "inactivo";
  fechaIngreso: string;
}

const COLUMNAS = {
  id: socio.id,
  cedula: socio.cedula,
  nombres: socio.nombres,
  correo: socio.correo,
  telefono: socio.telefono,
  sectorId: socio.sectorId,
  sectorNombre: sector.nombre,
  estado: socio.estado,
  fechaIngreso: socio.fechaIngreso,
};

function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function mapearViolacion(e: unknown): never {
  const v = codigoPg(e);
  if (v.codigo === "23505") {
    if (v.restriccion === "socio_tenant_correo_uq") {
      throw new AppError("CORREO_DUPLICADO", "Ya existe un socio con ese correo en la junta.", "correo");
    }
    throw new AppError("CEDULA_DUPLICADA", "Ya existe un socio con esa cédula en la junta.", "cedula");
  }
  if (v.codigo === "23503") throw new AppError("SECTOR_NO_ENCONTRADO", "El sector no existe.", "sectorId");
  throw e;
}

async function exigirSector(tx: Db, ctx: CtxTenant, sectorId: string): Promise<void> {
  const [s] = await tx
    .select({ id: sector.id })
    .from(sector)
    .where(and(eq(sector.id, sectorId), eq(sector.tenantId, ctx.tenantId)))
    .limit(1);
  if (!s) throw new AppError("SECTOR_NO_ENCONTRADO", "El sector no existe.", "sectorId");
}

function exigirFechaValida(fecha: string): void {
  if (esFechaFutura(fecha)) throw new AppError("FECHA_FUTURA", undefined, "fechaIngreso");
}

export interface PaginaSocios {
  items: SocioListado[];
  total: number;
  pagina: number;
  paginas: number;
}

export async function listarSocios(ctx: CtxTenant, filtros: FiltrosSocio): Promise<PaginaSocios> {
  const condiciones: (SQL | undefined)[] = [eq(socio.tenantId, ctx.tenantId)];
  if (filtros.busqueda) {
    const patron = `%${escaparLike(filtros.busqueda)}%`;
    condiciones.push(or(ilike(socio.nombres, patron), ilike(socio.cedula, patron)));
  }
  if (filtros.sectorId) condiciones.push(eq(socio.sectorId, filtros.sectorId));
  if (filtros.estado) condiciones.push(eq(socio.estado, filtros.estado));
  const donde = and(...condiciones);

  return withTenant(ctx, async (tx) => {
    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(socio)
      .where(donde);
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_SOCIOS));
    const pagina = Math.min(filtros.pagina, paginas);
    const items = await tx
      .select(COLUMNAS)
      .from(socio)
      .innerJoin(sector, and(eq(sector.id, socio.sectorId), eq(sector.tenantId, socio.tenantId)))
      .where(donde)
      .orderBy(asc(sql`lower(${socio.nombres})`), asc(socio.id))
      .limit(TAMANO_PAGINA_SOCIOS)
      .offset((pagina - 1) * TAMANO_PAGINA_SOCIOS);
    return { items, total, pagina, paginas };
  });
}

export async function obtenerSocio(ctx: CtxTenant, id: string): Promise<SocioListado | null> {
  return withTenant(ctx, async (tx) => {
    const [s] = await tx
      .select(COLUMNAS)
      .from(socio)
      .innerJoin(sector, and(eq(sector.id, socio.sectorId), eq(sector.tenantId, socio.tenantId)))
      .where(and(eq(socio.id, id), eq(socio.tenantId, ctx.tenantId)))
      .limit(1);
    return s ?? null;
  });
}

export async function crearSocio(ctx: CtxTenant, e: EntradaCrearSocio): Promise<{ id: string }> {
  const cedula = normalizarCedula(e.cedula);
  if (!validarCedula(cedula)) throw new AppError("CEDULA_INVALIDA", undefined, "cedula");
  exigirFechaValida(e.fechaIngreso);

  try {
    return await withTenant(ctx, async (tx) => {
      await exigirSector(tx, ctx, e.sectorId);
      const [nuevo] = await tx
        .insert(socio)
        .values({
          tenantId: ctx.tenantId,
          cedula,
          nombres: e.nombres.trim(),
          sectorId: e.sectorId,
          telefono: e.telefono?.trim() || null,
          correo: e.correo?.trim().toLowerCase() || null,
          fechaIngreso: e.fechaIngreso,
        })
        .returning({ id: socio.id });
      if (!nuevo) throw new AppError("ERROR_INTERNO");
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "socio.crear",
        entidad: "socio",
        entidadId: nuevo.id,
        despues: { cedula, nombres: e.nombres.trim(), sectorId: e.sectorId, fechaIngreso: e.fechaIngreso },
      });
      return nuevo;
    });
  } catch (err) {
    return mapearViolacion(err);
  }
}

/** Edita los datos del socio; la cédula no cambia nunca. */
export async function editarSocio(ctx: CtxTenant, id: string, e: EntradaEditarSocio): Promise<void> {
  exigirFechaValida(e.fechaIngreso);
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx
        .select()
        .from(socio)
        .where(and(eq(socio.id, id), eq(socio.tenantId, ctx.tenantId)))
        .limit(1);
      if (!antes) throw new AppError("SOCIO_NO_ENCONTRADO");
      await exigirSector(tx, ctx, e.sectorId);
      const [despues] = await tx
        .update(socio)
        .set({
          nombres: e.nombres.trim(),
          sectorId: e.sectorId,
          telefono: e.telefono?.trim() || null,
          correo: e.correo?.trim().toLowerCase() || null,
          fechaIngreso: e.fechaIngreso,
          actualizadoEn: new Date(),
        })
        .where(and(eq(socio.id, id), eq(socio.tenantId, ctx.tenantId)))
        .returning({
          nombres: socio.nombres,
          sectorId: socio.sectorId,
          telefono: socio.telefono,
          correo: socio.correo,
          fechaIngreso: socio.fechaIngreso,
        });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "socio.editar",
        entidad: "socio",
        entidadId: id,
        antes: {
          nombres: antes.nombres,
          sectorId: antes.sectorId,
          telefono: antes.telefono,
          correo: antes.correo,
          fechaIngreso: antes.fechaIngreso,
        },
        despues,
      });
    });
  } catch (err) {
    return mapearViolacion(err);
  }
}

async function cambiarEstado(ctx: CtxTenant, id: string, estado: "activo" | "inactivo"): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx
      .select({ estado: socio.estado })
      .from(socio)
      .where(and(eq(socio.id, id), eq(socio.tenantId, ctx.tenantId)))
      .limit(1);
    if (!antes) throw new AppError("SOCIO_NO_ENCONTRADO");
    if (antes.estado === estado) return;
    await tx
      .update(socio)
      .set({ estado, actualizadoEn: new Date() })
      .where(and(eq(socio.id, id), eq(socio.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: estado === "inactivo" ? "socio.desactivar" : "socio.reactivar",
      entidad: "socio",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado },
    });
  });
}

/** Baja lógica: conserva historial y predios; el socio deja de aparecer en listas de asistencia nuevas. */
export const desactivarSocio = (ctx: CtxTenant, id: string) => cambiarEstado(ctx, id, "inactivo");
export const reactivarSocio = (ctx: CtxTenant, id: string) => cambiarEstado(ctx, id, "activo");
