import { describe, expect, it } from "vitest";
import { csvCelda, csvFila, generarCsv } from "@/lib/csv";
import {
  diasDelMes,
  formatoMes,
  inicioDeMes,
  mesAnterior,
  mesDe,
  mesSiguiente,
  parseMes,
  primerDiaLunesBase,
} from "@/lib/fechas";

describe("csv", () => {
  it("escapa comas, comillas y saltos de línea", () => {
    expect(csvCelda("a,b")).toBe('"a,b"');
    expect(csvCelda('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCelda("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(csvCelda("normal")).toBe("normal");
  });

  it("neutraliza la inyección de fórmulas", () => {
    expect(csvCelda("=SUMA(A1:A2)")).toBe("'=SUMA(A1:A2)");
    expect(csvCelda("+cmd")).toBe("'+cmd");
    expect(csvCelda("-1+2")).toBe("'-1+2");
    expect(csvCelda("@usuario")).toBe("'@usuario");
    expect(csvCelda('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`);
  });

  it("no altera números negativos reales ni valores vacíos", () => {
    expect(csvCelda(-5)).toBe("-5");
    expect(csvCelda(null)).toBe("");
    expect(csvCelda(undefined)).toBe("");
    expect(csvCelda(true)).toBe("true");
  });

  it("serializa fechas en ISO", () => {
    expect(csvCelda(new Date("2026-11-21T10:00:00Z"))).toBe("2026-11-21T10:00:00.000Z");
  });

  it("une filas con CRLF y BOM", () => {
    expect(csvFila(["a", 1, null])).toBe("a,1,");
    const csv = generarCsv([["x"], ["y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿x\r\ny\r\n");
  });
});

describe("fechas (hora de Ecuador, UTC-5)", () => {
  it("una fecha UTC de madrugada cae todavía en el mes anterior en Ecuador", () => {
    // 1 de diciembre 02:00 UTC = 30 de noviembre 21:00 en Ecuador
    expect(mesDe(new Date("2026-12-01T02:00:00Z"))).toEqual({ anio: 2026, mes: 11 });
    expect(mesDe(new Date("2026-12-01T05:00:00Z"))).toEqual({ anio: 2026, mes: 12 });
  });

  it("inicia el mes a las 05:00 UTC", () => {
    expect(inicioDeMes({ anio: 2026, mes: 11 }).toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("navega entre meses cruzando el año", () => {
    expect(mesSiguiente({ anio: 2026, mes: 12 })).toEqual({ anio: 2027, mes: 1 });
    expect(mesAnterior({ anio: 2026, mes: 1 })).toEqual({ anio: 2025, mes: 12 });
  });

  it("calcula días y primer día de la semana (lunes = 0)", () => {
    expect(diasDelMes({ anio: 2026, mes: 2 })).toBe(28);
    expect(diasDelMes({ anio: 2028, mes: 2 })).toBe(29);
    expect(primerDiaLunesBase({ anio: 2026, mes: 11 })).toBe(6); // 1-nov-2026 es domingo
    expect(primerDiaLunesBase({ anio: 2026, mes: 6 })).toBe(0); // 1-jun-2026 es lunes
  });

  it("valida el parámetro de mes", () => {
    expect(parseMes("2026-11")).toEqual({ anio: 2026, mes: 11 });
    expect(parseMes("2026-13")).toBeNull();
    expect(parseMes("2026-1")).toBeNull();
    expect(parseMes("1999-05")).toBeNull();
    expect(parseMes(undefined)).toBeNull();
    expect(parseMes("<script>")).toBeNull();
    expect(formatoMes({ anio: 2026, mes: 3 })).toBe("2026-03");
  });
});
