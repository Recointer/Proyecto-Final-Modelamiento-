import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { withTenant, type Db } from "../db/context";
import { junta, sesion, usuario, type Rol } from "../db/schema";
import { hashToken, nuevoToken } from "./password";

export const COOKIE_SESION = "sesion";
const HORAS_NORMAL = 12;
const DIAS_RECORDAR = 30;

export interface UsuarioSesion {
  userId: string;
  cedula: string;
  nombres: string;
  rol: Rol;
  tenantId: string | null;
  juntaNombre: string | null;
  debeCambiarPassword: boolean;
}

export function calcularExpiracion(recordar: boolean, ahora = new Date()): Date {
  const ms = recordar ? DIAS_RECORDAR * 24 * 3600_000 : HORAS_NORMAL * 3600_000;
  return new Date(ahora.getTime() + ms);
}

/** Crea la sesión en BD (dentro de la transacción dada) y devuelve el token en claro. */
export async function crearSesionEnBd(
  tx: Db,
  u: { id: string; tenantId: string | null },
  recordar: boolean,
): Promise<{ token: string; expiraEn: Date }> {
  const { token, hash } = nuevoToken();
  const expiraEn = calcularExpiracion(recordar);
  await tx.insert(sesion).values({
    usuarioId: u.id,
    tenantId: u.tenantId,
    tokenHash: hash,
    expiraEn,
    recordar,
  });
  return { token, expiraEn };
}

export async function fijarCookieSesion(token: string, expiraEn: Date, recordar: boolean) {
  const jar = await cookies();
  jar.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(recordar ? { expires: expiraEn } : {}),
  });
}

export async function borrarCookieSesion() {
  const jar = await cookies();
  jar.delete(COOKIE_SESION);
}

/** Valida el token: sesión vigente, usuario activo y junta activa. */
export async function validarToken(token: string): Promise<UsuarioSesion | null> {
  return withTenant({ role: "auth" }, async (tx) => {
    const filas = await tx
      .select({
        userId: usuario.id,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        rol: usuario.rol,
        tenantId: usuario.tenantId,
        estado: usuario.estado,
        debe: usuario.debeCambiarPassword,
        juntaNombre: junta.nombre,
        juntaEstado: junta.estado,
      })
      .from(sesion)
      .innerJoin(usuario, eq(usuario.id, sesion.usuarioId))
      .leftJoin(junta, eq(junta.id, usuario.tenantId))
      .where(and(eq(sesion.tokenHash, hashToken(token)), gt(sesion.expiraEn, new Date())))
      .limit(1);
    const f = filas[0];
    if (!f || f.estado !== "activo") return null;
    if (f.tenantId && f.juntaEstado !== "activa") return null;
    return {
      userId: f.userId,
      cedula: f.cedula,
      nombres: f.nombres,
      rol: f.rol,
      tenantId: f.tenantId,
      juntaNombre: f.juntaNombre,
      debeCambiarPassword: f.debe,
    };
  });
}

export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESION)?.value;
  return token ? validarToken(token) : null;
}

export async function revocarToken(token: string): Promise<void> {
  await withTenant({ role: "auth" }, (tx) =>
    tx.delete(sesion).where(eq(sesion.tokenHash, hashToken(token))),
  );
}

/** Cierra todas las sesiones de un usuario (función acotada por contexto; ver migración 0004). */
export async function revocarSesionesDeUsuario(tx: Db, userId: string): Promise<void> {
  await tx.execute(sql`select revocar_sesiones_usuario(${userId}::uuid)`);
}

export async function revocarSesionesDeJunta(tx: Db, juntaId: string): Promise<void> {
  await tx.delete(sesion).where(eq(sesion.tenantId, juntaId));
}
