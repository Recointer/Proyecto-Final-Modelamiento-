import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type DbContext } from "../db/context";
import { evento } from "../db/schema";
import type { EntradaEvento, FiltrosEvento } from "../validation/evento";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TAMANO_PAGINA_EVENTOS = 20;

export interface EventoListado {
  id: string;
  tipo: "asamblea" | "minga";
  titulo: string;
  fecha: string;
  lugar: string;
  estado: "activo" | "anulado";
  motivoAnulacion: string | null;
  asistenciaRegistrada: boolean;
  /** Filas de asistencia guardadas (solo informativo en el listado). */
  registrados: number;
  presentes: number;
}

// "evento"."id" calificado a mano: en consultas de una sola tabla Drizzle omite el prefijo y,
// dentro de una subconsulta, apuntaría a la tabla interna.
const registradosSql = sql<number>`(select count(*)::int from asistencia a where a.evento_id = "evento"."id")`;
const presentesSql = sql<number>`(select count(*)::int from asistencia a where a.evento_id = "evento"."id" and a.estado = 'presente')`;

const COLUMNAS = {
  id: evento.id,
  tipo: evento.tipo,
  titulo: evento.titulo,
  fecha: evento.fecha,
  lugar: evento.lugar,
  estado: evento.estado,
  motivoAnulacion: evento.motivoAnulacion,
  asistenciaRegistradaEn: evento.asistenciaRegistradaEn,
  registrados: registradosSql,
  presentes: presentesSql,
};

function aListado(f: {
  id: string;
  tipo: "asamblea" | "minga";
  titulo: string;
  fecha: string;
  lugar: string;
  estado: "activo" | "anulado";
  motivoAnulacion: string | null;
  asistenciaRegistradaEn: Date | null;
  registrados: number;
  presentes: number;
}): EventoListado {
  const { asistenciaRegistradaEn, ...resto } = f;
  return { ...resto, asistenciaRegistrada: asistenciaRegistradaEn !== null };
}

export interface PaginaEventos {
  items: EventoListado[];
  total: number;
  pagina: number;
  paginas: number;
}

export async function listarEventos(ctx: CtxTenant, filtros: FiltrosEvento): Promise<PaginaEventos> {
  const condiciones: (SQL | undefined)[] = [eq(evento.tenantId, ctx.tenantId)];
  if (filtros.tipo) condiciones.push(eq(evento.tipo, filtros.tipo));
  if (filtros.estado) condiciones.push(eq(evento.estado, filtros.estado));
  if (filtros.desde) condiciones.push(gte(evento.fecha, filtros.desde));
  if (filtros.hasta) condiciones.push(lte(evento.fecha, filtros.hasta));
  const donde = and(...condiciones);

  return withTenant(ctx, async (tx) => {
    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(evento)
      .where(donde);
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_EVENTOS));
    const pagina = Math.min(filtros.pagina, paginas);
    const filas = await tx
      .select(COLUMNAS)
      .from(evento)
      .where(donde)
      .orderBy(desc(evento.fecha), desc(evento.creadoEn))
      .limit(TAMANO_PAGINA_EVENTOS)
      .offset((pagina - 1) * TAMANO_PAGINA_EVENTOS);
    return { items: filas.map(aListado), total, pagina, paginas };
  });
}

export async function obtenerEvento(ctx: CtxTenant, id: string): Promise<EventoListado | null> {
  return withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select(COLUMNAS)
      .from(evento)
      .where(and(eq(evento.id, id), eq(evento.tenantId, ctx.tenantId)))
      .limit(1);
    return f ? aListado(f) : null;
  });
}

export async function crearEvento(ctx: CtxTenant, e: EntradaEvento): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const [nuevo] = await tx
      .insert(evento)
      .values({
        tenantId: ctx.tenantId,
        tipo: e.tipo,
        titulo: e.titulo.trim(),
        fecha: e.fecha,
        lugar: e.lugar.trim(),
        creadoPor: ctx.userId,
      })
      .returning({ id: evento.id });
    if (!nuevo) throw new AppError("ERROR_INTERNO");
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "evento.crear",
      entidad: "evento",
      entidadId: nuevo.id,
      despues: { tipo: e.tipo, titulo: e.titulo.trim(), fecha: e.fecha, lugar: e.lugar.trim() },
    });
    return nuevo;
  });
}

export async function editarEvento(ctx: CtxTenant, id: string, e: EntradaEvento): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx
      .select()
      .from(evento)
      .where(and(eq(evento.id, id), eq(evento.tenantId, ctx.tenantId)))
      .limit(1);
    if (!antes) throw new AppError("EVENTO_NO_ENCONTRADO");
    if (antes.estado === "anulado") throw new AppError("EVENTO_ANULADO");
    const [despues] = await tx
      .update(evento)
      .set({ tipo: e.tipo, titulo: e.titulo.trim(), fecha: e.fecha, lugar: e.lugar.trim() })
      .where(and(eq(evento.id, id), eq(evento.tenantId, ctx.tenantId)))
      .returning({ tipo: evento.tipo, titulo: evento.titulo, fecha: evento.fecha, lugar: evento.lugar });
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "evento.editar",
      entidad: "evento",
      entidadId: id,
      antes: { tipo: antes.tipo, titulo: antes.titulo, fecha: antes.fecha, lugar: antes.lugar },
      despues,
    });
  });
}

/** Anulación irreversible con motivo: los eventos nunca se eliminan (conservan el historial). */
export async function anularEvento(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  const m = motivo.trim();
  if (m.length < 5) throw new AppError("MOTIVO_REQUERIDO", undefined, "motivo");
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx
      .select({ estado: evento.estado })
      .from(evento)
      .where(and(eq(evento.id, id), eq(evento.tenantId, ctx.tenantId)))
      .limit(1);
    if (!antes) throw new AppError("EVENTO_NO_ENCONTRADO");
    if (antes.estado === "anulado") throw new AppError("EVENTO_ANULADO");
    await tx
      .update(evento)
      .set({ estado: "anulado", motivoAnulacion: m, anuladoPor: ctx.userId, anuladoEn: new Date() })
      .where(and(eq(evento.id, id), eq(evento.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "evento.anular",
      entidad: "evento",
      entidadId: id,
      antes: { estado: "activo" },
      despues: { estado: "anulado", motivo: m },
    });
  });
}
