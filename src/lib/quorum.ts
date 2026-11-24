export type EstadoAsistenciaValor = "presente" | "ausente" | "justificado";

export interface ResumenAsistencia {
  total: number;
  presentes: number;
  ausentes: number;
  justificados: number;
  /** presentes / total de la lista, con un decimal; null si no hay socios. */
  porcentaje: number | null;
  quorumPorcentaje: number;
  alcanzaQuorum: boolean;
}

/**
 * Contadores y quórum de un evento. El quórum es `presentes / total de la lista` (las justificaciones
 * no cuentan como presentes) comparado con el porcentaje mínimo que configuró la junta.
 */
export function resumirAsistencia(
  estados: Iterable<EstadoAsistenciaValor>,
  quorumPorcentaje: number,
): ResumenAsistencia {
  let presentes = 0;
  let ausentes = 0;
  let justificados = 0;
  for (const e of estados) {
    if (e === "presente") presentes++;
    else if (e === "justificado") justificados++;
    else ausentes++;
  }
  const total = presentes + ausentes + justificados;
  return {
    total,
    presentes,
    ausentes,
    justificados,
    porcentaje: total === 0 ? null : Math.round((presentes / total) * 1000) / 10,
    quorumPorcentaje,
    // aritmética entera: evita errores de coma flotante en el límite exacto
    alcanzaQuorum: total > 0 && presentes * 100 >= quorumPorcentaje * total,
  };
}
