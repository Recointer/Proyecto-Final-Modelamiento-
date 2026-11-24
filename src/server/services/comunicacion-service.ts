import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type DbContext } from "../db/context";
import { comunicacionRecibida } from "../db/schema";
import { detectarTipo, fileStore, validarArchivo } from "../files/file-store";
import type { EntradaComunicacion } from "../validation/comunicaciones";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;
const c = comunicacionRecibida;

export const TAMANO_PAGINA_COM = 20;

export interface FiltrosComunicacion {
  anio?: number;
  busqueda?: string;
  pagina?: number;
  /** Socio: solo comunicados publicados y vigentes. */
  soloVisibles?: boolean;
}

export interface FilaComunicacion {
  id: string;
  institucion: string;
  asunto: string;
  referencia: string | null;
  fechaRecepcion: string;
  resumen: string;
  tieneAdjunto: boolean;
  publicada: boolean;
  estado: "vigente" | "anulado";
  motivoAnulacion: string | null;
}

export interface ListadoComunicaciones {
  items: FilaComunicacion[];
  total: number;
  pagina: number;
  paginas: number;
}

function condiciones(ctx: CtxTenant, f: FiltrosComunicacion): SQL | undefined {
  const b = f.busqueda?.trim();
  const patron = b ? `%${b.replace(/[%_\\]/g, "\\$&")}%` : null;
  return and(
    eq(c.tenantId, ctx.tenantId),
    f.soloVisibles ? and(eq(c.publicada, true), eq(c.estado, "vigente")) : undefined,
    f.anio ? sql`extract(year from ${c.fechaRecepcion}) = ${f.anio}` : undefined,
    patron ? or(ilike(c.institucion, patron), ilike(c.asunto, patron), ilike(c.referencia, patron)) : undefined,
  );
}

export async function registrarComunicacion(ctx: CtxTenant, e: EntradaComunicacion, adjunto: Uint8Array | null): Promise<{ id: string }> {
  let ruta: string | null = null;
  if (adjunto) {
    validarArchivo(adjunto, ["pdf", "png", "jpg"], "ADJUNTO_INVALIDO", "adjunto");
    ruta = await fileStore().guardar(adjunto, `comunicaciones/${ctx.tenantId}`, ["pdf", "png", "jpg"], "ADJUNTO_INVALIDO");
  }
  const publicar = Boolean(e.publicar);
  try {
    return await withTenant(ctx, async (tx) => {
      const [f] = await tx
        .insert(c)
        .values({
          tenantId: ctx.tenantId,
          institucion: e.institucion,
          asunto: e.asunto,
          referencia: e.referencia || null,
          fechaRecepcion: e.fechaRecepcion,
          resumen: e.resumen,
          archivoRuta: ruta,
          publicada: publicar,
          creadoPor: ctx.userId,
        })
        .returning({ id: c.id });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "comunicacion.registrar",
        entidad: "comunicacion_recibida",
        entidadId: f!.id,
        despues: { institucion: e.institucion, asunto: e.asunto, fechaRecepcion: e.fechaRecepcion, publicada: publicar, conAdjunto: ruta !== null },
      });
      return { id: f!.id };
    });
  } catch (err) {
    if (ruta) await fileStore().eliminar(ruta);
    throw err;
  }
}

export async function listarComunicaciones(ctx: CtxTenant, f: FiltrosComunicacion = {}): Promise<ListadoComunicaciones> {
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1));
  return withTenant(ctx, async (tx) => {
    const where = condiciones(ctx, f);
    const [t] = await tx.select({ n: sql<number>`count(*)::int` }).from(c).where(where);
    const items = await tx
      .select({
        id: c.id,
        institucion: c.institucion,
        asunto: c.asunto,
        referencia: c.referencia,
        fechaRecepcion: c.fechaRecepcion,
        resumen: c.resumen,
        tieneAdjunto: sql<boolean>`${c.archivoRuta} is not null`,
        publicada: c.publicada,
        estado: c.estado,
        motivoAnulacion: c.motivoAnulacion,
      })
      .from(c)
      .where(where)
      .orderBy(desc(c.fechaRecepcion), desc(c.creadoEn))
      .limit(TAMANO_PAGINA_COM)
      .offset((pagina - 1) * TAMANO_PAGINA_COM);
    const total = t?.n ?? 0;
    return { items, total, pagina, paginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA_COM)) };
  });
}

export async function fijarPublicacionComunicacion(ctx: CtxTenant, id: string, publicada: boolean): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select({ estado: c.estado, publicada: c.publicada })
      .from(c)
      .where(and(eq(c.id, id), eq(c.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!f) throw new AppError("COMUNICACION_NO_ENCONTRADA");
    if (f.estado === "anulado") throw new AppError("COMUNICACION_ANULADA");
    await tx.update(c).set({ publicada }).where(and(eq(c.id, id), eq(c.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: publicada ? "comunicacion.publicar" : "comunicacion.retirar",
      entidad: "comunicacion_recibida",
      entidadId: id,
      antes: { publicada: f.publicada },
      despues: { publicada },
    });
  });
}

export async function anularComunicacion(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select({ estado: c.estado, asunto: c.asunto })
      .from(c)
      .where(and(eq(c.id, id), eq(c.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!f) throw new AppError("COMUNICACION_NO_ENCONTRADA");
    if (f.estado === "anulado") throw new AppError("COMUNICACION_ANULADA");
    await tx
      .update(c)
      .set({ estado: "anulado", publicada: false, anuladoPor: ctx.userId, anuladoEn: new Date(), motivoAnulacion: motivo })
      .where(and(eq(c.id, id), eq(c.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "comunicacion.anular",
      entidad: "comunicacion_recibida",
      entidadId: id,
      antes: { estado: "vigente", asunto: f.asunto },
      despues: { motivo },
    });
  });
}

export async function obtenerAdjuntoComunicacion(
  ctx: CtxTenant,
  id: string,
  opciones: { soloVisibles?: boolean } = {},
): Promise<{ datos: Uint8Array; mime: string; extension: string } | null> {
  const ruta = await withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select({ ruta: c.archivoRuta })
      .from(c)
      .where(and(eq(c.id, id), condiciones(ctx, { soloVisibles: opciones.soloVisibles })))
      .limit(1);
    return f?.ruta ?? null;
  });
  if (!ruta) return null;
  try {
    const datos = await fileStore().leer(ruta);
    const tipo = detectarTipo(datos);
    return { datos, mime: tipo?.mime ?? "application/octet-stream", extension: tipo?.ext ?? "bin" };
  } catch {
    return null;
  }
}
