import { redirect } from "next/navigation";
import { destinoPorRol } from "@/lib/rutas";
import type { Rol } from "../db/schema";
import { usuarioActual, type UsuarioSesion } from "./session";

/** Para layouts y páginas: redirige si no hay sesión, debe cambiar contraseña o el rol no aplica. */
export async function exigirSesion(roles: Rol[]): Promise<UsuarioSesion> {
  const user = await usuarioActual();
  if (!user) redirect("/login");
  if (user.debeCambiarPassword) redirect("/cambiar-password");
  if (!roles.includes(user.rol)) redirect(destinoPorRol(user.rol));
  return user;
}
