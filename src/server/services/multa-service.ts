import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { aCentavos, deCentavos } from "@/lib/dinero";
import { esFechaFutura, hoyEcuador } from "@/lib/fechas";
import { withTenant, type Db, type DbContext } from "../db/context";
import { asistencia, cargo, evento, junta } from "../db/schema";
import { parametrosDe } from "../validation/configuracion";
import { auditar } from "./audit";
import { conceptoDeMulta } from "./concepto-service";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface EventoParaMultas {
  id: string;
  tipo: "asamblea" | "minga";
  titulo: string;
  fecha: string;
  /** Ausentes injustificados con asistencia guardada. */
  ausentes: number;
  /** Multas vigentes ya generadas para el evento. */
  multasGeneradas: number;
  /** Monto configurado por la junta para este tipo de evento ("0.00" si no hay multa). */
  monto: string;
}

async function montoMulta(tx: Db, ctx: CtxTenant, tipo: "asamblea" | "minga"): Promise<string> {
  const [j] = await tx.select({ parametros: junta.parametros }).from(junta).where(eq(junta.id, ctx.tenantId)).limit(1);
  const p = parametrosDe(j?.parametros);
  return deCentavos(Math.round((tipo === "asamblea" ? p.multaAsamblea : p.multaMinga) * 100));
}

/** Eventos vigentes, ya realizados y con asistencia guardada, con su conteo de ausentes y multas. */
export async function listarEventosParaMultas(ctx: CtxTenant): Promise<EventoParaMultas[]> {
  return withTenant(ctx, async (tx) => {
    const filas = await tx
      .select({
        id: evento.id,
        tipo: evento.tipo,
        titulo: evento.titulo,
        fecha: evento.fecha,
        ausentes: sql<number>`(select count(*)::int from asistencia a where a.evento_id = "evento"."id" and a.estado = 'ausente')`,
        multasGeneradas: sql<number>`(select count(*)::int from cargo c where c.evento_id = "evento"."id" and c.anulado_en is null)`,
      })
      .from(evento)
      .where(
        and(
          eq(evento.tenantId, ctx.tenantId),
          eq(evento.estado, "activo"),
          lte(evento.fecha, hoyEcuador()),
          sql`${evento.asistenciaRegistradaEn} is not null`,
        ),
      )
      .orderBy(desc(evento.fecha), asc(evento.titulo));
    const montos = { asamblea: await montoMulta(tx, ctx, "asamblea"), minga: await montoMulta(tx, ctx, "minga") };
    return filas.map((f) => ({ ...f, monto: montos[f.tipo] }));
  });
}

export interface ResultadoMultas {
  generadas: number;
  existentes: number;
  monto: string;
}

/**
 * Genera una multa por cada socio ausente injustificado del evento, con el monto configurado por la
 * junta. Idempotente: el índice único (evento, socio) evita duplicados (RF-15).
 */
export async function generarMultas(ctx: CtxTenant, eventoId: string): Promise<ResultadoMultas> {
  return withTenant(ctx, async (tx) => {
    const [ev] = await tx
      .select()
      .from(evento)
      .where(and(eq(evento.id, eventoId), eq(evento.tenantId, ctx.tenantId)))
      .limit(1);
    if (!ev) throw new AppError("EVENTO_NO_ENCONTRADO");
    if (ev.estado === "anulado") throw new AppError("EVENTO_ANULADO");
    if (esFechaFutura(ev.fecha)) throw new AppError("EVENTO_FUTURO");
    if (!ev.asistenciaRegistradaEn) throw new AppError("EVENTO_SIN_ASISTENCIA");

    const monto = await montoMulta(tx, ctx, ev.tipo);
    if ((aCentavos(monto) ?? 0) <= 0) throw new AppError("MULTA_NO_CONFIGURADA");

    const ausentes = await tx
      .select({ socioId: asistencia.socioId })
      .from(asistencia)
      .where(and(eq(asistencia.eventoId, eventoId), eq(asistencia.tenantId, ctx.tenantId), eq(asistencia.estado, "ausente")));

    const conceptoId = await conceptoDeMulta(tx, ctx, ev.tipo);
    let generadas = 0;
    for (let i = 0; i < ausentes.length; i += 500) {
      const lote = ausentes.slice(i, i + 500).map((a) => ({
        tenantId: ctx.tenantId,
        conceptoId,
        socioId: a.socioId,
        anio: Number(ev.fecha.slice(0, 4)),
        monto,
        eventoId,
        creadoPor: ctx.userId,
      }));
      const creados = await tx.insert(cargo).values(lote).onConflictDoNothing().returning({ id: cargo.id });
      generadas += creados.length;
    }
    const existentes = ausentes.length - generadas;
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "multa.generar",
      entidad: "evento",
      entidadId: eventoId,
      despues: { monto, ausentes: ausentes.length, generadas, existentes },
    });
    return { generadas, existentes, monto };
  });
}

/**
 * Al anular un evento, anula sus multas sin pagos vigentes. Devuelve cuántas se anularon y cuántas
 * quedan con pagos (el Tesorero/a decide qué hacer con ellas). Se ejecuta en la transacción del evento.
 */
export async function anularMultasDeEvento(
  tx: Db,
  ctx: CtxTenant,
  eventoId: string,
): Promise<{ anuladas: number; conPagos: number }> {
  const anuladas = await tx.execute(sql`
    update cargo set anulado_en = now(), anulado_por = ${ctx.userId}, motivo_anulacion = 'Evento anulado'
     where evento_id = ${eventoId} and tenant_id = ${ctx.tenantId} and anulado_en is null
       and not exists (select 1 from pago p where p.cargo_id = cargo.id and p.anulado_en is null)
    returning id`);
  const filas = (await tx.execute(sql`
    select count(*)::int as n from cargo
     where evento_id = ${eventoId} and tenant_id = ${ctx.tenantId} and anulado_en is null`)) as unknown as { n: number }[];
  const n = Number(filas[0]?.n ?? 0);
  if (anuladas.length > 0 || n > 0) {
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "multa.anular_por_evento",
      entidad: "evento",
      entidadId: eventoId,
      despues: { anuladas: anuladas.length, conPagos: n },
    });
  }
  return { anuladas: anuladas.length, conPagos: n };
}
