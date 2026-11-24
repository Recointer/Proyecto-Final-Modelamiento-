import { describe, expect, it } from "vitest";
import { esFechaFutura, hoyEcuador } from "@/lib/fechas";
import { crearSocioSchema, editarSocioSchema, filtrosSocioSchema } from "@/server/validation/socio";

const SECTOR = "11111111-2222-4333-8444-555555555555";
const base = {
  cedula: "1710034065",
  nombres: "Ana Torres",
  sectorId: SECTOR,
  fechaIngreso: "2020-05-10",
};

describe("crearSocioSchema", () => {
  it("acepta un socio mínimo y normaliza la cédula", () => {
    const r = crearSocioSchema.parse({ ...base, cedula: " 171003-4065 " });
    expect(r.cedula).toBe("1710034065");
    expect(r.correo).toBeUndefined();
    expect(r.telefono).toBeUndefined();
  });

  it("rechaza cédulas inválidas", () => {
    for (const cedula of ["1710034066", "abc", "", "123"]) {
      expect(crearSocioSchema.safeParse({ ...base, cedula }).success, cedula).toBe(false);
    }
  });

  it("exige nombres completos y un sector válido", () => {
    expect(crearSocioSchema.safeParse({ ...base, nombres: "Al" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, nombres: "   " }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, sectorId: "" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, sectorId: "no-es-uuid" }).success).toBe(false);
  });

  it("valida y normaliza correo y teléfono opcionales", () => {
    expect(crearSocioSchema.parse({ ...base, correo: " ANA@Correo.COM " }).correo).toBe("ana@correo.com");
    expect(crearSocioSchema.parse({ ...base, correo: "  ", telefono: "" }).correo).toBeUndefined();
    expect(crearSocioSchema.safeParse({ ...base, correo: "no-es-correo" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, telefono: "0991234567" }).success).toBe(true);
    expect(crearSocioSchema.safeParse({ ...base, telefono: "llamar" }).success).toBe(false);
  });

  it("la fecha de ingreso debe ser una fecha real y no futura", () => {
    expect(crearSocioSchema.safeParse({ ...base, fechaIngreso: "2026-02-30" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, fechaIngreso: "10/05/2020" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, fechaIngreso: "" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, fechaIngreso: "2999-01-01" }).success).toBe(false);
    expect(crearSocioSchema.safeParse({ ...base, fechaIngreso: hoyEcuador() }).success).toBe(true);
  });
});

describe("editarSocioSchema", () => {
  it("no incluye la cédula (inmutable)", () => {
    const r = editarSocioSchema.parse({ ...base });
    expect("cedula" in r).toBe(false);
  });
});

describe("filtrosSocioSchema", () => {
  it("usa la página 1 por defecto y valida sector y estado", () => {
    expect(filtrosSocioSchema.parse({}).pagina).toBe(1);
    expect(filtrosSocioSchema.safeParse({ pagina: "0" }).success).toBe(false);
    expect(filtrosSocioSchema.safeParse({ estado: "borrado" }).success).toBe(false);
    expect(filtrosSocioSchema.safeParse({ sectorId: "x" }).success).toBe(false);
    expect(filtrosSocioSchema.parse({ estado: "inactivo", sectorId: SECTOR, pagina: "2" })).toMatchObject({
      estado: "inactivo",
      pagina: 2,
    });
  });
});

describe("hoyEcuador y esFechaFutura (UTC-5)", () => {
  it("de madrugada en UTC todavía es el día anterior en Ecuador", () => {
    expect(hoyEcuador(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11-30");
    expect(hoyEcuador(new Date("2026-12-01T05:00:00Z"))).toBe("2026-12-01");
    expect(hoyEcuador(new Date("2027-01-01T04:59:00Z"))).toBe("2026-12-31");
  });

  it("compara fechas de calendario", () => {
    const ahora = new Date("2026-11-22T15:00:00Z");
    expect(esFechaFutura("2026-11-22", ahora)).toBe(false);
    expect(esFechaFutura("2026-11-23", ahora)).toBe(true);
    expect(esFechaFutura("2020-01-01", ahora)).toBe(false);
  });
});
