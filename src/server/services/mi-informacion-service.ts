import { and, asc, desc, eq, gte, isNotNull, ne } from "drizzle-orm";
import { calcularCumplimiento, type Cumplimiento } from "@/lib/cumplimiento";
import { withTenant, type DbContext } from "../db/context";
import { asistencia, evento, sector } from "../db/schema";
import { listarPredios, type PredioListado } from "./predio-service";
import { socioDeSesion } from "./socio-sesion";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;
type Usuario = { cedula: string };

export interface MiFicha {
  id: string;
  cedula: string;
  nombres: string;
  correo: string | null;
  telefono: string | null;
  sectorId: string;
  sectorNombre: string;
  fechaIngreso: string;
  estado: "activo" | "inactivo";
}

export interface MiInformacion {
  ficha: MiFicha;
  predios: PredioListado[];
  totalPredios: number;
}

export interface FilaHistorial {
  eventoId: string;
  titulo: string;
  tipo: "asamblea" | "minga";
  fecha: string;
  lugar: string;
  estado: "presente" | "ausente" | "justificado";
  motivo: string | null;
}

export interface MiHistorial {
  socio: { id: string; cedula: string; nombres: string; fechaIngreso: string };
  items: FilaHistorial[];
  cumplimiento: Cumplimiento;
}

/**
 * Todo se acota por el socio derivado de la sesión (cédula de la cuenta dentro de la junta): ningún dato
 * del socio llega desde el cliente (FR-021). Devuelve null si la cuenta aún no figura en el padrón.
 */
export async function obtenerMiInformacion(ctx: CtxTenant, user: Usuario): Promise<MiInformacion | null> {
  const s = await socioDeSesion(ctx, user);
  if (!s) return null;
  const sectorNombre = await withTenant(ctx, async (tx) => {
    const [fila] = await tx
      .select({ nombre: sector.nombre })
      .from(sector)
      .where(and(eq(sector.id, s.sectorId), eq(sector.tenantId, ctx.tenantId)))
      .limit(1);
    return fila?.nombre ?? "";
  });
  const predios = await listarPredios(ctx, { pagina: 1 }, s.id);
  return {
    ficha: {
      id: s.id,
      cedula: s.cedula,
      nombres: s.nombres,
      correo: s.correo,
      telefono: s.telefono,
      sectorId: s.sectorId,
      sectorNombre,
      fechaIngreso: s.fechaIngreso,
      estado: s.estado,
    },
    predios: predios.items,
    totalPredios: predios.total,
  };
}

/**
 * Historial de asistencia del propio socio: solo eventos no anulados, con asistencia registrada y de fecha
 * igual o posterior a su ingreso. Más reciente primero.
 */
export async function obtenerMiHistorial(
  ctx: CtxTenant,
  user: Usuario,
  filtros: { tipo?: "asamblea" | "minga" } = {},
): Promise<MiHistorial | null> {
  const s = await socioDeSesion(ctx, user);
  if (!s) return null;
  const items = await withTenant(ctx, async (tx) => {
    const filas = await tx
      .select({
        eventoId: evento.id,
        titulo: evento.titulo,
        tipo: evento.tipo,
        fecha: evento.fecha,
        lugar: evento.lugar,
        estado: asistencia.estado,
        motivo: asistencia.motivo,
      })
      .from(asistencia)
      .innerJoin(evento, and(eq(evento.id, asistencia.eventoId), eq(evento.tenantId, asistencia.tenantId)))
      .where(
        and(
          eq(asistencia.tenantId, ctx.tenantId),
          eq(asistencia.socioId, s.id),
          ne(evento.estado, "anulado"),
          isNotNull(evento.asistenciaRegistradaEn),
          gte(evento.fecha, s.fechaIngreso),
          filtros.tipo ? eq(evento.tipo, filtros.tipo) : undefined,
        ),
      )
      .orderBy(desc(evento.fecha), asc(evento.titulo), asc(evento.id));
    return filas;
  });
  return {
    socio: { id: s.id, cedula: s.cedula, nombres: s.nombres, fechaIngreso: s.fechaIngreso },
    items,
    cumplimiento: calcularCumplimiento(items.map((i) => i.estado)),
  };
}
