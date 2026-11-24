import { and, asc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { codigoPg } from "../db/errores";
import { predio, sector, socio } from "../db/schema";
import { detectarTipo, fileStore } from "../files/file-store";
import type { EntradaPredio, FiltrosPredio } from "../validation/predio";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TAMANO_PAGINA_PREDIOS = 20;
const MAX_PUNTOS_MAPA = 1000;

/**
 * `acotadoASocio`: cuando el usuario es un Socio, su id (derivado de la sesión, nunca del cliente) limita
 * todas las consultas a sus propios predios (FR-015, FR-021).
 */
type Acotado = string | undefined;

export interface PredioListado {
  id: string;
  codigo: string;
  nombre: string;
  superficieHa: number;
  sectorId: string;
  sectorNombre: string;
  socioId: string;
  titularNombres: string;
  titularCedula: string;
  latitud: number | null;
  longitud: number | null;
  tieneImagen: boolean;
  estado: "activo" | "inactivo";
}

/** Datos mínimos que viajan al navegador para dibujar el mapa. */
export interface DatoMapa {
  id: string;
  codigo: string;
  nombre: string;
  lat: number;
  lng: number;
  sectorNombre: string;
  superficieHa: number;
}

const COLUMNAS = {
  id: predio.id,
  codigo: predio.codigo,
  nombre: predio.nombre,
  superficieHa: predio.superficieHa,
  sectorId: predio.sectorId,
  sectorNombre: sector.nombre,
  socioId: predio.socioId,
  titularNombres: socio.nombres,
  titularCedula: socio.cedula,
  latitud: predio.latitud,
  longitud: predio.longitud,
  imagenRuta: predio.imagenRuta,
  estado: predio.estado,
};

type Fila = {
  id: string;
  codigo: string;
  nombre: string;
  superficieHa: string;
  sectorId: string;
  sectorNombre: string;
  socioId: string;
  titularNombres: string;
  titularCedula: string;
  latitud: string | null;
  longitud: string | null;
  imagenRuta: string | null;
  estado: "activo" | "inactivo";
};

function aListado(f: Fila): PredioListado {
  const { imagenRuta, latitud, longitud, superficieHa, ...resto } = f;
  return {
    ...resto,
    superficieHa: Number(superficieHa),
    latitud: latitud === null ? null : Number(latitud),
    longitud: longitud === null ? null : Number(longitud),
    tieneImagen: imagenRuta !== null,
  };
}

function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function mapearViolacion(e: unknown): never {
  const v = codigoPg(e);
  if (v.codigo === "23505") throw new AppError("CODIGO_DUPLICADO", undefined, "codigo");
  if (v.codigo === "23503" || v.codigo === "23001") {
    if (v.restriccion === "predio_socio_fk") throw new AppError("SOCIO_NO_ENCONTRADO", undefined, "socioId");
    throw new AppError("SECTOR_NO_ENCONTRADO", "El sector no existe.", "sectorId");
  }
  throw e;
}

async function exigirReferencias(tx: Db, ctx: CtxTenant, sectorId: string, socioId: string): Promise<void> {
  const [s] = await tx
    .select({ id: sector.id })
    .from(sector)
    .where(and(eq(sector.id, sectorId), eq(sector.tenantId, ctx.tenantId)))
    .limit(1);
  if (!s) throw new AppError("SECTOR_NO_ENCONTRADO", "El sector no existe.", "sectorId");
  const [t] = await tx
    .select({ id: socio.id })
    .from(socio)
    .where(and(eq(socio.id, socioId), eq(socio.tenantId, ctx.tenantId)))
    .limit(1);
  if (!t) throw new AppError("SOCIO_NO_ENCONTRADO", undefined, "socioId");
}

function condicionBase(ctx: CtxTenant, acotado: Acotado): SQL[] {
  const c: SQL[] = [eq(predio.tenantId, ctx.tenantId)];
  if (acotado) c.push(eq(predio.socioId, acotado));
  return c;
}

export interface PaginaPredios {
  items: PredioListado[];
  total: number;
  pagina: number;
  paginas: number;
}

export async function listarPredios(ctx: CtxTenant, filtros: FiltrosPredio, acotado?: Acotado): Promise<PaginaPredios> {
  const condiciones: (SQL | undefined)[] = condicionBase(ctx, acotado);
  if (filtros.sectorId) condiciones.push(eq(predio.sectorId, filtros.sectorId));
  if (filtros.socioId && !acotado) condiciones.push(eq(predio.socioId, filtros.socioId));
  if (filtros.estado) condiciones.push(eq(predio.estado, filtros.estado));
  if (filtros.busqueda) {
    const patron = `%${escaparLike(filtros.busqueda)}%`;
    condiciones.push(or(ilike(predio.codigo, patron), ilike(predio.nombre, patron), ilike(socio.nombres, patron)));
  }
  const donde = and(...condiciones);

  return withTenant(ctx, async (tx) => {
    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(predio)
      .innerJoin(socio, and(eq(socio.id, predio.socioId), eq(socio.tenantId, predio.tenantId)))
      .where(donde);
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_PREDIOS));
    const pagina = Math.min(filtros.pagina, paginas);
    const filas = await tx
      .select(COLUMNAS)
      .from(predio)
      .innerJoin(sector, and(eq(sector.id, predio.sectorId), eq(sector.tenantId, predio.tenantId)))
      .innerJoin(socio, and(eq(socio.id, predio.socioId), eq(socio.tenantId, predio.tenantId)))
      .where(donde)
      .orderBy(asc(sql`lower(${predio.codigo})`), asc(predio.id))
      .limit(TAMANO_PAGINA_PREDIOS)
      .offset((pagina - 1) * TAMANO_PAGINA_PREDIOS);
    return { items: filas.map(aListado), total, pagina, paginas };
  });
}

/** Predios activos con coordenadas para el mapa (solo los campos necesarios). */
export async function datosMapaPredios(
  ctx: CtxTenant,
  filtros: { sectorId?: string } = {},
  acotado?: Acotado,
): Promise<DatoMapa[]> {
  const condiciones: (SQL | undefined)[] = [
    ...condicionBase(ctx, acotado),
    eq(predio.estado, "activo"),
    isNotNull(predio.latitud),
    isNotNull(predio.longitud),
  ];
  if (filtros.sectorId) condiciones.push(eq(predio.sectorId, filtros.sectorId));
  return withTenant(ctx, async (tx) => {
    const filas = await tx
      .select({
        id: predio.id,
        codigo: predio.codigo,
        nombre: predio.nombre,
        lat: predio.latitud,
        lng: predio.longitud,
        sectorNombre: sector.nombre,
        superficieHa: predio.superficieHa,
      })
      .from(predio)
      .innerJoin(sector, and(eq(sector.id, predio.sectorId), eq(sector.tenantId, predio.tenantId)))
      .where(and(...condiciones))
      .orderBy(asc(sql`lower(${predio.codigo})`))
      .limit(MAX_PUNTOS_MAPA);
    return filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      lat: Number(f.lat),
      lng: Number(f.lng),
      sectorNombre: f.sectorNombre,
      superficieHa: Number(f.superficieHa),
    }));
  });
}

export async function obtenerPredio(ctx: CtxTenant, id: string, acotado?: Acotado): Promise<PredioListado | null> {
  return withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select(COLUMNAS)
      .from(predio)
      .innerJoin(sector, and(eq(sector.id, predio.sectorId), eq(sector.tenantId, predio.tenantId)))
      .innerJoin(socio, and(eq(socio.id, predio.socioId), eq(socio.tenantId, predio.tenantId)))
      .where(and(eq(predio.id, id), ...condicionBase(ctx, acotado)))
      .limit(1);
    return f ? aListado(f) : null;
  });
}

async function quitarArchivo(ruta: string | null | undefined): Promise<void> {
  if (!ruta) return;
  try {
    await fileStore().eliminar(ruta);
  } catch {
    console.error("No se pudo eliminar un archivo de predio");
  }
}

async function guardarImagen(ctx: CtxTenant, imagen: Uint8Array): Promise<string> {
  // valida el tipo real (PNG o JPEG) y el tamaño antes de escribir
  return fileStore().guardar(imagen, `predios/${ctx.tenantId}`, ["png", "jpg"], "IMAGEN_INVALIDA");
}

export async function crearPredio(
  ctx: CtxTenant,
  e: EntradaPredio,
  imagen?: Uint8Array | null,
): Promise<{ id: string }> {
  const ruta = imagen ? await guardarImagen(ctx, imagen) : null;
  try {
    return await withTenant(ctx, async (tx) => {
      await exigirReferencias(tx, ctx, e.sectorId, e.socioId);
      const [nuevo] = await tx
        .insert(predio)
        .values({
          tenantId: ctx.tenantId,
          codigo: e.codigo.trim(),
          nombre: e.nombre.trim(),
          superficieHa: String(e.superficieHa),
          sectorId: e.sectorId,
          socioId: e.socioId,
          latitud: e.latitud === undefined ? null : String(e.latitud),
          longitud: e.longitud === undefined ? null : String(e.longitud),
          imagenRuta: ruta,
        })
        .returning({ id: predio.id });
      if (!nuevo) throw new AppError("ERROR_INTERNO");
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "predio.crear",
        entidad: "predio",
        entidadId: nuevo.id,
        despues: {
          codigo: e.codigo.trim(),
          nombre: e.nombre.trim(),
          superficieHa: e.superficieHa,
          sectorId: e.sectorId,
          socioId: e.socioId,
          latitud: e.latitud ?? null,
          longitud: e.longitud ?? null,
          conImagen: ruta !== null,
        },
      });
      return nuevo;
    });
  } catch (err) {
    await quitarArchivo(ruta); // no dejar huérfana la imagen recién guardada
    return mapearViolacion(err);
  }
}

export async function editarPredio(
  ctx: CtxTenant,
  id: string,
  e: EntradaPredio,
  opciones: { imagen?: Uint8Array | null; quitarImagen?: boolean } = {},
): Promise<void> {
  const nueva = opciones.imagen ? await guardarImagen(ctx, opciones.imagen) : null;
  let anterior: string | null = null;
  try {
    await withTenant(ctx, async (tx) => {
      const [antes] = await tx
        .select()
        .from(predio)
        .where(and(eq(predio.id, id), eq(predio.tenantId, ctx.tenantId)))
        .limit(1);
      if (!antes) throw new AppError("PREDIO_NO_ENCONTRADO");
      await exigirReferencias(tx, ctx, e.sectorId, e.socioId);

      const cambiaImagen = nueva !== null || (opciones.quitarImagen === true && antes.imagenRuta !== null);
      const imagenRuta = nueva ?? (opciones.quitarImagen ? null : antes.imagenRuta);
      await tx
        .update(predio)
        .set({
          codigo: e.codigo.trim(),
          nombre: e.nombre.trim(),
          superficieHa: String(e.superficieHa),
          sectorId: e.sectorId,
          socioId: e.socioId,
          latitud: e.latitud === undefined ? null : String(e.latitud),
          longitud: e.longitud === undefined ? null : String(e.longitud),
          imagenRuta,
          actualizadoEn: new Date(),
        })
        .where(and(eq(predio.id, id), eq(predio.tenantId, ctx.tenantId)));
      if (cambiaImagen) anterior = antes.imagenRuta;
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "predio.editar",
        entidad: "predio",
        entidadId: id,
        antes: {
          codigo: antes.codigo,
          nombre: antes.nombre,
          superficieHa: Number(antes.superficieHa),
          sectorId: antes.sectorId,
          socioId: antes.socioId,
          latitud: antes.latitud === null ? null : Number(antes.latitud),
          longitud: antes.longitud === null ? null : Number(antes.longitud),
        },
        despues: {
          codigo: e.codigo.trim(),
          nombre: e.nombre.trim(),
          superficieHa: e.superficieHa,
          sectorId: e.sectorId,
          socioId: e.socioId,
          latitud: e.latitud ?? null,
          longitud: e.longitud ?? null,
        },
      });
      if (cambiaImagen) {
        await auditar(tx, {
          actorId: ctx.userId,
          tenantId: ctx.tenantId,
          accion: "predio.imagen",
          entidad: "predio",
          entidadId: id,
          antes: { conImagen: antes.imagenRuta !== null },
          despues: { conImagen: imagenRuta !== null },
        });
      }
    });
  } catch (err) {
    await quitarArchivo(nueva);
    return mapearViolacion(err);
  }
  await quitarArchivo(anterior); // la imagen reemplazada o quitada ya no se necesita
}

async function cambiarEstado(ctx: CtxTenant, id: string, estado: "activo" | "inactivo"): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx
      .select({ estado: predio.estado })
      .from(predio)
      .where(and(eq(predio.id, id), eq(predio.tenantId, ctx.tenantId)))
      .limit(1);
    if (!antes) throw new AppError("PREDIO_NO_ENCONTRADO");
    if (antes.estado === estado) return;
    await tx
      .update(predio)
      .set({ estado, actualizadoEn: new Date() })
      .where(and(eq(predio.id, id), eq(predio.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: estado === "inactivo" ? "predio.desactivar" : "predio.reactivar",
      entidad: "predio",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado },
    });
  });
}

export const desactivarPredio = (ctx: CtxTenant, id: string) => cambiarEstado(ctx, id, "inactivo");
export const reactivarPredio = (ctx: CtxTenant, id: string) => cambiarEstado(ctx, id, "activo");

/**
 * Bytes e tipo de la imagen del predio. La ruta nunca sale de aquí hacia el cliente. Devuelve null si el
 * predio no existe en la junta (RLS), no es del Socio que lo pide o no tiene imagen.
 */
export async function obtenerImagenPredio(
  ctx: CtxTenant,
  id: string,
  acotado?: Acotado,
): Promise<{ datos: Uint8Array; mime: string } | null> {
  const ruta = await withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select({ imagenRuta: predio.imagenRuta })
      .from(predio)
      .where(and(eq(predio.id, id), ...condicionBase(ctx, acotado)))
      .limit(1);
    return f?.imagenRuta ?? null;
  });
  if (!ruta) return null;
  try {
    const datos = await fileStore().leer(ruta);
    return { datos, mime: detectarTipo(datos)?.mime ?? "application/octet-stream" };
  } catch {
    return null; // archivo ausente en el almacén
  }
}
