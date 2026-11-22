import { and, desc, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type Db, type DbContext } from "../db/context";
import { designacionAdministrador, junta, usuario } from "../db/schema";
import { generarPasswordInicial, hashPassword } from "../auth/password";
import { revocarSesionesDeUsuario } from "../auth/session";
import { fileStore, validarArchivo } from "../files/file-store";
import { mailer } from "../mail/mailer";
import { normalizarCedula, validarCedula } from "../validation/cedula";
import type {
  EntradaAsignarAdministrador,
  EntradaCambiarAdministrador,
} from "../validation/administrador";
import { auditar } from "./audit";

type CtxSuper = Extract<DbContext, { role: "super_admin" }>;

export interface ResultadoDesignacion {
  usuarioId: string;
  /** Contraseña inicial: se muestra una sola vez y se envía por correo. */
  credencialInicial: string;
  correoEnviado: boolean;
}

function violacion(e: unknown): { codigo?: string; restriccion?: string } {
  const c = (e as { cause?: { code?: string; constraint_name?: string } })?.cause ?? (e as object);
  const x = c as { code?: string; constraint_name?: string };
  return { codigo: x.code, restriccion: x.constraint_name };
}

function validarEntrada(e: EntradaAsignarAdministrador): { cedula: string; correo: string } {
  const cedula = normalizarCedula(e.cedula);
  if (!validarCedula(cedula)) throw new AppError("CEDULA_INVALIDA", undefined, "cedula");
  const correo = e.correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new AppError("DATOS_INVALIDOS", "Correo no válido", "correo");
  }
  if (e.nombres.trim().length < 3) {
    throw new AppError("DATOS_INVALIDOS", "Ingrese los nombres completos", "nombres");
  }
  validarArchivo(e.acta); // lanza ACTA_INVALIDA
  return { cedula, correo };
}

async function crearAdministrador(
  tx: Db,
  ctx: CtxSuper,
  juntaId: string,
  datos: { cedula: string; correo: string; nombres: string },
  actaRuta: string,
  motivo: string | null,
): Promise<{ usuarioId: string; credencial: string; designacionId: string }> {
  const credencial = generarPasswordInicial();
  const [nuevo] = await tx
    .insert(usuario)
    .values({
      tenantId: juntaId,
      cedula: datos.cedula,
      nombres: datos.nombres.trim(),
      correo: datos.correo,
      rol: "admin_junta",
      passwordHash: await hashPassword(credencial),
      debeCambiarPassword: true,
    })
    .returning({ id: usuario.id });
  if (!nuevo) throw new AppError("ERROR_INTERNO");

  const [d] = await tx
    .insert(designacionAdministrador)
    .values({
      juntaId,
      usuarioId: nuevo.id,
      actaRuta,
      motivo,
      designadoPor: ctx.userId,
      vigente: true,
    })
    .returning({ id: designacionAdministrador.id });
  return { usuarioId: nuevo.id, credencial, designacionId: d!.id };
}

async function notificar(
  correo: string,
  nombreJunta: string,
  slug: string,
  cedula: string,
  credencial: string,
): Promise<boolean> {
  try {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    await mailer().enviar({
      para: correo,
      asunto: `Designación como Administrador de ${nombreJunta}`,
      texto:
        `Usted fue designado Administrador de la Junta «${nombreJunta}».\n\n` +
        `Ingrese en ${base}/login con:\n` +
        `  Identificador de junta: ${slug}\n  Cédula: ${cedula}\n  Contraseña inicial: ${credencial}\n\n` +
        `Al ingresar por primera vez deberá crear su propia contraseña.`,
    });
    return true;
  } catch {
    console.error("No se pudo enviar el correo de designación");
    return false;
  }
}

function mapearViolacion(e: unknown): never {
  const v = violacion(e);
  if (v.codigo === "23505") {
    if (v.restriccion === "usuario_correo_tenant_uq") throw new AppError("CORREO_DUPLICADO", undefined, "correo");
    if (v.restriccion === "usuario_un_admin_activo_uq") throw new AppError("JUNTA_YA_TIENE_ADMIN");
    throw new AppError("CEDULA_DUPLICADA", undefined, "cedula");
  }
  throw e;
}

export async function asignarAdministrador(
  ctx: CtxSuper,
  entrada: EntradaAsignarAdministrador,
): Promise<ResultadoDesignacion> {
  const { cedula, correo } = validarEntrada(entrada);

  let resultado: { usuarioId: string; credencial: string; nombreJunta: string; slug: string };
  try {
    resultado = await withTenant(ctx, async (tx) => {
      const [j] = await tx.select().from(junta).where(eq(junta.id, entrada.juntaId)).limit(1);
      if (!j) throw new AppError("JUNTA_NO_ENCONTRADA");
      const vigente = await tx
        .select({ id: usuario.id })
        .from(usuario)
        .where(and(eq(usuario.tenantId, j.id), eq(usuario.rol, "admin_junta"), eq(usuario.estado, "activo")))
        .limit(1);
      if (vigente.length > 0) throw new AppError("JUNTA_YA_TIENE_ADMIN");

      const actaRuta = await fileStore().guardar(entrada.acta, "actas");
      const c = await crearAdministrador(tx, ctx, j.id, { cedula, correo, nombres: entrada.nombres }, actaRuta, null);
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: j.id,
        accion: "admin.asignar",
        entidad: "usuario",
        entidadId: c.usuarioId,
        despues: { juntaId: j.id, cedula, correo, actaRuta, designacionId: c.designacionId },
      });
      return { usuarioId: c.usuarioId, credencial: c.credencial, nombreJunta: j.nombre, slug: j.slug };
    });
  } catch (e) {
    return mapearViolacion(e);
  }

  const correoEnviado = await notificar(correo, resultado.nombreJunta, resultado.slug, cedula, resultado.credencial);
  return { usuarioId: resultado.usuarioId, credencialInicial: resultado.credencial, correoEnviado };
}

export async function cambiarAdministrador(
  ctx: CtxSuper,
  entrada: EntradaCambiarAdministrador,
): Promise<ResultadoDesignacion> {
  const motivo = entrada.motivo.trim();
  if (motivo.length < 5) throw new AppError("MOTIVO_REQUERIDO", undefined, "motivo");
  const { cedula, correo } = validarEntrada(entrada);

  let resultado: { usuarioId: string; credencial: string; nombreJunta: string; slug: string };
  try {
    resultado = await withTenant(ctx, async (tx) => {
      const [j] = await tx.select().from(junta).where(eq(junta.id, entrada.juntaId)).limit(1);
      if (!j) throw new AppError("JUNTA_NO_ENCONTRADA");
      const [anterior] = await tx
        .select()
        .from(usuario)
        .where(and(eq(usuario.tenantId, j.id), eq(usuario.rol, "admin_junta"), eq(usuario.estado, "activo")))
        .limit(1);
      if (!anterior) {
        throw new AppError("JUNTA_SIN_ADMIN", "La junta no tiene administrador. Use «Asignar administrador».");
      }

      const actaRuta = await fileStore().guardar(entrada.acta, "actas");

      // el administrador anterior pasa a socio y pierde sus sesiones
      await tx.execute(sql`select degradar_administrador(${j.id}::uuid, ${anterior.id}::uuid)`);
      await revocarSesionesDeUsuario(tx, anterior.id);
      await tx
        .update(designacionAdministrador)
        .set({ vigente: false })
        .where(and(eq(designacionAdministrador.juntaId, j.id), eq(designacionAdministrador.vigente, true)));

      const c = await crearAdministrador(tx, ctx, j.id, { cedula, correo, nombres: entrada.nombres }, actaRuta, motivo);
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: j.id,
        accion: "admin.cambiar",
        entidad: "usuario",
        entidadId: c.usuarioId,
        antes: { administradorId: anterior.id, cedula: anterior.cedula, correo: anterior.correo },
        despues: { administradorId: c.usuarioId, cedula, correo, motivo, actaRuta, designacionId: c.designacionId },
      });
      return { usuarioId: c.usuarioId, credencial: c.credencial, nombreJunta: j.nombre, slug: j.slug };
    });
  } catch (e) {
    return mapearViolacion(e);
  }

  const correoEnviado = await notificar(correo, resultado.nombreJunta, resultado.slug, cedula, resultado.credencial);
  return { usuarioId: resultado.usuarioId, credencialInicial: resultado.credencial, correoEnviado };
}

export interface AdministradorActual {
  nombres: string;
  cedula: string;
  correo: string | null;
  desde: Date | null;
}

export async function obtenerAdministradorActual(ctx: CtxSuper, juntaId: string): Promise<AdministradorActual | null> {
  return withTenant(ctx, async (tx) => {
    const [u] = await tx
      .select()
      .from(usuario)
      .where(and(eq(usuario.tenantId, juntaId), eq(usuario.rol, "admin_junta"), eq(usuario.estado, "activo")))
      .limit(1);
    if (!u) return null;
    const [d] = await tx
      .select({ creada: designacionAdministrador.creadaEn })
      .from(designacionAdministrador)
      .where(and(eq(designacionAdministrador.juntaId, juntaId), eq(designacionAdministrador.vigente, true)))
      .orderBy(desc(designacionAdministrador.creadaEn))
      .limit(1);
    return { nombres: u.nombres, cedula: u.cedula, correo: u.correo, desde: d?.creada ?? null };
  });
}
