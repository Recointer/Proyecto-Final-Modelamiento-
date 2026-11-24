"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import { leerArchivoOpcional } from "@/server/services/archivo";
import { crearPredio, desactivarPredio, editarPredio, reactivarPredio } from "@/server/services/predio-service";
import { predioSchema } from "@/server/validation/predio";

export interface EstadoPredioForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
}

/** Solo el Secretario/a modifica los predios (Principio II). */
async function actorSecretario() {
  const actor = await requireRole("secretario");
  if (actor.ctx.role !== "tenant") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

const CAMPOS = ["codigo", "nombre", "superficieHa", "sectorId", "socioId", "latitud", "longitud"];

function leer(fd: FormData): Record<string, string> {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(fd.get(c) ?? "")]));
}

function erroresDe(e: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const campo = String(i.path[0] ?? "");
    if (campo && !out[campo]) out[campo] = i.message;
  }
  return out;
}

function conError(r: { error: { codigo: string; mensaje: string; campo?: string } }, valores: Record<string, string>): EstadoPredioForm {
  return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
}

export async function crearPredioAction(_: EstadoPredioForm, fd: FormData): Promise<EstadoPredioForm> {
  const valores = leer(fd);
  const parsed = predioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => {
    const imagen = await leerArchivoOpcional(fd.get("imagen"));
    return crearPredio(await actorSecretario(), parsed.data, imagen);
  });
  if (!r.ok) return conError(r, valores);
  revalidatePath("/predios");
  redirect(`/predios/${r.data.id}?creado=1`);
}

export async function editarPredioAction(_: EstadoPredioForm, fd: FormData): Promise<EstadoPredioForm> {
  const id = String(fd.get("id") ?? "");
  const valores = leer(fd);
  const parsed = predioSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => {
    const imagen = await leerArchivoOpcional(fd.get("imagen"));
    await editarPredio(await actorSecretario(), id, parsed.data, { imagen, quitarImagen: fd.get("quitarImagen") === "on" });
  });
  if (!r.ok) return conError(r, valores);
  revalidatePath("/predios");
  redirect(`/predios/${id}?guardado=1`);
}

function volver(id: string, mensaje: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (mensaje.ok) q.set("ok", mensaje.ok);
  if (mensaje.error) q.set("error", mensaje.error);
  redirect(`/predios/${id}?${q.toString()}`);
}

export async function desactivarPredioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => desactivarPredio(await actorSecretario(), id));
  revalidatePath("/predios");
  volver(id, r.ok ? { ok: "Predio dado de baja. Ya no aparece en el mapa." } : { error: r.error.mensaje });
}

export async function reactivarPredioAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => reactivarPredio(await actorSecretario(), id));
  revalidatePath("/predios");
  volver(id, r.ok ? { ok: "Predio reactivado." } : { error: r.error.mensaje });
}
