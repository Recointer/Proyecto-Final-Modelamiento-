"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import {
  actualizarConfiguracion,
  crearSector,
  editarSector,
  eliminarSector,
} from "@/server/services/configuracion-service";
import { configuracionSchema, sectorSchema } from "@/server/validation/configuracion";

export interface EstadoConfigForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  exito?: string;
}

async function actorJunta() {
  const actor = await requireRole("admin_junta");
  if (actor.ctx.role !== "tenant") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

const CAMPOS_CONFIG = [
  "nombre",
  "tipo",
  "provincia",
  "canton",
  "parroquia",
  "contactoNombre",
  "contactoTelefono",
  "contactoCorreo",
  "multaAsamblea",
  "multaMinga",
  "quorumPorcentaje",
];

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

export async function actualizarConfiguracionAction(_: EstadoConfigForm, fd: FormData): Promise<EstadoConfigForm> {
  const valores = leer(fd, CAMPOS_CONFIG);
  const parsed = configuracionSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const { multaAsamblea, multaMinga, quorumPorcentaje, ...general } = parsed.data;
  const r = await ejecutar(async () =>
    actualizarConfiguracion(await actorJunta(), {
      ...general,
      parametros: { multaAsamblea, multaMinga, quorumPorcentaje },
    }),
  );
  if (!r.ok) {
    return {
      error: r.error,
      errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined,
      valores,
    };
  }
  revalidatePath("/configuracion");
  return { exito: "Configuración guardada.", valores };
}

export async function crearSectorAction(_: EstadoConfigForm, fd: FormData): Promise<EstadoConfigForm> {
  const valores = leer(fd, ["nombre", "descripcion"]);
  const parsed = sectorSchema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => crearSector(await actorJunta(), parsed.data));
  if (!r.ok) {
    return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
  }
  revalidatePath("/configuracion");
  return { exito: "Sector agregado." };
}

function volver(mensaje: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (mensaje.ok) q.set("ok", mensaje.ok);
  if (mensaje.error) q.set("error", mensaje.error);
  redirect(`/configuracion?${q.toString()}#sectores`);
}

export async function editarSectorAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const parsed = sectorSchema.safeParse(leer(fd, ["nombre", "descripcion"]));
  if (!parsed.success) volver({ error: Object.values(erroresDe(parsed.error))[0] ?? "Datos no válidos" });
  const r = await ejecutar(async () => editarSector(await actorJunta(), id, parsed.data));
  revalidatePath("/configuracion");
  volver(r.ok ? { ok: "Sector actualizado." } : { error: r.error.mensaje });
}

export async function eliminarSectorAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const r = await ejecutar(async () => eliminarSector(await actorJunta(), id));
  revalidatePath("/configuracion");
  volver(r.ok ? { ok: "Sector eliminado." } : { error: r.error.mensaje });
}
