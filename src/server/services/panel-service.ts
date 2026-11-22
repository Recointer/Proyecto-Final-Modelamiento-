import { sql, desc } from "drizzle-orm";
import { generarCsv } from "@/lib/csv";
import { inicioDeMes, mesAnterior, mesDe, mesSiguiente, type MesCalendario } from "@/lib/fechas";
import { withTenant, type DbContext } from "../db/context";
import { junta } from "../db/schema";

type CtxSuper = Extract<DbContext, { role: "super_admin" }>;

/** Evento visible en el calendario de la plataforma (solo fecha y título agregados). */
export interface EventoCalendario {
  dia: number;
  titulo: string;
}

export interface Panel {
  totalJuntas: number;
  juntasActivas: number;
  juntasDesactivadas: number;
  /** Juntas activas que todavía no tienen un administrador vigente. */
  juntasSinAdministrador: number;
  nuevasEsteMes: number;
  nuevasMesAnterior: number;
  totalEventos: number;
  eventosDelMes: EventoCalendario[];
  recientes: { id: string; nombre: string; provincia: string; estado: "activa" | "desactivada"; creadaEn: Date }[];
}

/**
 * Los eventos (asambleas, mingas) los define el módulo administrativo. Mientras ese módulo no
 * exista el total es 0. Cuando exista, el conteo debe hacerse con una función agregada
 * SECURITY DEFINER (que reciba el mes mostrado en el calendario): el super_admin nunca debe leer
 * filas internas de las juntas (Principio I).
 */
async function contarEventos(): Promise<{ total: number; delMes: EventoCalendario[] }> {
  return { total: 0, delMes: [] };
}

/**
 * Cifras agregadas para el panel del Super Administrador. Solo devuelve conteos y datos de
 * la tabla de plataforma (junta); no accede a socios, sectores ni finanzas.
 */
export async function obtenerPanel(
  ctx: CtxSuper,
  opciones: { mes?: MesCalendario; ahora?: Date } = {},
): Promise<Panel> {
  const ahora = opciones.ahora ?? new Date();
  const actual = mesDe(ahora);
  const inicioActual = inicioDeMes(actual).toISOString();
  const inicioSiguiente = inicioDeMes(mesSiguiente(actual)).toISOString();
  const inicioPrevio = inicioDeMes(mesAnterior(actual)).toISOString();

  const eventos = await contarEventos();

  const datos = await withTenant(ctx, async (tx) => {
    const [t] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        activas: sql<number>`count(*) filter (where ${junta.estado} = 'activa')::int`,
        desactivadas: sql<number>`count(*) filter (where ${junta.estado} = 'desactivada')::int`,
        nuevasEsteMes: sql<number>`count(*) filter (where ${junta.creadaEn} >= ${inicioActual}::timestamptz and ${junta.creadaEn} < ${inicioSiguiente}::timestamptz)::int`,
        nuevasMesAnterior: sql<number>`count(*) filter (where ${junta.creadaEn} >= ${inicioPrevio}::timestamptz and ${junta.creadaEn} < ${inicioActual}::timestamptz)::int`,
        sinAdmin: sql<number>`count(*) filter (where ${junta.estado} = 'activa' and not exists (
          select 1 from usuario u where u.tenant_id = "junta"."id" and u.rol = 'admin_junta' and u.estado = 'activo'
        ))::int`,
      })
      .from(junta);

    const recientes = await tx
      .select({
        id: junta.id,
        nombre: junta.nombre,
        provincia: junta.provincia,
        estado: junta.estado,
        creadaEn: junta.creadaEn,
      })
      .from(junta)
      .orderBy(desc(junta.creadaEn))
      .limit(5);

    return { t, recientes };
  });

  const t = datos.t;
  return {
    totalJuntas: t?.total ?? 0,
    juntasActivas: t?.activas ?? 0,
    juntasDesactivadas: t?.desactivadas ?? 0,
    juntasSinAdministrador: t?.sinAdmin ?? 0,
    nuevasEsteMes: t?.nuevasEsteMes ?? 0,
    nuevasMesAnterior: t?.nuevasMesAnterior ?? 0,
    totalEventos: eventos.total,
    eventosDelMes: eventos.delMes,
    recientes: datos.recientes,
  };
}

/** Reporte CSV de la plataforma: totales y listado de juntas (sin datos internos). */
export async function generarReportePlataforma(ctx: CtxSuper, ahora: Date = new Date()): Promise<string> {
  const panel = await obtenerPanel(ctx, { ahora });

  const filas = await withTenant(ctx, (tx) =>
    tx
      .select({
        nombre: junta.nombre,
        slug: junta.slug,
        tipo: junta.tipo,
        provincia: junta.provincia,
        canton: junta.canton,
        parroquia: junta.parroquia,
        estado: junta.estado,
        creadaEn: junta.creadaEn,
        tieneAdmin: sql<boolean>`exists (
          select 1 from usuario u where u.tenant_id = "junta"."id" and u.rol = 'admin_junta' and u.estado = 'activo'
        )`,
      })
      .from(junta)
      .orderBy(sql`lower(${junta.nombre})`),
  );

  return generarCsv([
    ["Reporte de la plataforma Multi-Junta"],
    ["Generado", ahora],
    [],
    ["Resumen", "Valor"],
    ["Total de juntas", panel.totalJuntas],
    ["Juntas activas", panel.juntasActivas],
    ["Juntas desactivadas", panel.juntasDesactivadas],
    ["Juntas activas sin administrador", panel.juntasSinAdministrador],
    ["Juntas nuevas este mes", panel.nuevasEsteMes],
    ["Juntas nuevas el mes anterior", panel.nuevasMesAnterior],
    ["Total de eventos", panel.totalEventos],
    [],
    ["Nombre", "Identificador", "Tipo", "Provincia", "Cantón", "Parroquia", "Estado", "Creada", "Tiene administrador"],
    ...filas.map((f) => [
      f.nombre,
      f.slug,
      f.tipo,
      f.provincia,
      f.canton,
      f.parroquia,
      f.estado,
      f.creadaEn,
      f.tieneAdmin ? "sí" : "no",
    ]),
  ]);
}
