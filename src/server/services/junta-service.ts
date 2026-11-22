import { and, asc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { junta, type Junta } from "../db/schema";
import { revocarSesionesDeJunta } from "../auth/session";
import {
  slugify,
  type EntradaCrearJunta,
  type EntradaJunta,
  type FiltrosJunta,
} from "../validation/junta";
import { auditar } from "./audit";

export const TAMANO_PAGINA = 20;

type CtxSuper = Extract<DbContext, { role: "super_admin" }>;

function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function esViolacionUnica(e: unknown): boolean {
  const causa = (e as { cause?: { code?: string } } | undefined)?.cause;
  return causa?.code === "23505" || (e as { code?: string } | undefined)?.code === "23505";
}

async function existeDuplicado(
  tx: Db,
  nombre: string,
  parroquia: string,
  excluirId?: string,
): Promise<boolean> {
  const cond = and(
    sql`lower(${junta.nombre}) = lower(${nombre})`,
    sql`lower(${junta.parroquia}) = lower(${parroquia})`,
    excluirId ? ne(junta.id, excluirId) : undefined,
  );
  const filas = await tx.select({ id: junta.id }).from(junta).where(cond).limit(1);
  return filas.length > 0;
}

async function slugDisponible(tx: Db, base: string): Promise<string> {
  for (let n = 1; n < 1000; n++) {
    const candidato = n === 1 ? base : `${base}-${n}`;
    const filas = await tx.select({ id: junta.id }).from(junta).where(eq(junta.slug, candidato)).limit(1);
    if (filas.length === 0) return candidato;
  }
  throw new AppError("ERROR_INTERNO");
}

function datosEditables(e: EntradaJunta) {
  return {
    nombre: e.nombre,
    tipo: e.tipo,
    provincia: e.provincia,
    canton: e.canton,
    parroquia: e.parroquia,
    contactoNombre: e.contactoNombre ?? null,
    contactoTelefono: e.contactoTelefono ?? null,
    contactoCorreo: e.contactoCorreo ?? null,
  };
}

export async function crearJunta(ctx: CtxSuper, entrada: EntradaCrearJunta): Promise<Junta> {
  try {
    return await withTenant(ctx, async (tx) => {
      if (await existeDuplicado(tx, entrada.nombre, entrada.parroquia)) {
        throw new AppError("JUNTA_DUPLICADA", undefined, "nombre");
      }
      let slug: string;
      if (entrada.slug) {
        const usado = await tx.select({ id: junta.id }).from(junta).where(eq(junta.slug, entrada.slug)).limit(1);
        if (usado.length > 0) throw new AppError("SLUG_DUPLICADO", "Ese identificador ya está en uso.", "slug");
        slug = entrada.slug;
      } else {
        slug = await slugDisponible(tx, slugify(entrada.nombre));
      }
      const [nueva] = await tx
        .insert(junta)
        .values({ ...datosEditables(entrada), slug })
        .returning();
      if (!nueva) throw new AppError("ERROR_INTERNO");
      await auditar(tx, {
        actorId: ctx.userId,
        accion: "junta.crear",
        entidad: "junta",
        entidadId: nueva.id,
        despues: nueva,
      });
      return nueva;
    });
  } catch (e) {
    if (esViolacionUnica(e)) throw new AppError("JUNTA_DUPLICADA", undefined, "nombre");
    throw e;
  }
}

export async function obtenerJunta(ctx: CtxSuper, id: string): Promise<Junta | null> {
  return withTenant(ctx, async (tx) => {
    const [j] = await tx.select().from(junta).where(eq(junta.id, id)).limit(1);
    return j ?? null;
  });
}

export async function editarJunta(ctx: CtxSuper, id: string, entrada: EntradaJunta): Promise<Junta> {
  try {
    return await withTenant(ctx, async (tx) => {
      const [antes] = await tx.select().from(junta).where(eq(junta.id, id)).limit(1);
      if (!antes) throw new AppError("JUNTA_NO_ENCONTRADA", "La junta no existe.");
      if (await existeDuplicado(tx, entrada.nombre, entrada.parroquia, id)) {
        throw new AppError("JUNTA_DUPLICADA", undefined, "nombre");
      }
      const [despues] = await tx
        .update(junta)
        .set({ ...datosEditables(entrada), actualizadaEn: new Date() })
        .where(eq(junta.id, id))
        .returning();
      await auditar(tx, {
        actorId: ctx.userId,
        accion: "junta.editar",
        entidad: "junta",
        entidadId: id,
        antes,
        despues,
      });
      return despues!;
    });
  } catch (e) {
    if (esViolacionUnica(e)) throw new AppError("JUNTA_DUPLICADA", undefined, "nombre");
    throw e;
  }
}

/** Desactivación lógica: conserva los datos y cierra las sesiones de la junta (FR-004, FR-007). */
export async function desactivarJunta(ctx: CtxSuper, id: string, confirmar: boolean): Promise<void> {
  if (!confirmar) throw new AppError("CONFIRMACION_REQUERIDA", "Debe confirmar la desactivación.");
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx.select().from(junta).where(eq(junta.id, id)).limit(1);
    if (!antes) throw new AppError("JUNTA_NO_ENCONTRADA", "La junta no existe.");
    if (antes.estado === "desactivada") return;
    await tx.update(junta).set({ estado: "desactivada", actualizadaEn: new Date() }).where(eq(junta.id, id));
    await revocarSesionesDeJunta(tx, id);
    await auditar(tx, {
      actorId: ctx.userId,
      accion: "junta.desactivar",
      entidad: "junta",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado: "desactivada" },
    });
  });
}

export async function reactivarJunta(ctx: CtxSuper, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [antes] = await tx.select().from(junta).where(eq(junta.id, id)).limit(1);
    if (!antes) throw new AppError("JUNTA_NO_ENCONTRADA", "La junta no existe.");
    if (antes.estado === "activa") return;
    await tx.update(junta).set({ estado: "activa", actualizadaEn: new Date() }).where(eq(junta.id, id));
    await auditar(tx, {
      actorId: ctx.userId,
      accion: "junta.reactivar",
      entidad: "junta",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado: "activa" },
    });
  });
}

export interface PaginaJuntas {
  items: Junta[];
  total: number;
  pagina: number;
  paginas: number;
}

export async function listarJuntas(ctx: CtxSuper, filtros: FiltrosJunta): Promise<PaginaJuntas> {
  const condiciones: (SQL | undefined)[] = [];
  if (filtros.busqueda) {
    const patron = `%${escaparLike(filtros.busqueda)}%`;
    condiciones.push(or(ilike(junta.nombre, patron), ilike(junta.slug, patron)));
  }
  if (filtros.provincia) condiciones.push(sql`lower(${junta.provincia}) = lower(${filtros.provincia})`);
  if (filtros.canton) condiciones.push(sql`lower(${junta.canton}) = lower(${filtros.canton})`);
  if (filtros.parroquia) condiciones.push(sql`lower(${junta.parroquia}) = lower(${filtros.parroquia})`);
  if (filtros.estado) condiciones.push(eq(junta.estado, filtros.estado));
  const donde = and(...condiciones);

  return withTenant(ctx, async (tx) => {
    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(junta)
      .where(donde);
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
    const pagina = Math.min(filtros.pagina, paginas);
    const items = await tx
      .select()
      .from(junta)
      .where(donde)
      .orderBy(asc(sql`lower(${junta.nombre})`), asc(junta.id))
      .limit(TAMANO_PAGINA)
      .offset((pagina - 1) * TAMANO_PAGINA);
    return { items, total, pagina, paginas };
  });
}

/** Valores distintos de ubicación para los filtros del listado. */
export async function listarUbicaciones(ctx: CtxSuper) {
  return withTenant(ctx, async (tx) => {
    const filas = await tx
      .selectDistinct({ provincia: junta.provincia, canton: junta.canton, parroquia: junta.parroquia })
      .from(junta)
      .orderBy(asc(junta.provincia), asc(junta.canton), asc(junta.parroquia));
    return {
      provincias: [...new Set(filas.map((f) => f.provincia))],
      cantones: [...new Set(filas.map((f) => f.canton))],
      parroquias: [...new Set(filas.map((f) => f.parroquia))],
    };
  });
}
