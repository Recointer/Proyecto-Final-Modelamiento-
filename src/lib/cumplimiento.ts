import type { EstadoAsistenciaValor } from "./quorum";

/** Meta de referencia de asistencia de la junta (porcentaje). */
export const META_CUMPLIMIENTO = 80;

export interface Cumplimiento {
  presentes: number;
  ausentes: number;
  justificados: number;
  /** Eventos que pesan en el porcentaje: presentes + ausentes (las justificaciones no cuentan). */
  computables: number;
  /** presentes / (presentes + ausentes) con un decimal; null si no hay eventos computables («no aplica»). */
  porcentaje: number | null;
  meta: number;
  /** null cuando no aplica. */
  cumpleMeta: boolean | null;
}

/**
 * Cumplimiento de asistencia de un socio: las asistencias suman, las ausencias injustificadas restan y las
 * justificadas ni penalizan ni suman. Solo se pasan los eventos computables (no anulados, con asistencia
 * registrada y de fecha igual o posterior al ingreso del socio).
 */
export function calcularCumplimiento(estados: Iterable<EstadoAsistenciaValor>): Cumplimiento {
  let presentes = 0;
  let ausentes = 0;
  let justificados = 0;
  for (const e of estados) {
    if (e === "presente") presentes++;
    else if (e === "justificado") justificados++;
    else ausentes++;
  }
  const computables = presentes + ausentes;
  const porcentaje = computables === 0 ? null : Math.round((presentes / computables) * 1000) / 10;
  return {
    presentes,
    ausentes,
    justificados,
    computables,
    porcentaje,
    meta: META_CUMPLIMIENTO,
    cumpleMeta: porcentaje === null ? null : porcentaje >= META_CUMPLIMIENTO,
  };
}
