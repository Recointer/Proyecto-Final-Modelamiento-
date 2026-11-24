import { and, asc, eq } from "drizzle-orm";
import { proximosTurnos, type ProximoTurno, type TurnoSemana } from "@/lib/calendario";
import { withTenant, type DbContext } from "../db/context";
import { servicio, turno } from "../db/schema";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface TurnoCalendario extends TurnoSemana {
  tipo: string;
}

export interface CalendarioSemanal {
  /** Índice 0 = lunes … 6 = domingo. */
  dias: TurnoCalendario[][];
  proximos: ProximoTurno[];
}

/** Turnos de los servicios ACTIVOS para un sector, agrupados por día, y los próximos a empezar. */
export async function obtenerCalendarioSemanal(
  ctx: CtxTenant,
  sectorId: string,
  ahora: Date = new Date(),
): Promise<CalendarioSemanal> {
  const filas = await withTenant(ctx, (tx) =>
    tx
      .select({
        id: turno.id,
        servicio: servicio.nombre,
        tipo: servicio.tipo,
        dia: turno.diaSemana,
        inicio: turno.horaInicio,
        fin: turno.horaFin,
      })
      .from(turno)
      .innerJoin(servicio, and(eq(servicio.id, turno.servicioId), eq(servicio.tenantId, turno.tenantId)))
      .where(and(eq(turno.tenantId, ctx.tenantId), eq(turno.sectorId, sectorId), eq(servicio.estado, "activo")))
      .orderBy(asc(turno.diaSemana), asc(turno.horaInicio)),
  );
  const turnos: TurnoCalendario[] = filas.map((f) => ({ ...f, inicio: f.inicio.slice(0, 5), fin: f.fin.slice(0, 5) }));
  const dias: TurnoCalendario[][] = Array.from({ length: 7 }, () => []);
  for (const t of turnos) dias[t.dia - 1]?.push(t);
  return { dias, proximos: proximosTurnos(turnos, ahora) };
}
