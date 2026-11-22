import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant } from "../db/context";
import { junta, tokenRecuperacion, usuario } from "../db/schema";
import { hashPassword, hashToken, nuevoToken, validarFortaleza } from "../auth/password";
import { revocarSesionesDeUsuario } from "../auth/session";
import { mailer } from "../mail/mailer";
import { auditar } from "./audit";
import { clasificarIdentificador } from "./auth-service";

const HORAS_VIGENCIA_TOKEN = 1;

/**
 * Siempre termina sin error (respuesta genérica): envía el enlace solo si la cuenta existe,
 * está activa y tiene correo.
 */
export async function solicitarRecuperacion(identificador: string, slug?: string): Promise<void> {
  const id = clasificarIdentificador(identificador);
  const envios = await withTenant({ role: "auth" }, async (tx) => {
    const condId = id.cedula
      ? eq(usuario.cedula, id.cedula)
      : sql`lower(${usuario.correo}) = ${id.correo ?? ""}`;
    const filas = await tx
      .select({ u: usuario, slug: junta.slug, nombreJunta: junta.nombre, estadoJunta: junta.estado })
      .from(usuario)
      .leftJoin(junta, eq(junta.id, usuario.tenantId))
      .where(condId);

    const lista: { para: string; token: string; nombreJunta: string | null }[] = [];
    for (const f of filas) {
      if (slug && f.slug !== slug.trim().toLowerCase()) continue;
      if (f.u.estado !== "activo" || !f.u.correo) continue;
      if (f.u.tenantId && f.estadoJunta !== "activa") continue;
      const { token, hash } = nuevoToken();
      await tx.insert(tokenRecuperacion).values({
        usuarioId: f.u.id,
        tokenHash: hash,
        expiraEn: new Date(Date.now() + HORAS_VIGENCIA_TOKEN * 3600_000),
      });
      lista.push({ para: f.u.correo, token, nombreJunta: f.nombreJunta });
    }
    return lista;
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  for (const e of envios) {
    await mailer().enviar({
      para: e.para,
      asunto: "Recuperación de contraseña",
      texto:
        `Recibimos una solicitud para restablecer su contraseña${e.nombreJunta ? ` (${e.nombreJunta})` : ""}.\n` +
        `Use este enlace dentro de 1 hora: ${base}/recuperar?token=${e.token}\n\n` +
        `Si usted no lo solicitó, ignore este mensaje.`,
    });
  }
}

export async function restablecerPassword(token: string, passwordNueva: string): Promise<void> {
  if (!validarFortaleza(passwordNueva)) throw new AppError("PASSWORD_DEBIL");
  const nuevoHash = await hashPassword(passwordNueva);

  const valido = await withTenant({ role: "auth" }, async (tx) => {
    const [t] = await tx
      .select()
      .from(tokenRecuperacion)
      .where(
        and(
          eq(tokenRecuperacion.tokenHash, hashToken(token)),
          isNull(tokenRecuperacion.usadoEn),
          gt(tokenRecuperacion.expiraEn, new Date()),
        ),
      )
      .limit(1);
    if (!t) return false;

    // el uso del token es atómico: solo uno puede marcarlo
    const marcado = await tx
      .update(tokenRecuperacion)
      .set({ usadoEn: new Date() })
      .where(and(eq(tokenRecuperacion.id, t.id), isNull(tokenRecuperacion.usadoEn)))
      .returning({ id: tokenRecuperacion.id });
    if (marcado.length === 0) return false;

    const [u] = await tx
      .update(usuario)
      .set({
        passwordHash: nuevoHash,
        debeCambiarPassword: false,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      })
      .where(eq(usuario.id, t.usuarioId))
      .returning({ id: usuario.id, tenantId: usuario.tenantId });
    if (!u) return false;
    await revocarSesionesDeUsuario(tx, u.id);
    await auditar(tx, {
      actorId: u.id,
      tenantId: u.tenantId,
      accion: "usuario.password_restablecida",
      entidad: "usuario",
      entidadId: u.id,
    });
    return true;
  });

  if (!valido) throw new AppError("TOKEN_INVALIDO");
}

export async function cambiarPasswordInicial(userId: string, passwordNueva: string): Promise<void> {
  if (!validarFortaleza(passwordNueva)) throw new AppError("PASSWORD_DEBIL");
  const nuevoHash = await hashPassword(passwordNueva);
  await withTenant({ role: "auth" }, async (tx) => {
    const [u] = await tx
      .update(usuario)
      .set({ passwordHash: nuevoHash, debeCambiarPassword: false })
      .where(eq(usuario.id, userId))
      .returning({ id: usuario.id, tenantId: usuario.tenantId });
    if (u) {
      await auditar(tx, {
        actorId: u.id,
        tenantId: u.tenantId,
        accion: "usuario.password_inicial_cambiada",
        entidad: "usuario",
        entidadId: u.id,
      });
    }
  });
}
