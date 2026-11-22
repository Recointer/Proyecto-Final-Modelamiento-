import { AppError } from "@/lib/result";
import type { DbContext } from "../db/context";
import type { Rol } from "../db/schema";
import { usuarioActual, type UsuarioSesion } from "./session";

export interface Actor {
  user: UsuarioSesion;
  ctx: DbContext;
}

/** Contexto RLS para un usuario autenticado. */
export function contextoDe(user: UsuarioSesion): DbContext {
  if (user.rol === "super_admin") return { role: "super_admin", userId: user.userId };
  if (!user.tenantId) throw new AppError("NO_AUTORIZADO");
  return { role: "tenant", tenantId: user.tenantId, userId: user.userId };
}

/**
 * Autorización siempre en el servidor (Principio II). Lanza AppError si no hay sesión
 * o el rol no está permitido.
 */
export async function requireRole(...roles: Rol[]): Promise<Actor> {
  const user = await usuarioActual();
  if (!user) throw new AppError("NO_AUTENTICADO");
  if (user.debeCambiarPassword) throw new AppError("NO_AUTORIZADO", "Debe cambiar su contraseña.");
  if (!roles.includes(user.rol)) throw new AppError("NO_AUTORIZADO");
  return { user, ctx: contextoDe(user) };
}
