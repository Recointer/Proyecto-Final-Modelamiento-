export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;

export interface EstadoBloqueo {
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export function estaBloqueada(estado: EstadoBloqueo, ahora: Date = new Date()): boolean {
  return estado.bloqueadoHasta !== null && estado.bloqueadoHasta.getTime() > ahora.getTime();
}

/** Estado resultante tras un intento fallido. */
export function registrarFallo(estado: EstadoBloqueo, ahora: Date = new Date()): EstadoBloqueo {
  // un bloqueo ya vencido reinicia el conteo
  const previos =
    estado.bloqueadoHasta !== null && !estaBloqueada(estado, ahora) ? 0 : estado.intentosFallidos;
  const intentos = previos + 1;
  if (intentos >= MAX_INTENTOS) {
    return {
      intentosFallidos: 0,
      bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000),
    };
  }
  return { intentosFallidos: intentos, bloqueadoHasta: null };
}

export function registrarExito(): EstadoBloqueo {
  return { intentosFallidos: 0, bloqueadoHasta: null };
}
