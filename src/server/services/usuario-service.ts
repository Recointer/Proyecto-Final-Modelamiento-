import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { junta, usuario, type Usuario } from "../db/schema";
import { generarPasswordInicial, hashPassword } from "../auth/password";
import { revocarSesionesDeUsuario } from "../auth/session";
import { mailer } from "../mail/mailer";
import { normalizarCedula, validarCedula } from "../validation/cedula";
import {
  ROLES_GESTIONABLES,
  type EntradaCrearUsuario,
  type EntradaEditarUsuario,
  type FiltrosUsuario,
} from "../validation/usuario";
import { auditar } from "./audit";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export const TAMANO_PAGINA_USUARIOS = 20;

export type UsuarioListado = Pick<
  Usuario,
  "id" | "cedula" | "nombres" | "correo" | "telefono" | "rol" | "estado" | "debeCambiarPassword" | "creadoEn"
>;

export interface ResultadoCredencial {
  usuarioId: string;
  /** Se muestra una sola vez; además se envía por correo si la cuenta tiene correo. */
  credencialInicial: string;
  correoEnviado: boolean;
}

const COLUMNAS = {
  id: usuario.id,
  cedula: usuario.cedula,
  nombres: usuario.nombres,
  correo: usuario.correo,
  telefono: usuario.telefono,
  rol: usuario.rol,
  estado: usuario.estado,
  debeCambiarPassword: usuario.debeCambiarPassword,
  creadoEn: usuario.creadoEn,
};

function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function violacion(e: unknown): { codigo?: string; restriccion?: string } {
  const c = ((e as { cause?: unknown })?.cause ?? e) as { code?: string; constraint_name?: string };
  return { codigo: c?.code, restriccion: c?.constraint_name };
}

function mapearViolacion(e: unknown): never {
  const v = violacion(e);
  if (v.codigo === "23505") {
    if (v.restriccion === "usuario_correo_tenant_uq") throw new AppError("CORREO_DUPLICADO", undefined, "correo");
    throw new AppError("CEDULA_DUPLICADA", undefined, "cedula");
  }
  throw e;
}

function exigirRolGestionable(rol: string): void {
  if (!(ROLES_GESTIONABLES as readonly string[]).includes(rol)) {
    throw new AppError("ROL_NO_PERMITIDO", "Rol no permitido.", "rol");
  }
}

async function obtenerDeLaJunta(tx: Db, ctx: CtxTenant, id: string): Promise<Usuario> {
  const [u] = await tx
    .select()
    .from(usuario)
    .where(and(eq(usuario.id, id), eq(usuario.tenantId, ctx.tenantId)))
    .limit(1);
  if (!u) throw new AppError("USUARIO_NO_ENCONTRADO");
  return u;
}

async function notificarCredencial(
  ctx: CtxTenant,
  correo: string | null,
  cedula: string,
  credencial: string,
  motivo: "alta" | "restablecimiento",
): Promise<boolean> {
  if (!correo) return false;
  try {
    const [j] = await withTenant(ctx, (tx) =>
      tx.select({ nombre: junta.nombre, slug: junta.slug }).from(junta).where(eq(junta.id, ctx.tenantId)).limit(1),
    );
    const base = process.env.APP_URL ?? "http://localhost:3000";
    await mailer().enviar({
      para: correo,
      asunto: motivo === "alta" ? `Su cuenta en ${j?.nombre ?? "la junta"}` : "Su contraseña fue restablecida",
      texto:
        `${motivo === "alta" ? "Se creó su cuenta" : "Se restableció su contraseña"}${j ? ` en «${j.nombre}»` : ""}.\n\n` +
        `Ingrese en ${base}/login con:\n` +
        `  Identificador de junta: ${j?.slug ?? ""}\n  Cédula: ${cedula}\n  Contraseña inicial: ${credencial}\n\n` +
        `Al ingresar por primera vez deberá crear su propia contraseña.`,
    });
    return true;
  } catch {
    console.error("No se pudo enviar el correo de la cuenta");
    return false;
  }
}

export interface PaginaUsuarios {
  items: UsuarioListado[];
  total: number;
  pagina: number;
  paginas: number;
}

export async function listarUsuarios(ctx: CtxTenant, filtros: FiltrosUsuario): Promise<PaginaUsuarios> {
  const condiciones: (SQL | undefined)[] = [eq(usuario.tenantId, ctx.tenantId)];
  if (filtros.busqueda) {
    const patron = `%${escaparLike(filtros.busqueda)}%`;
    condiciones.push(or(ilike(usuario.nombres, patron), ilike(usuario.cedula, patron), ilike(usuario.correo, patron)));
  }
  if (filtros.rol) condiciones.push(eq(usuario.rol, filtros.rol));
  if (filtros.estado) condiciones.push(eq(usuario.estado, filtros.estado));
  const donde = and(...condiciones);

  return withTenant(ctx, async (tx) => {
    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(usuario)
      .where(donde);
    const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_USUARIOS));
    const pagina = Math.min(filtros.pagina, paginas);
    const items = await tx
      .select(COLUMNAS)
      .from(usuario)
      .where(donde)
      .orderBy(asc(sql`lower(${usuario.nombres})`), asc(usuario.id))
      .limit(TAMANO_PAGINA_USUARIOS)
      .offset((pagina - 1) * TAMANO_PAGINA_USUARIOS);
    return { items, total, pagina, paginas };
  });
}

export async function obtenerUsuario(ctx: CtxTenant, id: string): Promise<UsuarioListado | null> {
  return withTenant(ctx, async (tx) => {
    const [u] = await tx
      .select(COLUMNAS)
      .from(usuario)
      .where(and(eq(usuario.id, id), eq(usuario.tenantId, ctx.tenantId)))
      .limit(1);
    return u ?? null;
  });
}

export async function crearUsuario(ctx: CtxTenant, e: EntradaCrearUsuario): Promise<ResultadoCredencial> {
  exigirRolGestionable(e.rol);
  const cedula = normalizarCedula(e.cedula);
  if (!validarCedula(cedula)) throw new AppError("CEDULA_INVALIDA", undefined, "cedula");
  const credencial = generarPasswordInicial();
  const passwordHash = await hashPassword(credencial);
  const correo = e.correo?.trim().toLowerCase() || null;

  let id: string;
  try {
    id = await withTenant(ctx, async (tx) => {
      const [nuevo] = await tx
        .insert(usuario)
        .values({
          tenantId: ctx.tenantId,
          cedula,
          nombres: e.nombres.trim(),
          correo,
          telefono: e.telefono?.trim() || null,
          rol: e.rol,
          passwordHash,
          debeCambiarPassword: true,
        })
        .returning({ id: usuario.id });
      if (!nuevo) throw new AppError("ERROR_INTERNO");
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "usuario.crear",
        entidad: "usuario",
        entidadId: nuevo.id,
        despues: { cedula, nombres: e.nombres.trim(), correo, rol: e.rol },
      });
      return nuevo.id;
    });
  } catch (err) {
    return mapearViolacion(err);
  }

  const correoEnviado = await notificarCredencial(ctx, correo, cedula, credencial, "alta");
  return { usuarioId: id, credencialInicial: credencial, correoEnviado };
}

export async function editarUsuario(ctx: CtxTenant, id: string, e: EntradaEditarUsuario): Promise<void> {
  if (e.rol) exigirRolGestionable(e.rol);
  try {
    await withTenant(ctx, async (tx) => {
      const antes = await obtenerDeLaJunta(tx, ctx, id);
      const cambiaRol = e.rol !== undefined && e.rol !== antes.rol;
      // el rol del administrador lo gestiona la plataforma, y nadie cambia su propio rol
      if (cambiaRol && (antes.rol === "admin_junta" || id === ctx.userId)) {
        throw new AppError("ROL_NO_MODIFICABLE", "No puede cambiar el rol de esta cuenta.", "rol");
      }
      const correo = e.correo?.trim().toLowerCase() || null;
      const [despues] = await tx
        .update(usuario)
        .set({
          nombres: e.nombres.trim(),
          correo,
          telefono: e.telefono?.trim() || null,
          ...(cambiaRol ? { rol: e.rol } : {}),
        })
        .where(and(eq(usuario.id, id), eq(usuario.tenantId, ctx.tenantId)))
        .returning({ nombres: usuario.nombres, correo: usuario.correo, telefono: usuario.telefono, rol: usuario.rol });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "usuario.editar",
        entidad: "usuario",
        entidadId: id,
        antes: { nombres: antes.nombres, correo: antes.correo, telefono: antes.telefono, rol: antes.rol },
        despues,
      });
    });
  } catch (err) {
    return mapearViolacion(err);
  }
}

/** Desactivación lógica: la cuenta no ingresa, pero se conserva su historial (FR-015). */
export async function desactivarUsuario(ctx: CtxTenant, id: string): Promise<void> {
  if (id === ctx.userId) {
    throw new AppError("NO_PUEDE_DESACTIVARSE_A_SI_MISMO", "No puede desactivar su propia cuenta.");
  }
  await withTenant(ctx, async (tx) => {
    const antes = await obtenerDeLaJunta(tx, ctx, id);
    if (antes.estado === "desactivado") return;
    await tx
      .update(usuario)
      .set({ estado: "desactivado" })
      .where(and(eq(usuario.id, id), eq(usuario.tenantId, ctx.tenantId)));
    await revocarSesionesDeUsuario(tx, id);
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "usuario.desactivar",
      entidad: "usuario",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado: "desactivado" },
    });
  });
}

export async function reactivarUsuario(ctx: CtxTenant, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const antes = await obtenerDeLaJunta(tx, ctx, id);
    if (antes.estado === "activo") return;
    await tx
      .update(usuario)
      .set({ estado: "activo", intentosFallidos: 0, bloqueadoHasta: null })
      .where(and(eq(usuario.id, id), eq(usuario.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "usuario.reactivar",
      entidad: "usuario",
      entidadId: id,
      antes: { estado: antes.estado },
      despues: { estado: "activo" },
    });
  });
}

/** Genera una nueva credencial inicial, cierra sus sesiones y fuerza el cambio en el próximo ingreso. */
export async function restablecerCredencialInicial(ctx: CtxTenant, id: string): Promise<ResultadoCredencial> {
  if (id === ctx.userId) {
    throw new AppError("DATOS_INVALIDOS", "Para cambiar su propia contraseña use «¿Olvidó su contraseña?».");
  }
  const credencial = generarPasswordInicial();
  const passwordHash = await hashPassword(credencial);

  const u = await withTenant(ctx, async (tx) => {
    const actual = await obtenerDeLaJunta(tx, ctx, id);
    await tx
      .update(usuario)
      .set({ passwordHash, debeCambiarPassword: true, intentosFallidos: 0, bloqueadoHasta: null })
      .where(and(eq(usuario.id, id), eq(usuario.tenantId, ctx.tenantId)));
    await revocarSesionesDeUsuario(tx, id);
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "usuario.restablecer_credencial",
      entidad: "usuario",
      entidadId: id,
    });
    return actual;
  });

  const correoEnviado = await notificarCredencial(ctx, u.correo, u.cedula, credencial, "restablecimiento");
  return { usuarioId: id, credencialInicial: credencial, correoEnviado };
}
