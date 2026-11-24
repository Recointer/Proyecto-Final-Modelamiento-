import { redirect } from "next/navigation";
import { destinoPorRol } from "@/lib/rutas";
import type { DbContext } from "../db/context";
import type { Rol } from "../db/schema";
import { contextoDe } from "./guard";
import { usuarioActual, type UsuarioSesion } from "./session";

/** Para layouts y páginas: redirige si no hay sesión, debe cambiar contraseña o el rol no aplica. */
export async function exigirSesion(roles: Rol[]): Promise<UsuarioSesion> {
  const user = await usuarioActual();
  if (!user) redirect("/login");
  if (user.debeCambiarPassword) redirect("/cambiar-password");
  if (!roles.includes(user.rol)) redirect(destinoPorRol(user.rol));
  return user;
}

/** Contexto de base de datos del Super Administrador para páginas (redirige si no corresponde). */
export async function contextoSuperAdmin(): Promise<Extract<DbContext, { role: "super_admin" }>> {
  const user = await exigirSesion(["super_admin"]);
  const ctx = contextoDe(user);
  if (ctx.role !== "super_admin") redirect(destinoPorRol(user.rol));
  return ctx;
}

/** Contexto de base de datos del Administrador de la Junta para páginas (redirige si no corresponde). */
export async function contextoAdminJunta(): Promise<Extract<DbContext, { role: "tenant" }>> {
  const user = await exigirSesion(["admin_junta"]);
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") redirect(destinoPorRol(user.rol));
  return ctx;
}

/** Contexto de tenant y usuario para las pantallas de operación del módulo administrativo. */
export async function contextoGestion(roles: Rol[]): Promise<{ ctx: Extract<DbContext, { role: "tenant" }>; user: UsuarioSesion }> {
  const user = await exigirSesion(roles);
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") redirect(destinoPorRol(user.rol));
  return { ctx, user };
}
