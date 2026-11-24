import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { esFechaFutura } from "@/lib/fechas";
import { resumirAsistencia, type ResumenAsistencia } from "@/lib/quorum";
import { withTenant, type Db, type DbContext } from "../db/context";
import { asistencia, evento, junta, sector, socio } from "../db/schema";
import { parametrosDe } from "../validation/configuracion";
import type { FiltrosInasistencia, RegistroAsistencia } from "../validation/asistencia";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;
type EstadoAsistencia = "presente" | "ausente" | "justificado";

export interface ItemAsistencia {
  socioId: string;
  cedula: string;
  nombres: string;
  sectorNombre: string;
  /** Estado guardado; si todavía no se registró, «ausente» por defecto. */
  estado: EstadoAsistencia;
  motivo: string;
  /** false si el socio aún no tiene fila en este evento. */
  registrado: boolean;
  /** Socio dado de baja que ya tenía asistencia en este evento. */
  inactivo: boolean;
}

export interface ListaAsistencia {
  evento: { id: string; tipo: "asamblea" | "minga"; titulo: string; fecha: string; lugar: string; estado: "activo" | "anulado" };
  items: ItemAsistencia[];
  resumen: ResumenAsistencia;
  /** El evento admite registrar asistencia (activo y con fecha no futura). */
  puedeRegistrar: boolean;
  motivoBloqueo: "anulado" | "futuro" | null;
}

async function quorumDe(tx: Db, ctx: CtxTenant): Promise<number> {
  const [j] = await tx.select({ parametros: junta.parametros }).from(junta).where(eq(junta.id, ctx.tenantId)).limit(1);
  return parametrosDe(j?.parametros).quorumPorcentaje;
}

async function cargarEvento(tx: Db, ctx: CtxTenant, eventoId: string) {
  const [ev] = await tx
    .select()
    .from(evento)
    .where(and(eq(evento.id, eventoId), eq(evento.tenantId, ctx.tenantId)))
    .limit(1);
  if (!ev) throw new AppError("EVENTO_NO_ENCONTRADO");
  return ev;
}

/**
 * Lista de asistencia de un evento: socios activos con ingreso en o antes de la fecha del evento,
 * más quienes ya tienen asistencia registrada (aunque hoy estén de baja).
 */
export async function obtenerListaAsistencia(
  ctx: CtxTenant,
  eventoId: string,
  opciones: { busqueda?: string } = {},
): Promise<ListaAsistencia> {
  return withTenant(ctx, async (tx) => {
    const ev = await cargarEvento(tx, ctx, eventoId);
    const filas = await tx
      .select({
        socioId: socio.id,
        cedula: socio.cedula,
        nombres: socio.nombres,
        sectorNombre: sector.nombre,
        estadoSocio: socio.estado,
        estado: asistencia.estado,
        motivo: asistencia.motivo,
        asistenciaId: asistencia.id,
      })
      .from(socio)
      .innerJoin(sector, and(eq(sector.id, socio.sectorId), eq(sector.tenantId, socio.tenantId)))
      .leftJoin(asistencia, and(eq(asistencia.socioId, socio.id), eq(asistencia.eventoId, eventoId)))
      .where(
        and(
          eq(socio.tenantId, ctx.tenantId),
          or(and(eq(socio.estado, "activo"), lte(socio.fechaIngreso, ev.fecha)), isNotNull(asistencia.id)),
        ),
      )
      .orderBy(asc(sql`lower(${socio.nombres})`), asc(socio.id));

    const busqueda = opciones.busqueda?.trim().toLowerCase();
    const items: ItemAsistencia[] = filas
      .map((f) => ({
        socioId: f.socioId,
        cedula: f.cedula,
        nombres: f.nombres,
        sectorNombre: f.sectorNombre,
        estado: (f.estado ?? "ausente") as EstadoAsistencia,
        motivo: f.motivo ?? "",
        registrado: f.asistenciaId !== null,
        inactivo: f.estadoSocio === "inactivo",
      }))
      .filter((i) => !busqueda || i.nombres.toLowerCase().includes(busqueda) || i.cedula.includes(busqueda));

    const quorum = await quorumDe(tx, ctx);
    const futuro = esFechaFutura(ev.fecha);
    const motivoBloqueo = ev.estado === "anulado" ? "anulado" : futuro ? "futuro" : null;
    return {
      evento: { id: ev.id, tipo: ev.tipo, titulo: ev.titulo, fecha: ev.fecha, lugar: ev.lugar, estado: ev.estado },
      items,
      resumen: resumirAsistencia(items.map((i) => i.estado), quorum),
      puedeRegistrar: motivoBloqueo === null,
      motivoBloqueo,
    };
  });
}

/**
 * Guarda la asistencia de un evento en UNA transacción (upsert por evento y socio). Solo escribe lo que
 * cambió para que `modificado_*` sea exacto, completa `asistencia_registrada_en` y deja una entrada de
 * auditoría con el resumen de cambios.
 */
export async function guardarAsistencia(
  ctx: CtxTenant,
  eventoId: string,
  registros: RegistroAsistencia[],
): Promise<ResumenAsistencia> {
  if (registros.length === 0) throw new AppError("DATOS_INVALIDOS", "No hay asistencia que guardar.");
  const ids = registros.map((r) => r.socioId);
  if (new Set(ids).size !== ids.length) throw new AppError("DATOS_INVALIDOS", "Hay socios repetidos en la lista.");
  for (const r of registros) {
    if (r.estado === "justificado" && !r.motivo?.trim()) {
      throw new AppError("MOTIVO_REQUERIDO", "Indique el motivo de cada justificación.", `motivo-${r.socioId}`);
    }
  }

  return withTenant(ctx, async (tx) => {
    const ev = await cargarEvento(tx, ctx, eventoId);
    if (ev.estado === "anulado") throw new AppError("EVENTO_ANULADO");
    if (esFechaFutura(ev.fecha)) throw new AppError("EVENTO_FUTURO");

    const existentes = await tx.select().from(asistencia).where(eq(asistencia.eventoId, eventoId));
    const porSocio = new Map(existentes.map((a) => [a.socioId, a]));

    const socios = await tx
      .select({ id: socio.id, estado: socio.estado, fechaIngreso: socio.fechaIngreso })
      .from(socio)
      .where(and(eq(socio.tenantId, ctx.tenantId), inArray(socio.id, ids)));
    if (socios.length !== ids.length) throw new AppError("SOCIO_NO_PERMITIDO");
    for (const s of socios) {
      const yaRegistrado = porSocio.has(s.id);
      const habilitado = s.estado === "activo" && s.fechaIngreso <= ev.fecha;
      if (!yaRegistrado && !habilitado) throw new AppError("SOCIO_NO_PERMITIDO");
    }

    const nuevos: (typeof asistencia.$inferInsert)[] = [];
    const cambios: { socioId: string; de: string | null; a: string }[] = [];
    const ahora = new Date();

    for (const r of registros) {
      const motivo = r.estado === "justificado" ? (r.motivo ?? "").trim() : null;
      const actual = porSocio.get(r.socioId);
      if (!actual) {
        nuevos.push({
          tenantId: ctx.tenantId,
          eventoId,
          socioId: r.socioId,
          estado: r.estado,
          motivo,
          registradoPor: ctx.userId,
          modificadoPor: ctx.userId,
        });
        cambios.push({ socioId: r.socioId, de: null, a: r.estado });
      } else if (actual.estado !== r.estado || (actual.motivo ?? null) !== motivo) {
        await tx
          .update(asistencia)
          .set({ estado: r.estado, motivo, modificadoPor: ctx.userId, modificadoEn: ahora })
          .where(and(eq(asistencia.id, actual.id), eq(asistencia.tenantId, ctx.tenantId)));
        cambios.push({ socioId: r.socioId, de: actual.estado, a: r.estado });
      }
    }
    if (nuevos.length > 0) await tx.insert(asistencia).values(nuevos);

    if (ev.asistenciaRegistradaEn === null) {
      await tx
        .update(evento)
        .set({ asistenciaRegistradaEn: ahora })
        .where(and(eq(evento.id, eventoId), isNull(evento.asistenciaRegistradaEn)));
    }

    const finales = await tx.select({ estado: asistencia.estado }).from(asistencia).where(eq(asistencia.eventoId, eventoId));
    const resumen = resumirAsistencia(finales.map((f) => f.estado), await quorumDe(tx, ctx));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "asistencia.guardar",
      entidad: "evento",
      entidadId: eventoId,
      despues: {
        total: resumen.total,
        presentes: resumen.presentes,
        ausentes: resumen.ausentes,
        justificados: resumen.justificados,
        creados: nuevos.length,
        modificados: cambios.length - nuevos.length,
        cambios,
      },
    });
    return resumen;
  });
}

export interface InasistenciaInjustificada {
  socioId: string;
  cedula: string;
  nombres: string;
  eventoId: string;
  tipo: "asamblea" | "minga";
  titulo: string;
  fecha: string;
}

/**
 * Contrato con el módulo Financiero: inasistencias injustificadas (estado «ausente» en eventos activos)
 * por socio y evento. Este módulo NO calcula multas. El llamador valida el rol (Secretario/a,
 * Administrador o Tesorero/a).
 */
export async function listarInasistenciasInjustificadas(
  ctx: CtxTenant,
  filtros: FiltrosInasistencia = {},
): Promise<InasistenciaInjustificada[]> {
  return withTenant(ctx, async (tx) => {
    const condiciones = [
      eq(asistencia.tenantId, ctx.tenantId),
      eq(asistencia.estado, "ausente" as const),
      eq(evento.estado, "activo" as const),
    ];
    const extra = [
      filtros.desde ? sql`${evento.fecha} >= ${filtros.desde}` : undefined,
      filtros.hasta ? sql`${evento.fecha} <= ${filtros.hasta}` : undefined,
      filtros.socioId ? eq(asistencia.socioId, filtros.socioId) : undefined,
    ];
    return tx
      .select({
        socioId: socio.id,
        cedula: socio.cedula,
        nombres: socio.nombres,
        eventoId: evento.id,
        tipo: evento.tipo,
        titulo: evento.titulo,
        fecha: evento.fecha,
      })
      .from(asistencia)
      .innerJoin(evento, and(eq(evento.id, asistencia.eventoId), eq(evento.tenantId, asistencia.tenantId)))
      .innerJoin(socio, and(eq(socio.id, asistencia.socioId), eq(socio.tenantId, asistencia.tenantId)))
      .where(and(...condiciones, ...extra))
      .orderBy(asc(evento.fecha), asc(sql`lower(${socio.nombres})`));
  });
}
