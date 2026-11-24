import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type DbContext } from "../db/context";
import { documento } from "../db/schema";
import { detectarTipo, fileStore, validarArchivo } from "../files/file-store";
import { TIPOS_DOCUMENTO, type EntradaDocumento } from "../validation/comunicaciones";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TAMANO_PAGINA_DOCS = 20;

export interface FiltrosDocumento {
  tipo?: string;
  anio?: number;
  busqueda?: string;
  pagina?: number;
  /** Socio: solo publicados y vigentes. */
  soloVisibles?: boolean;
}

export interface FilaDocumento {
  id: string;
  tipo: (typeof TIPOS_DOCUMENTO)[number];
  titulo: string;
  fecha: string;
  descripcion: string | null;
  publicado: boolean;
  estado: "vigente" | "anulado";
  motivoAnulacion: string | null;
}

export interface ListadoDocumentos {
  items: FilaDocumento[];
  total: number;
  pagina: number;
  paginas: number;
}

function condiciones(ctx: CtxTenant, f: FiltrosDocumento): SQL | undefined {
  const b = f.busqueda?.trim();
  const tipo = TIPOS_DOCUMENTO.find((t) => t === f.tipo);
  return and(
    eq(documento.tenantId, ctx.tenantId),
    f.soloVisibles ? and(eq(documento.publicado, true), eq(documento.estado, "vigente")) : undefined,
    tipo ? eq(documento.tipo, tipo) : undefined,
    f.anio ? sql`extract(year from ${documento.fecha}) = ${f.anio}` : undefined,
    b
      ? or(ilike(documento.titulo, `%${b.replace(/[%_\\]/g, "\\$&")}%`), ilike(documento.descripcion, `%${b.replace(/[%_\\]/g, "\\$&")}%`))
      : undefined,
  );
}

export async function archivarDocumento(ctx: CtxTenant, e: EntradaDocumento, archivo: Uint8Array | null): Promise<{ id: string }> {
  if (!archivo) throw new AppError("DOCUMENTO_INVALIDO", "Adjunte el documento (PDF o imagen).", "archivo");
  validarArchivo(archivo, ["pdf", "png", "jpg"], "DOCUMENTO_INVALIDO", "archivo");
  const ruta = await fileStore().guardar(archivo, `documentos/${ctx.tenantId}`, ["pdf", "png", "jpg"], "DOCUMENTO_INVALIDO");
  const publicar = Boolean(e.publicar);
  try {
    return await withTenant(ctx, async (tx) => {
      const [d] = await tx
        .insert(documento)
        .values({
          tenantId: ctx.tenantId,
          tipo: e.tipo,
          titulo: e.titulo,
          fecha: e.fecha,
          descripcion: e.descripcion || null,
          archivoRuta: ruta,
          publicado: publicar,
          creadoPor: ctx.userId,
        })
        .returning({ id: documento.id });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "documento.archivar",
        entidad: "documento",
        entidadId: d!.id,
        despues: { tipo: e.tipo, titulo: e.titulo, fecha: e.fecha, publicado: publicar },
      });
      return { id: d!.id };
    });
  } catch (err) {
    await fileStore().eliminar(ruta);
    throw err;
  }
}

export async function listarDocumentos(ctx: CtxTenant, f: FiltrosDocumento = {}): Promise<ListadoDocumentos> {
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1));
  return withTenant(ctx, async (tx) => {
    const where = condiciones(ctx, f);
    const [t] = await tx.select({ n: sql<number>`count(*)::int` }).from(documento).where(where);
    const items = await tx
      .select({
        id: documento.id,
        tipo: documento.tipo,
        titulo: documento.titulo,
        fecha: documento.fecha,
        descripcion: documento.descripcion,
        publicado: documento.publicado,
        estado: documento.estado,
        motivoAnulacion: documento.motivoAnulacion,
      })
      .from(documento)
      .where(where)
      .orderBy(desc(documento.fecha), desc(documento.creadoEn))
      .limit(TAMANO_PAGINA_DOCS)
      .offset((pagina - 1) * TAMANO_PAGINA_DOCS);
    const total = t?.n ?? 0;
    return { items, total, pagina, paginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA_DOCS)) };
  });
}

/** Publica o retira de publicación. Un documento anulado no se puede publicar. */
export async function fijarPublicacion(ctx: CtxTenant, id: string, publicado: boolean): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [d] = await tx
      .select({ estado: documento.estado, publicado: documento.publicado })
      .from(documento)
      .where(and(eq(documento.id, id), eq(documento.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!d) throw new AppError("DOCUMENTO_NO_ENCONTRADO");
    if (d.estado === "anulado") throw new AppError("DOCUMENTO_ANULADO");
    await tx.update(documento).set({ publicado }).where(and(eq(documento.id, id), eq(documento.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: publicado ? "documento.publicar" : "documento.retirar",
      entidad: "documento",
      entidadId: id,
      antes: { publicado: d.publicado },
      despues: { publicado },
    });
  });
}

export async function anularDocumento(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [d] = await tx
      .select({ estado: documento.estado, titulo: documento.titulo })
      .from(documento)
      .where(and(eq(documento.id, id), eq(documento.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!d) throw new AppError("DOCUMENTO_NO_ENCONTRADO");
    if (d.estado === "anulado") throw new AppError("DOCUMENTO_ANULADO");
    await tx
      .update(documento)
      .set({ estado: "anulado", publicado: false, anuladoPor: ctx.userId, anuladoEn: new Date(), motivoAnulacion: motivo })
      .where(and(eq(documento.id, id), eq(documento.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "documento.anular",
      entidad: "documento",
      entidadId: id,
      antes: { estado: "vigente", titulo: d.titulo },
      despues: { motivo },
    });
  });
}

/** Archivo de un documento. Con `soloVisibles` (Socio) exige que esté publicado y vigente. */
export async function obtenerArchivoDocumento(
  ctx: CtxTenant,
  id: string,
  opciones: { soloVisibles?: boolean } = {},
): Promise<{ datos: Uint8Array; mime: string; extension: string; titulo: string } | null> {
  const f = await withTenant(ctx, async (tx) => {
    const [d] = await tx
      .select({ ruta: documento.archivoRuta, titulo: documento.titulo })
      .from(documento)
      .where(and(eq(documento.id, id), condiciones(ctx, { soloVisibles: opciones.soloVisibles })))
      .limit(1);
    return d ?? null;
  });
  if (!f) return null;
  try {
    const datos = await fileStore().leer(f.ruta);
    const tipo = detectarTipo(datos);
    return { datos, mime: tipo?.mime ?? "application/octet-stream", extension: tipo?.ext ?? "bin", titulo: f.titulo };
  } catch {
    return null;
  }
}
