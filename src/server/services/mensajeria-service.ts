import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { hilo, mensaje, usuario } from "../db/schema";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;
/** Las dos partes de la conversación: el Administrador de la Junta y el Socio con cuenta. */
export type RolMensajeria = "admin_junta" | "socio";

export interface FilaHilo {
  id: string;
  asunto: string;
  socioNombres: string;
  ultimoMensajeEn: Date;
  noLeidos: number;
}

export interface MensajeHilo {
  id: string;
  autorNombres: string;
  deAdministracion: boolean;
  texto: string;
  creadoEn: Date;
}

export interface DetalleHilo {
  id: string;
  asunto: string;
  socioNombres: string;
  mensajes: MensajeHilo[];
}

/** Un mensaje es «no leído» para quien lo recibe: lo escribió la otra parte y nadie lo abrió. */
const esDeLaOtraParte = (rol: RolMensajeria) => eq(mensaje.deAdministracion, rol === "socio");

/** Conversación visible para el rol: el Socio solo las suyas; el Administrador todas las de la junta. */
async function cargarHilo(tx: Db, ctx: CtxTenant, rol: RolMensajeria, id: string) {
  const [h] = await tx
    .select({ id: hilo.id, asunto: hilo.asunto, usuarioId: hilo.usuarioId, socioNombres: usuario.nombres })
    .from(hilo)
    .innerJoin(usuario, and(eq(usuario.id, hilo.usuarioId), eq(usuario.tenantId, hilo.tenantId)))
    .where(and(eq(hilo.id, id), eq(hilo.tenantId, ctx.tenantId), rol === "socio" ? eq(hilo.usuarioId, ctx.userId) : undefined))
    .limit(1);
  if (!h) throw new AppError("HILO_NO_ENCONTRADO");
  return h;
}

/**
 * Inicia una conversación. El Socio escribe al Administrador (su cuenta sale de la sesión); el
 * Administrador elige a un socio con cuenta activa.
 */
export async function iniciarHilo(
  ctx: CtxTenant,
  rol: RolMensajeria,
  e: { asunto: string; texto: string; usuarioId?: string },
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    let destino = ctx.userId;
    if (rol === "admin_junta") {
      if (!z.string().uuid().safeParse(e.usuarioId).success) throw new AppError("DESTINATARIO_NO_VALIDO", undefined, "usuarioId");
      const [s] = await tx
        .select({ id: usuario.id })
        .from(usuario)
        .where(and(eq(usuario.id, e.usuarioId!), eq(usuario.tenantId, ctx.tenantId), eq(usuario.rol, "socio"), eq(usuario.estado, "activo")))
        .limit(1);
      if (!s) throw new AppError("DESTINATARIO_NO_VALIDO", undefined, "usuarioId");
      destino = s.id;
    }
    const [h] = await tx
      .insert(hilo)
      .values({ tenantId: ctx.tenantId, usuarioId: destino, asunto: e.asunto, iniciadoPorAdmin: rol === "admin_junta" })
      .returning({ id: hilo.id });
    await tx.insert(mensaje).values({
      tenantId: ctx.tenantId,
      hiloId: h!.id,
      autorId: ctx.userId,
      deAdministracion: rol === "admin_junta",
      texto: e.texto,
    });
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "hilo.iniciar",
      entidad: "hilo",
      entidadId: h!.id,
      despues: { asunto: e.asunto, socioUsuarioId: destino, iniciadoPorAdmin: rol === "admin_junta" },
    });
    return { id: h!.id };
  });
}

export async function responder(ctx: CtxTenant, rol: RolMensajeria, e: { hiloId: string; texto: string }): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await cargarHilo(tx, ctx, rol, e.hiloId);
    await tx.insert(mensaje).values({
      tenantId: ctx.tenantId,
      hiloId: e.hiloId,
      autorId: ctx.userId,
      deAdministracion: rol === "admin_junta",
      texto: e.texto,
    });
    await tx.update(hilo).set({ ultimoMensajeEn: new Date() }).where(and(eq(hilo.id, e.hiloId), eq(hilo.tenantId, ctx.tenantId)));
  });
}

/** Bandeja ordenada por la última actividad, con los no leídos de cada conversación. */
export async function listarHilos(ctx: CtxTenant, rol: RolMensajeria): Promise<FilaHilo[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({
        id: hilo.id,
        asunto: hilo.asunto,
        socioNombres: usuario.nombres,
        ultimoMensajeEn: hilo.ultimoMensajeEn,
        noLeidos: sql<number>`(select count(*)::int from mensaje m where m.hilo_id = "hilo"."id" and m.leido_en is null and m.de_administracion = ${rol === "socio"})`,
      })
      .from(hilo)
      .innerJoin(usuario, and(eq(usuario.id, hilo.usuarioId), eq(usuario.tenantId, hilo.tenantId)))
      .where(and(eq(hilo.tenantId, ctx.tenantId), rol === "socio" ? eq(hilo.usuarioId, ctx.userId) : undefined))
      .orderBy(desc(hilo.ultimoMensajeEn))
      .limit(200),
  );
}

/** Abre la conversación y marca como leídos los mensajes de la otra parte. */
export async function abrirHilo(ctx: CtxTenant, rol: RolMensajeria, id: string): Promise<DetalleHilo> {
  return withTenant(ctx, async (tx) => {
    const h = await cargarHilo(tx, ctx, rol, id);
    await tx
      .update(mensaje)
      .set({ leidoEn: new Date() })
      .where(and(eq(mensaje.hiloId, id), eq(mensaje.tenantId, ctx.tenantId), isNull(mensaje.leidoEn), esDeLaOtraParte(rol)));
    const mensajes = await tx
      .select({
        id: mensaje.id,
        autorNombres: usuario.nombres,
        deAdministracion: mensaje.deAdministracion,
        texto: mensaje.texto,
        creadoEn: mensaje.creadoEn,
      })
      .from(mensaje)
      .innerJoin(usuario, eq(usuario.id, mensaje.autorId))
      .where(and(eq(mensaje.hiloId, id), eq(mensaje.tenantId, ctx.tenantId)))
      .orderBy(asc(mensaje.creadoEn), asc(mensaje.id));
    return { id: h.id, asunto: h.asunto, socioNombres: h.socioNombres, mensajes };
  });
}

export async function totalNoLeidos(ctx: CtxTenant, rol: RolMensajeria): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(mensaje)
      .innerJoin(hilo, and(eq(hilo.id, mensaje.hiloId), eq(hilo.tenantId, mensaje.tenantId)))
      .where(
        and(
          eq(mensaje.tenantId, ctx.tenantId),
          isNull(mensaje.leidoEn),
          esDeLaOtraParte(rol),
          rol === "socio" ? eq(hilo.usuarioId, ctx.userId) : undefined,
        ),
      );
    return r?.n ?? 0;
  });
}

/** Socios con cuenta activa, para que el Administrador inicie una conversación. */
export async function sociosConCuenta(ctx: CtxTenant): Promise<{ id: string; nombres: string; cedula: string }[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({ id: usuario.id, nombres: usuario.nombres, cedula: usuario.cedula })
      .from(usuario)
      .where(and(eq(usuario.tenantId, ctx.tenantId), eq(usuario.rol, "socio"), eq(usuario.estado, "activo")))
      .orderBy(asc(sql`lower(${usuario.nombres})`))
      .limit(1000),
  );
}
