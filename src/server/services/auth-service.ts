import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant } from "../db/context";
import { junta, usuario, type Rol } from "../db/schema";
import { estaBloqueada, registrarExito, registrarFallo } from "../auth/lockout";
import { hashPassword, verifyPassword } from "../auth/password";
import { crearSesionEnBd } from "../auth/session";
import { normalizarCedula } from "../validation/cedula";

export interface EntradaLogin {
  junta?: string;
  identificador: string;
  password: string;
  recordar: boolean;
}

export interface SesionCreada {
  token: string;
  expiraEn: Date;
  recordar: boolean;
  rol: Rol;
  debeCambiarPassword: boolean;
}

type Salida =
  | { tipo: "ok"; sesion: SesionCreada }
  | { tipo: "error"; codigo: string; juntas?: { slug: string; nombre: string }[] };

// Hash falso para igualar tiempos cuando la cuenta no existe
let hashFalso: string | undefined;

/** Normaliza el identificador: 10 dígitos = cédula; si no, correo. */
export function clasificarIdentificador(valor: string): { cedula?: string; correo?: string } {
  const limpio = valor.trim();
  const posibleCedula = normalizarCedula(limpio);
  if (/^\d{10}$/.test(posibleCedula)) return { cedula: posibleCedula };
  return { correo: limpio.toLowerCase() };
}

export async function iniciarSesion(entrada: EntradaLogin): Promise<SesionCreada> {
  const id = clasificarIdentificador(entrada.identificador);
  const slug = entrada.junta?.trim().toLowerCase() || undefined;

  const salida = await withTenant({ role: "auth" }, async (tx): Promise<Salida> => {
    let tenantFiltro: string | undefined;
    if (slug) {
      const [j] = await tx.select({ id: junta.id }).from(junta).where(eq(junta.slug, slug)).limit(1);
      if (!j) {
        hashFalso ??= await hashPassword("relleno-de-tiempo-1");
        await verifyPassword(hashFalso, entrada.password);
        return { tipo: "error", codigo: "CREDENCIALES_INVALIDAS" };
      }
      tenantFiltro = j.id;
    }

    const condId = id.cedula
      ? eq(usuario.cedula, id.cedula)
      : sql`lower(${usuario.correo}) = ${id.correo ?? ""}`;
    const candidatos = await tx
      .select({
        u: usuario,
        juntaSlug: junta.slug,
        juntaNombre: junta.nombre,
        juntaEstado: junta.estado,
      })
      .from(usuario)
      .leftJoin(junta, eq(junta.id, usuario.tenantId))
      .where(tenantFiltro ? and(condId, eq(usuario.tenantId, tenantFiltro)) : condId);

    if (candidatos.length === 0) {
      hashFalso ??= await hashPassword("relleno-de-tiempo-1");
      await verifyPassword(hashFalso, entrada.password);
      return { tipo: "error", codigo: "CREDENCIALES_INVALIDAS" };
    }

    const ahora = new Date();
    const aciertos: typeof candidatos = [];
    let bloqueada = false;
    for (const c of candidatos) {
      if (estaBloqueada(c.u, ahora)) {
        bloqueada = true;
        continue;
      }
      if (await verifyPassword(c.u.passwordHash, entrada.password)) {
        aciertos.push(c);
      } else {
        const nuevo = registrarFallo(c.u, ahora);
        await tx
          .update(usuario)
          .set({ intentosFallidos: nuevo.intentosFallidos, bloqueadoHasta: nuevo.bloqueadoHasta })
          .where(eq(usuario.id, c.u.id));
      }
    }

    if (aciertos.length === 0) {
      return { tipo: "error", codigo: bloqueada ? "CUENTA_BLOQUEADA" : "CREDENCIALES_INVALIDAS" };
    }
    if (aciertos.length > 1) {
      // Solo se revelan las juntas cuyas credenciales coinciden con la contraseña ingresada
      return {
        tipo: "error",
        codigo: "ELEGIR_JUNTA",
        juntas: aciertos.flatMap((a) =>
          a.juntaSlug && a.juntaNombre ? [{ slug: a.juntaSlug, nombre: a.juntaNombre }] : [],
        ),
      };
    }

    const { u, juntaEstado } = aciertos[0]!;
    if (u.estado !== "activo") return { tipo: "error", codigo: "CUENTA_DESACTIVADA" };
    if (u.tenantId && juntaEstado !== "activa") return { tipo: "error", codigo: "JUNTA_DESACTIVADA" };

    const reinicio = registrarExito();
    await tx
      .update(usuario)
      .set({ intentosFallidos: reinicio.intentosFallidos, bloqueadoHasta: reinicio.bloqueadoHasta })
      .where(eq(usuario.id, u.id));
    const { token, expiraEn } = await crearSesionEnBd(tx, u, entrada.recordar);
    return {
      tipo: "ok",
      sesion: {
        token,
        expiraEn,
        recordar: entrada.recordar,
        rol: u.rol,
        debeCambiarPassword: u.debeCambiarPassword,
      },
    };
  });

  if (salida.tipo === "ok") return salida.sesion;
  const err = new AppError(salida.codigo);
  if (salida.juntas) Object.assign(err, { juntas: salida.juntas });
  throw err;
}
