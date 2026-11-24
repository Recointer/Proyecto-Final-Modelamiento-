"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoFormulario } from "@/lib/formularios";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import type { DbContext } from "@/server/db/context";
import { leerArchivoOpcional } from "@/server/services/archivo";
import { anularComunicacion, fijarPublicacionComunicacion, registrarComunicacion } from "@/server/services/comunicacion-service";
import { anularConvocatoria, emitirConvocatoria } from "@/server/services/convocatoria-service";
import { anularDocumento, archivarDocumento, fijarPublicacion } from "@/server/services/documento-service";
import { iniciarHilo, responder, type RolMensajeria } from "@/server/services/mensajeria-service";
import {
  anulacionSchema,
  comunicacionSchema,
  convocatoriaSchema,
  documentoSchema,
  nuevoHiloSchema,
  respuestaSchema,
} from "@/server/validation/comunicaciones";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

/** Solo el Secretario/a emite, archiva y registra (Principio II). */
async function actorSecretario(): Promise<CtxTenant> {
  const actor = await requireRole("secretario");
  if (actor.ctx.role !== "tenant") throw new AppError("NO_AUTORIZADO");
  return actor.ctx;
}

/** La mensajería es entre el Administrador de la Junta y los socios con cuenta. */
async function actorMensajeria(): Promise<{ ctx: CtxTenant; rol: RolMensajeria }> {
  const actor = await requireRole("admin_junta", "socio");
  if (actor.ctx.role !== "tenant") throw new AppError("NO_AUTORIZADO");
  return { ctx: actor.ctx, rol: actor.user.rol === "admin_junta" ? "admin_junta" : "socio" };
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

const aviso = (ruta: string, m: { ok?: string; error?: string }, extra: Record<string, string> = {}): string => {
  const q = new URLSearchParams(extra);
  if (m.ok) q.set("ok", m.ok);
  if (m.error) q.set("error", m.error);
  return `${ruta}?${q.toString()}`;
};

function refrescar() {
  revalidatePath("/convocatorias");
  revalidatePath("/documentos");
  revalidatePath("/comunicaciones");
  revalidatePath("/mensajes");
}

async function procesar<T, R>(
  fd: FormData,
  campos: string[],
  schema: z.ZodType<T>,
  operacion: (datos: T, fd: FormData) => Promise<R>,
  destino: (resultado: R, datos: T) => string,
): Promise<EstadoFormulario> {
  const valores = leer(fd, campos);
  const parsed = schema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };
  const r = await ejecutar(async () => operacion(parsed.data, fd));
  if (!r.ok) {
    return { error: r.error, errores: r.error.campo ? { [r.error.campo]: r.error.mensaje } : undefined, valores };
  }
  refrescar();
  redirect(destino(r.data, parsed.data));
}

// ---------------------------------------------------------------------------------------------
// Convocatorias
// ---------------------------------------------------------------------------------------------
export async function emitirConvocatoriaAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["tipo", "titulo", "fecha", "hora", "lugar", "ordenDia", "eventoId", "avisar"],
    convocatoriaSchema,
    async (d) => emitirConvocatoria(await actorSecretario(), d),
    (r, d) =>
      aviso("/convocatorias", {
        ok: d.avisar
          ? `Convocatoria emitida. Avisos por correo enviados: ${r.notificados}${r.fallidos ? ` (${r.fallidos} no pudieron enviarse)` : ""}.`
          : "Convocatoria emitida.",
      }),
  );
}

export async function anularConvocatoriaAction(fd: FormData): Promise<void> {
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  if (!parsed.success) redirect(aviso("/convocatorias", { error: "Indique el motivo de la anulación." }));
  const r = await ejecutar(async () => anularConvocatoria(await actorSecretario(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso("/convocatorias", r.ok ? { ok: "Convocatoria anulada." } : { error: r.error.mensaje }));
}

// ---------------------------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------------------------
export async function archivarDocumentoAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["tipo", "titulo", "fecha", "descripcion", "publicar"],
    documentoSchema,
    async (d, form) => archivarDocumento(await actorSecretario(), d, await leerArchivoOpcional(form.get("archivo"), "DOCUMENTO_INVALIDO", "archivo")),
    (_r, d) => aviso("/documentos", { ok: d.publicar ? "Documento archivado y publicado." : "Documento archivado." }),
  );
}

export async function publicarDocumentoAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const publicar = fd.get("publicar") === "1";
  const r = await ejecutar(async () => fijarPublicacion(await actorSecretario(), id, publicar));
  refrescar();
  redirect(aviso("/documentos", r.ok ? { ok: publicar ? "Documento publicado." : "Documento retirado de la publicación." } : { error: r.error.mensaje }));
}

export async function anularDocumentoAction(fd: FormData): Promise<void> {
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  if (!parsed.success) redirect(aviso("/documentos", { error: "Indique el motivo de la anulación." }));
  const r = await ejecutar(async () => anularDocumento(await actorSecretario(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso("/documentos", r.ok ? { ok: "Documento anulado." } : { error: r.error.mensaje }));
}

// ---------------------------------------------------------------------------------------------
// Comunicaciones recibidas
// ---------------------------------------------------------------------------------------------
export async function registrarComunicacionAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["institucion", "asunto", "referencia", "fechaRecepcion", "resumen", "publicar"],
    comunicacionSchema,
    async (d, form) => registrarComunicacion(await actorSecretario(), d, await leerArchivoOpcional(form.get("adjunto"), "ADJUNTO_INVALIDO", "adjunto")),
    () => aviso("/comunicaciones", { ok: "Comunicación registrada." }),
  );
}

export async function publicarComunicacionAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const publicar = fd.get("publicar") === "1";
  const r = await ejecutar(async () => fijarPublicacionComunicacion(await actorSecretario(), id, publicar));
  refrescar();
  redirect(aviso("/comunicaciones", r.ok ? { ok: publicar ? "Publicada como comunicado." : "Retirada de los comunicados." } : { error: r.error.mensaje }));
}

export async function anularComunicacionAction(fd: FormData): Promise<void> {
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  if (!parsed.success) redirect(aviso("/comunicaciones", { error: "Indique el motivo de la anulación." }));
  const r = await ejecutar(async () => anularComunicacion(await actorSecretario(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso("/comunicaciones", r.ok ? { ok: "Comunicación anulada." } : { error: r.error.mensaje }));
}

// ---------------------------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------------------------
export async function iniciarHiloAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["asunto", "texto", "usuarioId"],
    nuevoHiloSchema,
    async (d) => {
      const { ctx, rol } = await actorMensajeria();
      return iniciarHilo(ctx, rol, d);
    },
    (r) => aviso("/mensajes", { ok: "Mensaje enviado." }, { hilo: r.id }),
  );
}

export async function responderHiloAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["hiloId", "texto"],
    respuestaSchema,
    async (d) => {
      const { ctx, rol } = await actorMensajeria();
      return responder(ctx, rol, d);
    },
    (_r, d) => aviso("/mensajes", { ok: "Mensaje enviado." }, { hilo: d.hiloId }),
  );
}
