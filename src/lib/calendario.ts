export interface TurnoSemana {
  id: string;
  servicio: string;
  /** 1 = lunes … 7 = domingo */
  dia: number;
  /** HH:MM */
  inicio: string;
  fin: string;
}

export interface ProximoTurno extends TurnoSemana {
  /** true si el turno está en marcha ahora mismo. */
  enCurso: boolean;
  /** Minutos hasta que empieza (0 si está en curso). */
  enMinutos: number;
}

const MIN_DIA = 1440;
const MIN_SEMANA = 7 * MIN_DIA;
const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Día de la semana (1 = lunes) y minuto del día en hora de Ecuador (UTC-5, sin horario de verano). */
export function ahoraEcuador(ahora: Date): { dia: number; minuto: number } {
  const d = new Date(ahora.getTime() - 5 * 3600_000);
  return { dia: ((d.getUTCDay() + 6) % 7) + 1, minuto: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** Los `n` turnos que empiezan antes (o están en curso), considerando que la semana se repite. */
export function proximosTurnos(turnos: TurnoSemana[], ahora: Date, n = 3): ProximoTurno[] {
  const { dia, minuto } = ahoraEcuador(ahora);
  const actual = (dia - 1) * MIN_DIA + minuto;
  return turnos
    .map((t) => {
      const inicio = (t.dia - 1) * MIN_DIA + aMinutos(t.inicio);
      const fin = (t.dia - 1) * MIN_DIA + aMinutos(t.fin);
      const enCurso = actual >= inicio && actual < fin;
      return { ...t, enCurso, enMinutos: enCurso ? 0 : (inicio - actual + MIN_SEMANA) % MIN_SEMANA };
    })
    .sort((a, b) => a.enMinutos - b.enMinutos || a.inicio.localeCompare(b.inicio) || a.servicio.localeCompare(b.servicio))
    .slice(0, n);
}

/** "en 3 h 20 min", "mañana", "en curso"… para mostrar al usuario. */
export function textoEn(minutos: number, enCurso: boolean): string {
  if (enCurso) return "en curso";
  if (minutos < 60) return `en ${minutos} min`;
  if (minutos < MIN_DIA) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
  }
  const d = Math.floor(minutos / MIN_DIA);
  return d === 1 ? "en 1 día" : `en ${d} días`;
}
