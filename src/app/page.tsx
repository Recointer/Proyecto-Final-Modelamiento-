import { redirect } from "next/navigation";
import { destinoPorRol } from "@/lib/rutas";
import { usuarioActual } from "@/server/auth/session";

export default async function Inicio() {
  const user = await usuarioActual();
  redirect(user ? destinoPorRol(user.rol) : "/login");
}
