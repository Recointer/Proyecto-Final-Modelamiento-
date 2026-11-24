import { and, asc, desc, eq } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { esPasada, formatoFecha } from "@/lib/fechas";
import { withTenant, type DbContext } from "../db/context";
import { convocatoria, evento, junta, socio } from "../db/schema";
import { mailer } from "../mail/mailer";
import { ETIQUETA_TIPO_CONVOCATORIA, type EntradaConvocatoria } from "../validation/comunicaciones";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface FilaConvocatoria {
  id: string;
  tipo: "asamblea" | "minga";
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
  ordenDia: string | null;
  eventoId: string | null;
  eventoTitulo: string | null;
  estado: "vigente" | "anulado";
  motivoAnulacion: string | null;
  notificados: number;
  /** Ya pasó la fecha y hora (hora de Ecuador). */
  pasada: boolean;
}

export interface ResultadoEmision {
  id: string;
  /** Avisos por correo enviados. */
  notificados: number;
  /** Avisos que no pudieron enviarse. */
  fallidos: number;
}

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Emite la convocatoria (queda publicada) y, si se pide, avisa por correo a los socios activos con
 * correo. El envío ocurre después de confirmar la publicación: un fallo nunca la deshace.
 */
export async function emitirConvocatoria(ctx: CtxTenant, e: EntradaConvocatoria, ahora: Date = new Date()): Promise<ResultadoEmision> {
  if (esPasada(e.fecha, e.hora, ahora)) throw new AppError("FECHA_PASADA", undefined, "fecha");
  const eventoId = e.eventoId || null;

  const { id, juntaNombre, destinatarios } = await withTenant(ctx, async (tx) => {
    if (eventoId) {
      const [ev] = await tx
        .select({ estado: evento.estado })
        .from(evento)
        .where(and(eq(evento.id, eventoId), eq(evento.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ev || ev.estado !== "activo") throw new AppError("EVENTO_NO_VALIDO", undefined, "eventoId");
    }
    const [c] = await tx
      .insert(convocatoria)
      .values({
        tenantId: ctx.tenantId,
        tipo: e.tipo,
        titulo: e.titulo,
        fecha: e.fecha,
        hora: e.hora,
        lugar: e.lugar,
        ordenDia: e.ordenDia || null,
        eventoId,
        creadoPor: ctx.userId,
      })
      .returning({ id: convocatoria.id });
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "convocatoria.emitir",
      entidad: "convocatoria",
      entidadId: c!.id,
      despues: { tipo: e.tipo, titulo: e.titulo, fecha: e.fecha, hora: e.hora, lugar: e.lugar, eventoId, avisar: Boolean(e.avisar) },
    });
    const [j] = await tx.select({ nombre: junta.nombre }).from(junta).where(eq(junta.id, ctx.tenantId)).limit(1);
    const destinatarios = e.avisar
      ? await tx
          .select({ nombres: socio.nombres, correo: socio.correo })
          .from(socio)
          .where(and(eq(socio.tenantId, ctx.tenantId), eq(socio.estado, "activo")))
      : [];
    return { id: c!.id, juntaNombre: j?.nombre ?? "su junta", destinatarios };
  });

  let notificados = 0;
  let fallidos = 0;
  for (const d of destinatarios) {
    if (!d.correo) continue;
    try {
      await mailer().enviar({
        para: d.correo,
        asunto: `Convocatoria: ${e.titulo}`,
        texto: [
          `Estimado/a ${d.nombres}:`,
          "",
          `${juntaNombre} le convoca a ${ETIQUETA_TIPO_CONVOCATORIA[e.tipo].toLowerCase()}.`,
          "",
          `Tema: ${e.titulo}`,
          `Fecha: ${formatoFecha(e.fecha)} a las ${e.hora}`,
          `Lugar: ${e.lugar}`,
          ...(e.ordenDia ? ["", "Orden del día:", e.ordenDia] : []),
          "",
          "Su asistencia es importante.",
        ].join("\n"),
      });
      notificados++;
    } catch {
      fallidos++; // sin datos personales en los logs
    }
  }
  if (notificados > 0) {
    await withTenant(ctx, (tx) =>
      tx.update(convocatoria).set({ notificados }).where(and(eq(convocatoria.id, id), eq(convocatoria.tenantId, ctx.tenantId))),
    );
  }
  return { id, notificados, fallidos };
}

/** Convocatorias de la junta. `soloVisibles` (Socio): únicamente las vigentes. */
export async function listarConvocatorias(
  ctx: CtxTenant,
  opciones: { soloVisibles?: boolean } = {},
  ahora: Date = new Date(),
): Promise<FilaConvocatoria[]> {
  const filas = await withTenant(ctx, (tx) =>
    tx
      .select({
        id: convocatoria.id,
        tipo: convocatoria.tipo,
        titulo: convocatoria.titulo,
        fecha: convocatoria.fecha,
        hora: convocatoria.hora,
        lugar: convocatoria.lugar,
        ordenDia: convocatoria.ordenDia,
        eventoId: convocatoria.eventoId,
        eventoTitulo: evento.titulo,
        estado: convocatoria.estado,
        motivoAnulacion: convocatoria.motivoAnulacion,
        notificados: convocatoria.notificados,
      })
      .from(convocatoria)
      .leftJoin(evento, and(eq(evento.id, convocatoria.eventoId), eq(evento.tenantId, convocatoria.tenantId)))
      .where(and(eq(convocatoria.tenantId, ctx.tenantId), opciones.soloVisibles ? eq(convocatoria.estado, "vigente") : undefined))
      .orderBy(desc(convocatoria.fecha), asc(convocatoria.hora))
      .limit(300),
  );
  return filas.map((f) => ({ ...f, hora: hhmm(f.hora), pasada: esPasada(f.fecha, hhmm(f.hora), ahora) }));
}

export async function anularConvocatoria(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [c] = await tx
      .select({ estado: convocatoria.estado, titulo: convocatoria.titulo })
      .from(convocatoria)
      .where(and(eq(convocatoria.id, id), eq(convocatoria.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!c) throw new AppError("CONVOCATORIA_NO_ENCONTRADA");
    if (c.estado === "anulado") throw new AppError("CONVOCATORIA_ANULADA");
    await tx
      .update(convocatoria)
      .set({ estado: "anulado", anuladoPor: ctx.userId, anuladoEn: new Date(), motivoAnulacion: motivo })
      .where(and(eq(convocatoria.id, id), eq(convocatoria.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "convocatoria.anular",
      entidad: "convocatoria",
      entidadId: id,
      antes: { estado: "vigente", titulo: c.titulo },
      despues: { motivo },
    });
  });
}

/** Eventos activos recientes y próximos, para vincular a una convocatoria. */
export async function eventosParaVincular(ctx: CtxTenant): Promise<{ id: string; titulo: string; fecha: string }[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({ id: evento.id, titulo: evento.titulo, fecha: evento.fecha })
      .from(evento)
      .where(and(eq(evento.tenantId, ctx.tenantId), eq(evento.estado, "activo")))
      .orderBy(desc(evento.fecha))
      .limit(100),
  );
}
