import { describe, expect, it } from "vitest";
import { aCentavos, deCentavos, formatoUsd, sumarDinero } from "@/lib/dinero";

describe("dinero", () => {
  it("convierte texto a centavos aceptando coma o punto", () => {
    expect(aCentavos("12")).toBe(1200);
    expect(aCentavos("12.5")).toBe(1250);
    expect(aCentavos("12,50")).toBe(1250);
    expect(aCentavos("0.07")).toBe(7);
    expect(aCentavos(" 3 ")).toBe(300);
  });

  it("rechaza importes con más de 2 decimales o texto no numérico", () => {
    for (const malo of ["", "abc", "1.234", "-5", "1e3", "1.2.3", "12,", ".5"]) expect(aCentavos(malo)).toBeNull();
    expect(aCentavos(null)).toBeNull();
  });

  it("formatea centavos para la base de datos", () => {
    expect(deCentavos(1250)).toBe("12.50");
    expect(deCentavos(5)).toBe("0.05");
    expect(deCentavos(0)).toBe("0.00");
  });

  it("suma sin errores de redondeo", () => {
    // 0.1 + 0.2 en punto flotante da 0.30000000000000004
    expect(sumarDinero(["0.10", "0.20"])).toBe("0.30");
    expect(sumarDinero(["19.99", "0.01", null, undefined])).toBe("20.00");
    expect(sumarDinero([])).toBe("0.00");
  });

  it("formatea en dólares con separadores de Ecuador", () => {
    expect(formatoUsd("1234.5")).toBe("$ 1.234,50");
    expect(formatoUsd("0")).toBe("$ 0,00");
    expect(formatoUsd("1234567.89")).toBe("$ 1.234.567,89");
  });
});
