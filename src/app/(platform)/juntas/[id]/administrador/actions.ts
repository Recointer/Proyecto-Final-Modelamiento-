"use server";

import { revalidatePath } from "next/cache";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import { leerActa } from "@/server/services/acta";
import { asignarAdministrador, cambiarAdministrador } from "@/server/services/administrador-service";
import { asignarAdministradorSchema, cambiarAdministradorSchema } from "@/server/validation/administrador";

type DatosAdmin = { juntaId: string; cedula: string; nombres: string; correo: string; motivo?: string };

export interface EstadoAdminForm {
  error?: { codigo: string; mensaje: string; campo?: string };
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  /** Se muestra una sola vez; nunca viaja por URL. */
  resultado?: { modo: "asignar" | "cambiar"; credencialInicial: string; correoEnviado: boolean; correo: string };
}

async function actorSuper() {
  const actor = await requireRole("super_admin");
  if (actor.ctx.role !== "super_admin") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

function leer(fd: FormData) {
  return {
    juntaId: String(fd.get("juntaId") ?? ""),
    cedula: String(fd.get("cedula") ?? ""),
    nombres: String(fd.get("nombres") ?? ""),
    correo: String(fd.get("correo") ?? ""),
    motivo: String(fd.get("motivo") ?? ""),
  };
}

function erroresDe(e: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const campo = String(i.path[0] ?? "");
    if (campo && !out[campo]) out[campo] = i.message;
  }
  return out;
}

async function procesar(
  fd: FormData,
  esCambio: boolean,
): Promise<EstadoAdminForm> {
  const crudos = leer(fd);
  const { motivo, ...sinMotivo } = crudos;
  const valores = { cedula: crudos.cedula, nombres: crudos.nombres, correo: crudos.correo, motivo };
  const parsed = esCambio
    ? cambiarAdministradorSchema.safeParse(crudos)
    : asignarAdministradorSchema.safeParse(sinMotivo);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };

  const r = await ejecutar(async () => {
    const ctx = await actorSuper();
    const acta = await leerActa(fd.get("acta"));
    const d: DatosAdmin = parsed.data;
    return esCambio
      ? cambiarAdministrador(ctx, { ...d, motivo: d.motivo ?? "", acta })
      : asignarAdministrador(ctx, { juntaId: d.juntaId, cedula: d.cedula, nombres: d.nombres, correo: d.correo, acta });
  });

  if (!r.ok) {
    return {
      error: r.error,
      errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined,
      valores,
    };
  }
  revalidatePath(`/juntas/${crudos.juntaId}/administrador`);
  return {
    resultado: {
      modo: esCambio ? "cambiar" : "asignar",
      credencialInicial: r.data.credencialInicial,
      correoEnviado: r.data.correoEnviado,
      correo: parsed.data.correo,
    },
  };
}

export async function asignarAdministradorAction(_: EstadoAdminForm, fd: FormData): Promise<EstadoAdminForm> {
  return procesar(fd, false);
}

export async function cambiarAdministradorAction(_: EstadoAdminForm, fd: FormData): Promise<EstadoAdminForm> {
  return procesar(fd, true);
}
