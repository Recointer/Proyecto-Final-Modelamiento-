import { describe, expect, it } from "vitest";
import {
  estaBloqueada,
  registrarExito,
  registrarFallo,
  type EstadoBloqueo,
} from "@/server/auth/lockout";

const ahora = new Date("2026-11-21T10:00:00Z");
const limpio: EstadoBloqueo = { intentosFallidos: 0, bloqueadoHasta: null };

describe("bloqueo por intentos fallidos", () => {
  it("acumula intentos sin bloquear antes del quinto", () => {
    let e = limpio;
    for (let i = 1; i <= 4; i++) {
      e = registrarFallo(e, ahora);
      expect(e.intentosFallidos).toBe(i);
      expect(estaBloqueada(e, ahora)).toBe(false);
    }
  });

  it("bloquea 15 minutos al quinto intento fallido", () => {
    let e = limpio;
    for (let i = 0; i < 5; i++) e = registrarFallo(e, ahora);
    expect(estaBloqueada(e, ahora)).toBe(true);
    expect(e.bloqueadoHasta?.getTime()).toBe(ahora.getTime() + 15 * 60_000);
  });

  it("el bloqueo vence después de 15 minutos", () => {
    let e = limpio;
    for (let i = 0; i < 5; i++) e = registrarFallo(e, ahora);
    const despues = new Date(ahora.getTime() + 16 * 60_000);
    expect(estaBloqueada(e, despues)).toBe(false);
    expect(registrarFallo(e, despues).intentosFallidos).toBe(1);
  });

  it("un ingreso correcto reinicia el contador", () => {
    expect(registrarExito()).toEqual(limpio);
  });
});
