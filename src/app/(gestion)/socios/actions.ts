"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import {
  crearSocio,
  desactivarSocio,
  editarSocio,
  reactivarSocio,
} from "@/server/services/socio-service";
import { crearSocioSchema, editarSocioSchema } from "@/server/validation/socio";

export interface EstadoSocioForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
}

/** Solo el Secretario/a modifica la nómina (Principio II). */
async function actorSecretario() {
  const actor = await requireRole("secretario");
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

const CAMPOS = ["cedula", "nombres", "sectorId", "telefono", "correo", "fechaIngreso"];

export async function crearSocioAction(_: EstadoSocioForm, fd: FormData): Promise<EstadoSocioForm> {
  const valores = leer(fd, CAMPOS);
  const parsed = crearSocioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => crearSocio(await actorSecretario(), parsed.data));
  if (!r.ok) {
    return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
  }
  revalidatePath("/socios");
  redirect(`/socios/${r.data.id}?creado=1`);
}

export async function editarSocioAction(_: EstadoSocioForm, fd: FormData): Promise<EstadoSocioForm> {
  const id = String(fd.get("id") ?? "");
  const valores = leer(fd, CAMPOS.filter((c) => c !== "cedula"));
  const parsed = editarSocioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => editarSocio(await actorSecretario(), id, parsed.data));
  if (!r.ok) {
    return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
  }
  revalidatePath("/socios");
  return { exito: "Cambios guardados.", valores };
}

function volver(id: string, mensaje: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (mensaje.ok) q.set("ok", mensaje.ok);
  if (mensaje.error) q.set("error", mensaje.error);
  redirect(`/socios/${id}?${q.toString()}`);
}

export async function desactivarSocioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => desactivarSocio(await actorSecretario(), id));
  revalidatePath("/socios");
  volver(id, r.ok ? { ok: "Socio dado de baja. Su historial y sus predios se conservan." } : { error: r.error.mensaje });
}

export async function reactivarSocioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => reactivarSocio(await actorSecretario(), id));
  revalidatePath("/socios");
  volver(id, r.ok ? { ok: "Socio reactivado." } : { error: r.error.mensaje });
}
