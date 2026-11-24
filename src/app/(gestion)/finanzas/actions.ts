"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoFormulario } from "@/lib/formularios";
import { AppError, ejecutar } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import type { DbContext } from "@/server/db/context";
import { leerArchivoOpcional } from "@/server/services/archivo";
import { crearActivo, darDeBajaActivo, editarActivo } from "@/server/services/activo-service";
import { anularCargo, emitirCargos } from "@/server/services/cargo-service";
import { cambiarEstadoConcepto, crearConcepto, editarConcepto } from "@/server/services/concepto-service";
import { anularEgreso, registrarEgreso } from "@/server/services/egreso-service";
import { crearMaterial, editarMaterial, registrarMovimiento } from "@/server/services/inventario-service";
import { generarMultas } from "@/server/services/multa-service";
import { anularPago, registrarPago } from "@/server/services/pago-service";
import {
  activoSchema,
  anulacionSchema,
  conceptoSchema,
  egresoSchema,
  emisionSchema,
  materialSchema,
  montoMinimoCero,
  movimientoSchema,
  pagoSchema,
} from "@/server/validation/finanzas";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

/** Solo el Tesorero/a registra y modifica datos financieros (Principio II). */
async function actorTesorero(): Promise<CtxTenant> {
  const actor = await requireRole("tesorero");
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

function conError(error: { codigo: string; mensaje: string; campo?: string }, valores: Record<string, string>): EstadoFormulario {
  return { error, errores: error.campo ? { [error.campo]: error.mensaje } : undefined, valores };
}

const aviso = (ruta: string, m: { ok?: string; error?: string }): string => {
  const q = new URLSearchParams();
  if (m.ok) q.set("ok", m.ok);
  if (m.error) q.set("error", m.error);
  return `${ruta}?${q.toString()}`;
};

function refrescar() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/mi/estado-de-cuenta");
}

/** Valida el formulario, ejecuta la operación y redirige con un aviso; si falla, devuelve el estado con errores. */
async function procesar<T, R>(
  fd: FormData,
  campos: string[],
  schema: z.ZodType<T>,
  operacion: (ctx: CtxTenant, datos: T, fd: FormData) => Promise<R>,
  destino: (resultado: R, datos: T) => string,
): Promise<EstadoFormulario> {
  const valores = leer(fd, campos);
  const parsed = schema.safeParse(valores);
  if (!parsed.success) return { errores: erroresDe(parsed.error), valores };
  const r = await ejecutar(async () => operacion(await actorTesorero(), parsed.data, fd));
  if (!r.ok) return conError(r.error, valores);
  refrescar();
  redirect(destino(r.data, parsed.data));
}

// ---------------------------------------------------------------------------------------------
// Conceptos de cobro
// ---------------------------------------------------------------------------------------------
export async function guardarConceptoAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const id = String(fd.get("id") ?? "");
  return procesar(
    fd,
    ["nombre", "tipo", "montoDefecto"],
    conceptoSchema,
    async (ctx, d) => (id ? (await editarConcepto(ctx, id, d), { id }) : crearConcepto(ctx, d)),
    () => aviso("/finanzas/conceptos", { ok: id ? "Concepto actualizado." : "Concepto creado." }),
  );
}

export async function cambiarEstadoConceptoAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const estado = fd.get("estado") === "activo" ? "activo" : "inactivo";
  const r = await ejecutar(async () => cambiarEstadoConcepto(await actorTesorero(), id, estado));
  refrescar();
  redirect(aviso("/finanzas/conceptos", r.ok ? { ok: estado === "activo" ? "Concepto reactivado." : "Concepto desactivado." } : { error: r.error.mensaje }));
}

// ---------------------------------------------------------------------------------------------
// Cargos, pagos y multas
// ---------------------------------------------------------------------------------------------
export async function emitirCargosAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["conceptoId", "anio", "alcance", "sectorId", "socioId", "monto", "vence"],
    emisionSchema,
    (ctx, d) => emitirCargos(ctx, d),
    (r) =>
      aviso("/finanzas/cobros", {
        ok: `Se emitieron ${r.emitidos} cargos de $ ${r.monto}${r.existentes ? ` (${r.existentes} ya existían y no se duplicaron)` : ""}.`,
      }),
  );
}

export async function registrarPagoAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["cargoId", "monto", "fecha", "forma", "referencia"],
    pagoSchema,
    (ctx, d) => registrarPago(ctx, d),
    (r, d) => aviso(`/finanzas/cobros/${d.cargoId}`, { ok: `Pago registrado. Comprobante N.º ${String(r.numero).padStart(6, "0")}.` }),
  );
}

export async function anularPagoAction(fd: FormData): Promise<void> {
  const cargoId = String(fd.get("cargoId") ?? "");
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  if (!parsed.success) redirect(aviso(`/finanzas/cobros/${cargoId}`, { error: "Indique el motivo de la anulación." }));
  const r = await ejecutar(async () => anularPago(await actorTesorero(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso(`/finanzas/cobros/${cargoId}`, r.ok ? { ok: "Pago anulado; el saldo del cargo se restituyó." } : { error: r.error.mensaje }));
}

export async function anularCargoAction(fd: FormData): Promise<void> {
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  const id = String(fd.get("id") ?? "");
  if (!parsed.success) redirect(aviso(`/finanzas/cobros/${id}`, { error: "Indique el motivo de la anulación." }));
  const r = await ejecutar(async () => anularCargo(await actorTesorero(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso(`/finanzas/cobros/${id}`, r.ok ? { ok: "Cargo anulado." } : { error: r.error.mensaje }));
}

export async function generarMultasAction(fd: FormData): Promise<void> {
  const eventoId = String(fd.get("eventoId") ?? "");
  const r = await ejecutar(async () => generarMultas(await actorTesorero(), eventoId));
  refrescar();
  redirect(
    aviso(
      "/finanzas/multas",
      r.ok
        ? { ok: `Multas generadas: ${r.data.generadas} de $ ${r.data.monto}${r.data.existentes ? ` (${r.data.existentes} ya existían)` : ""}.` }
        : { error: r.error.mensaje },
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// Egresos
// ---------------------------------------------------------------------------------------------
export async function registrarEgresoAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(
    fd,
    ["fecha", "categoria", "descripcion", "beneficiario", "monto"],
    egresoSchema,
    async (ctx, d, form) => registrarEgreso(ctx, d, await leerArchivoOpcional(form.get("respaldo"), "RESPALDO_INVALIDO", "respaldo")),
    () => aviso("/finanzas/egresos", { ok: "Egreso registrado." }),
  );
}

export async function anularEgresoAction(fd: FormData): Promise<void> {
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  if (!parsed.success) redirect(aviso("/finanzas/egresos", { error: "Indique el motivo de la anulación." }));
  const r = await ejecutar(async () => anularEgreso(await actorTesorero(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso("/finanzas/egresos", r.ok ? { ok: "Egreso anulado." } : { error: r.error.mensaje }));
}

// ---------------------------------------------------------------------------------------------
// Inventario y activos fijos
// ---------------------------------------------------------------------------------------------
export async function crearMaterialAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(fd, ["nombre", "unidad", "stockInicial", "minimo"], materialSchema, (ctx, d) => crearMaterial(ctx, d), () =>
    aviso("/finanzas/inventario", { ok: "Material registrado." }),
  );
}

const materialEdicionSchema = z.object({
  nombre: z.string().trim().min(1, "Ingrese el nombre del material").max(100),
  unidad: z.string().trim().min(1, "Ingrese la unidad").max(20),
  minimo: montoMinimoCero,
  estado: z.enum(["activo", "inactivo"], { message: "Seleccione el estado" }),
});

export async function editarMaterialAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const id = String(fd.get("id") ?? "");
  return procesar(fd, ["nombre", "unidad", "minimo", "estado"], materialEdicionSchema, async (ctx, d) => editarMaterial(ctx, id, d), () =>
    aviso("/finanzas/inventario", { ok: "Material actualizado." }),
  );
}

export async function registrarMovimientoAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return procesar(fd, ["materialId", "tipo", "cantidad", "motivo"], movimientoSchema, (ctx, d) => registrarMovimiento(ctx, d), (r) =>
    aviso("/finanzas/inventario", { ok: `Movimiento registrado. Stock actual: ${r.stock}.` }),
  );
}

export async function guardarActivoAction(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const id = String(fd.get("id") ?? "");
  return procesar(
    fd,
    ["codigo", "nombre", "fechaAdquisicion", "valor", "ubicacion"],
    activoSchema,
    async (ctx, d) => (id ? (await editarActivo(ctx, id, d), { id }) : crearActivo(ctx, d)),
    () => aviso("/finanzas/activos", { ok: id ? "Activo actualizado." : "Activo registrado." }),
  );
}

export async function bajaActivoAction(fd: FormData): Promise<void> {
  const parsed = anulacionSchema.safeParse({ id: fd.get("id"), motivo: fd.get("motivo") });
  if (!parsed.success) redirect(aviso("/finanzas/activos", { error: "Indique el motivo de la baja." }));
  const r = await ejecutar(async () => darDeBajaActivo(await actorTesorero(), parsed.data.id, parsed.data.motivo));
  refrescar();
  redirect(aviso("/finanzas/activos", r.ok ? { ok: "Activo dado de baja." } : { error: r.error.mensaje }));
}
