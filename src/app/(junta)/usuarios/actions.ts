"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar, fail, type Result } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import {
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  reactivarUsuario,
  restablecerCredencialInicial,
  type ResultadoCredencial,
} from "@/server/services/usuario-service";
import { crearUsuarioSchema, editarUsuarioSchema } from "@/server/validation/usuario";

export interface EstadoUsuarioForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
  /** Solo al crear: se muestra una sola vez y nunca viaja por URL. */
  credencial?: { credencialInicial: string; correoEnviado: boolean; correo?: string };
}

async function actorJunta() {
  const actor = await requireRole("admin_junta");
  if (actor.ctx.role !== "tenant") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

function leer(fd: FormData, campos: string[]): Record<string, string> {
  return Object.fromEntries(campos.map((c) => [c, String(fd.get(c) ?? "")]));
}

function erroresDe(e: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const campo = String(i.path[0] ?? "");
    if (campo && !out[campo]) out[campo] = i.message;
  }
  return out;
}

function conError(r: Extract<Result<unknown>, { ok: false }>, valores: Record<string, string>): EstadoUsuarioForm {
  return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
}

export async function crearUsuarioAction(_: EstadoUsuarioForm, fd: FormData): Promise<EstadoUsuarioForm> {
  const valores = leer(fd, ["cedula", "nombres", "correo", "telefono", "rol"]);
  const parsed = crearUsuarioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => crearUsuario(await actorJunta(), parsed.data));
  if (!r.ok) return conError(r, valores);
  revalidatePath("/usuarios");
  return {
    credencial: {
      credencialInicial: r.data.credencialInicial,
      correoEnviado: r.data.correoEnviado,
      correo: parsed.data.correo,
    },
  };
}

export async function editarUsuarioAction(_: EstadoUsuarioForm, fd: FormData): Promise<EstadoUsuarioForm> {
  const id = String(fd.get("id") ?? "");
  const valores = leer(fd, ["nombres", "correo", "telefono", "rol"]);
  const parsed = editarUsuarioSchema.safeParse({ ...valores, rol: valores.rol || undefined });
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => editarUsuario(await actorJunta(), id, parsed.data));
  if (!r.ok) return conError(r, valores);
  revalidatePath("/usuarios");
  return { exito: "Cambios guardados.", valores };
}

function volver(id: string, mensaje: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (mensaje.ok) q.set("ok", mensaje.ok);
  if (mensaje.error) q.set("error", mensaje.error);
  redirect(`/usuarios/${id}?${q.toString()}`);
}

export async function desactivarUsuarioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => desactivarUsuario(await actorJunta(), id));
  revalidatePath("/usuarios");
  volver(id, r.ok ? { ok: "Cuenta desactivada. Ya no puede ingresar; su historial se conserva." } : { error: r.error.mensaje });
}

export async function reactivarUsuarioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => reactivarUsuario(await actorJunta(), id));
  revalidatePath("/usuarios");
  volver(id, r.ok ? { ok: "Cuenta reactivada." } : { error: r.error.mensaje });
}

/** Devuelve la nueva credencial al cliente (se muestra una sola vez; no pasa por la URL). */
export async function restablecerCredencialAction(fd: FormData): Promise<Result<ResultadoCredencial>> {
  const id = String(fd.get("id") ?? "");
  if (!id) return fail("DATOS_INVALIDOS");
  return ejecutar(async () => restablecerCredencialInicial(await actorJunta(), id));
}
