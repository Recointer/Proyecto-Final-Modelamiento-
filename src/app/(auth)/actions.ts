"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { AppError, ejecutar, fail, type Result } from "@/lib/result";
import { destinoPorRol } from "@/lib/rutas";
import { iniciarSesion } from "@/server/services/auth-service";
import {
  cambiarPasswordInicial as cambiarPasswordServicio,
  restablecerPassword as restablecerServicio,
  solicitarRecuperacion as solicitarServicio,
} from "@/server/services/password-service";
import {
  borrarCookieSesion,
  COOKIE_SESION,
  fijarCookieSesion,
  revocarToken,
  usuarioActual,
} from "@/server/auth/session";

export interface EstadoForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  juntas?: { slug: string; nombre: string }[];
  exito?: string;
  /** Valores no sensibles para repoblar el formulario tras un error (nunca contraseñas). */
  valores?: { junta?: string; identificador?: string };
}

const loginSchema = z.object({
  junta: z.string().trim().max(60).optional(),
  identificador: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(200),
  recordar: z.boolean(),
});

function aEstado(r: Result<unknown>): EstadoForm {
  return r.ok ? {} : { error: r.error };
}

export async function iniciarSesionAction(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const valores = {
    junta: String(formData.get("junta") ?? ""),
    identificador: String(formData.get("identificador") ?? ""),
  };
  const parsed = loginSchema.safeParse({
    junta: valores.junta || undefined,
    identificador: valores.identificador,
    password: String(formData.get("password") ?? ""),
    recordar: formData.get("recordar") === "on",
  });
  if (!parsed.success) return { ...aEstado(fail("DATOS_INVALIDOS")), valores };

  let destino = "";
  try {
    const s = await iniciarSesion(parsed.data);
    await fijarCookieSesion(s.token, s.expiraEn, s.recordar);
    destino = s.debeCambiarPassword ? "/cambiar-password" : destinoPorRol(s.rol);
  } catch (e) {
    if (e instanceof AppError) {
      const juntas = (e as AppError & { juntas?: EstadoForm["juntas"] }).juntas;
      return { error: { codigo: e.codigo, mensaje: e.message }, juntas, valores };
    }
    console.error("Error al iniciar sesión");
    return { ...aEstado(fail("ERROR_INTERNO")), valores };
  }
  redirect(destino);
}

export async function cerrarSesionAction(): Promise<void> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (token) await revocarToken(token);
  await borrarCookieSesion();
  redirect("/login");
}

export async function solicitarRecuperacionAction(
  _: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const identificador = String(formData.get("identificador") ?? "").trim();
  const junta = String(formData.get("junta") ?? "").trim() || undefined;
  if (identificador.length < 3) return aEstado(fail("DATOS_INVALIDOS"));
  const r = await ejecutar(() => solicitarServicio(identificador, junta));
  if (!r.ok) return aEstado(r);
  return { exito: "Si la cuenta existe y tiene correo, recibirá un enlace para restablecer su contraseña." };
}

export async function restablecerPasswordAction(
  _: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const token = String(formData.get("token") ?? "");
  const nueva = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  if (nueva !== confirmar) return aEstado(fail("DATOS_INVALIDOS", "Las contraseñas no coinciden.", "confirmar"));
  const r = await ejecutar(() => restablecerServicio(token, nueva));
  if (!r.ok) return aEstado(r);
  redirect("/login?restablecida=1");
}

export async function cambiarPasswordInicialAction(
  _: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const user = await usuarioActual();
  if (!user) redirect("/login");
  const nueva = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  if (nueva !== confirmar) return aEstado(fail("DATOS_INVALIDOS", "Las contraseñas no coinciden.", "confirmar"));
  const r = await ejecutar(() => cambiarPasswordServicio(user.userId, nueva));
  if (!r.ok) return aEstado(r);
  redirect(destinoPorRol(user.rol));
}
