"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar, fail, type Result } from "@/lib/result";
import type { ResumenAsistencia } from "@/lib/quorum";
import { requireRole } from "@/server/auth/guard";
import { anularEvento, crearEvento, editarEvento } from "@/server/services/evento-service";
import { guardarAsistencia } from "@/server/services/asistencia-service";
import { guardarAsistenciaSchema, type RegistroAsistencia } from "@/server/validation/asistencia";
import { anularEventoSchema, eventoSchema } from "@/server/validation/evento";

export interface EstadoEventoForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
}

/** Solo el Secretario/a registra eventos y asistencia (Principio II). */
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

const CAMPOS = ["tipo", "titulo", "fecha", "lugar"];

export async function crearEventoAction(_: EstadoEventoForm, fd: FormData): Promise<EstadoEventoForm> {
  const valores = leer(fd, CAMPOS);
  const parsed = eventoSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => crearEvento(await actorSecretario(), parsed.data));
  if (!r.ok) return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
  revalidatePath("/eventos");
  redirect(`/eventos/${r.data.id}?creado=1`);
}

export async function editarEventoAction(_: EstadoEventoForm, fd: FormData): Promise<EstadoEventoForm> {
  const id = String(fd.get("id") ?? "");
  const valores = leer(fd, CAMPOS);
  const parsed = eventoSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => editarEvento(await actorSecretario(), id, parsed.data));
  if (!r.ok) return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
  revalidatePath("/eventos");
  return { exito: "Cambios guardados.", valores };
}

function volver(id: string, mensaje: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (mensaje.ok) q.set("ok", mensaje.ok);
  if (mensaje.error) q.set("error", mensaje.error);
  redirect(`/eventos/${id}?${q.toString()}`);
}

export async function anularEventoAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const parsed = anularEventoSchema.safeParse({ id, motivo: String(fd.get("motivo") ?? "") });
  if (!parsed.success) volver(id, { error: Object.values(erroresDe(parsed.error))[0] ?? "Datos no válidos" });
  const r = await ejecutar(async () => anularEvento(await actorSecretario(), parsed.data.id, parsed.data.motivo));
  revalidatePath("/eventos");
  volver(id, r.ok ? { ok: "Evento anulado. Ya no cuenta en porcentajes ni en el panel." } : { error: r.error.mensaje });
}

/** Guarda la asistencia completa del evento en una transacción y devuelve el resumen actualizado. */
export async function guardarAsistenciaAction(
  eventoId: string,
  registros: RegistroAsistencia[],
): Promise<Result<ResumenAsistencia>> {
  const parsed = guardarAsistenciaSchema.safeParse({ eventoId, registros });
  if (!parsed.success) return fail("DATOS_INVALIDOS", Object.values(erroresDe(parsed.error))[0]);
  const r = await ejecutar(async () => guardarAsistencia(await actorSecretario(), parsed.data.eventoId, parsed.data.registros));
  if (r.ok) revalidatePath("/eventos");
  return r;
}
