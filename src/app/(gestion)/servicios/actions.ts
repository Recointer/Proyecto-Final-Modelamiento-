"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import {
  crearServicio,
  crearTurno,
  desactivarServicio,
  editarServicio,
  editarTurno,
  eliminarTurno,
  reactivarServicio,
} from "@/server/services/servicio-service";
import { servicioSchema, turnoSchema } from "@/server/validation/servicio";

export interface EstadoServicioForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
}

/** Solo el Secretario/a modifica servicios y turnos (Principio II). */
async function actorSecretario() {
  const actor = await requireRole("secretario");
  if (actor.ctx.role !== "tenant") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

function erroresDe(e: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const campo = String(i.path[0] ?? "");
    if (campo && !out[campo]) out[campo] = i.message;
  }
  return out;
}

function conError(r: { error: { codigo: string; mensaje: string; campo?: string } }, valores: Record<string, string>): EstadoServicioForm {
  return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
}

const leerServicio = (fd: FormData) => ({ nombre: String(fd.get("nombre") ?? ""), tipo: String(fd.get("tipo") ?? "") });
const CAMPOS_TURNO = ["servicioId", "sectorId", "diaSemana", "horaInicio", "horaFin"];
const leerTurno = (fd: FormData) => Object.fromEntries(CAMPOS_TURNO.map((c) => [c, String(fd.get(c) ?? "")]));

export async function crearServicioAction(_: EstadoServicioForm, fd: FormData): Promise<EstadoServicioForm> {
  const valores = leerServicio(fd);
  const parsed = servicioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };
  const r = await ejecutar(async () => crearServicio(await actorSecretario(), parsed.data));
  if (!r.ok) return conError(r, valores);
  revalidatePath("/servicios");
  redirect(`/servicios/${r.data.id}?creado=1`);
}

export async function editarServicioAction(_: EstadoServicioForm, fd: FormData): Promise<EstadoServicioForm> {
  const id = String(fd.get("id") ?? "");
  const valores = leerServicio(fd);
  const parsed = servicioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };
  const r = await ejecutar(async () => editarServicio(await actorSecretario(), id, parsed.data));
  if (!r.ok) return conError(r, valores);
  revalidatePath("/servicios");
  redirect(`/servicios/${id}?guardado=1`);
}

export async function crearTurnoAction(_: EstadoServicioForm, fd: FormData): Promise<EstadoServicioForm> {
  const valores = leerTurno(fd);
  const parsed = turnoSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };
  const r = await ejecutar(async () => crearTurno(await actorSecretario(), parsed.data));
  if (!r.ok) return conError(r, valores);
  revalidatePath("/servicios");
  revalidatePath("/calendario");
  redirect(`/servicios/${parsed.data.servicioId}?ok=${encodeURIComponent("Turno agregado.")}`);
}

export async function editarTurnoAction(_: EstadoServicioForm, fd: FormData): Promise<EstadoServicioForm> {
  const id = String(fd.get("turnoId") ?? "");
  const valores = leerTurno(fd);
  const parsed = turnoSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };
  const { servicioId, ...resto } = parsed.data;
  const r = await ejecutar(async () => editarTurno(await actorSecretario(), id, resto));
  if (!r.ok) return conError(r, valores);
  revalidatePath("/servicios");
  revalidatePath("/calendario");
  redirect(`/servicios/${servicioId}?ok=${encodeURIComponent("Turno actualizado.")}`);
}

function volver(id: string, m: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (m.ok) q.set("ok", m.ok);
  if (m.error) q.set("error", m.error);
  redirect(`/servicios/${id}?${q.toString()}`);
}

export async function eliminarTurnoAction(fd: FormData): Promise<void> {
  const id = String(fd.get("turnoId") ?? "");
  const servicioId = String(fd.get("servicioId") ?? "");
  const r = await ejecutar(async () => eliminarTurno(await actorSecretario(), id));
  revalidatePath("/calendario");
  volver(servicioId, r.ok ? { ok: "Turno eliminado." } : { error: r.error.mensaje });
}

export async function desactivarServicioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => desactivarServicio(await actorSecretario(), id));
  revalidatePath("/servicios");
  revalidatePath("/calendario");
  volver(id, r.ok ? { ok: "Servicio dado de baja. Ya no aparece en el calendario." } : { error: r.error.mensaje });
}

export async function reactivarServicioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => reactivarServicio(await actorSecretario(), id));
  revalidatePath("/servicios");
  revalidatePath("/calendario");
  volver(id, r.ok ? { ok: "Servicio reactivado." } : { error: r.error.mensaje });
}
