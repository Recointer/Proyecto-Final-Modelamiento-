"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar, type Result } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import {
  crearJunta,
  desactivarJunta,
  editarJunta,
  reactivarJunta,
} from "@/server/services/junta-service";
import { crearJuntaSchema, juntaSchema } from "@/server/validation/junta";

export interface EstadoJuntaForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

async function actorSuper() {
  const actor = await requireRole("super_admin");
  if (actor.ctx.role !== "super_admin") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

function leerCampos(fd: FormData): Record<string, string> {
  const campos = [
    "nombre",
    "tipo",
    "provincia",
    "canton",
    "parroquia",
    "slug",
    "contactoNombre",
    "contactoTelefono",
    "contactoCorreo",
  ];
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

function aEstado(r: Result<unknown>, valores: Record<string, string>): EstadoJuntaForm {
  if (r.ok) return { valores };
  const errores = r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined;
  return { error: r.error, errores, valores };
}

export async function crearJuntaAction(_: EstadoJuntaForm, fd: FormData): Promise<EstadoJuntaForm> {
  const valores = leerCampos(fd);
  const parsed = crearJuntaSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => crearJunta(await actorSuper(), parsed.data));
  if (!r.ok) return aEstado(r, valores);
  revalidatePath("/juntas");
  redirect(`/juntas/${r.data.id}?creada=1`);
}

export async function editarJuntaAction(_: EstadoJuntaForm, fd: FormData): Promise<EstadoJuntaForm> {
  const id = String(fd.get("id") ?? "");
  const valores = leerCampos(fd);
  const parsed = juntaSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => editarJunta(await actorSuper(), id, parsed.data));
  if (!r.ok) return aEstado(r, valores);
  revalidatePath("/juntas");
  redirect(`/juntas/${id}?guardada=1`);
}

export async function desactivarJuntaAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => desactivarJunta(await actorSuper(), id, fd.get("confirmar") === "true"));
  revalidatePath("/juntas");
  redirect(r.ok ? `/juntas/${id}?desactivada=1` : `/juntas/${id}?error=${encodeURIComponent(r.error.mensaje)}`);
}

export async function reactivarJuntaAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => reactivarJunta(await actorSuper(), id));
  revalidatePath("/juntas");
  redirect(r.ok ? `/juntas/${id}?reactivada=1` : `/juntas/${id}?error=${encodeURIComponent(r.error.mensaje)}`);
}
