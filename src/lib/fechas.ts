/** Ecuador continental no usa horario de verano: UTC-5 fijo. */
const OFFSET_MS = -5 * 3600_000;

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface MesCalendario {
  anio: number;
  /** 1–12 */
  mes: number;
}

/** Año y mes (hora de Ecuador) de una fecha. */
export function mesDe(fecha: Date): MesCalendario {
  const local = new Date(fecha.getTime() + OFFSET_MS);
  return { anio: local.getUTCFullYear(), mes: local.getUTCMonth() + 1 };
}

/** Instante UTC en que empieza el mes dado en hora de Ecuador. */
export function inicioDeMes({ anio, mes }: MesCalendario): Date {
  return new Date(Date.UTC(anio, mes - 1, 1) - OFFSET_MS);
}

export function mesSiguiente({ anio, mes }: MesCalendario): MesCalendario {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

export function mesAnterior({ anio, mes }: MesCalendario): MesCalendario {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

export function diasDelMes({ anio, mes }: MesCalendario): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Día de la semana del día 1 con lunes = 0 … domingo = 6. */
export function primerDiaLunesBase({ anio, mes }: MesCalendario): number {
  const dow = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay(); // 0 = domingo
  return (dow + 6) % 7;
}

/** "2026-11" → { anio, mes }; null si no es válido (años 2000–2100). */
export function parseMes(valor: string | undefined): MesCalendario | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(valor ?? "");
  if (!m) return null;
  const anio = Number(m[1]);
  if (anio < 2000 || anio > 2100) return null;
  return { anio, mes: Number(m[2]) };
}

export function formatoMes({ anio, mes }: MesCalendario): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/** Fecha de calendario de hoy en Ecuador, como AAAA-MM-DD. */
export function hoyEcuador(ahora: Date = new Date()): string {
  const { anio, mes } = mesDe(ahora);
  const dia = new Date(ahora.getTime() + OFFSET_MS).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** true si la fecha AAAA-MM-DD es posterior a hoy (hora de Ecuador). */
export function esFechaFutura(fecha: string, ahora: Date = new Date()): boolean {
  return fecha > hoyEcuador(ahora);
}
