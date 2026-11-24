import { describe, expect, it } from "vitest";
import { filtrosPredioSchema, fueraDeEcuador, predioSchema } from "@/server/validation/predio";

const SECTOR = "11111111-2222-4333-8444-555555555555";
const SOCIO = "99999999-2222-4333-8444-555555555555";
const base = {
  codigo: "P-045",
  nombre: "Parcela Central",
  superficieHa: "1,25",
  sectorId: SECTOR,
  socioId: SOCIO,
  latitud: "-1.25431",
  longitud: "-78.62312",
};

describe("predioSchema", () => {
  it("acepta un predio completo y convierte a números (coma o punto decimal)", () => {
    const r = predioSchema.parse(base);
    expect(r).toMatchObject({ codigo: "P-045", superficieHa: 1.25, latitud: -1.25431, longitud: -78.62312 });
    expect(predioSchema.parse({ ...base, superficieHa: "2.5" }).superficieHa).toBe(2.5);
  });

  it("las coordenadas son opcionales, pero ambas o ninguna", () => {
    const sin = predioSchema.parse({ ...base, latitud: "", longitud: "  " });
    expect(sin.latitud).toBeUndefined();
    expect(sin.longitud).toBeUndefined();
    expect(predioSchema.safeParse({ ...base, longitud: "" }).success).toBe(false);
    expect(predioSchema.safeParse({ ...base, latitud: "" }).success).toBe(false);
  });

  it("rechaza coordenadas fuera de rango o con formato inválido", () => {
    for (const [latitud, longitud] of [["91", "0"], ["-91", "0"], ["0", "181"], ["0", "-181"], ["abc", "0"], ["0", "1e3"], ["1.1234567", "0"]]) {
      expect(predioSchema.safeParse({ ...base, latitud, longitud }).success, `${latitud},${longitud}`).toBe(false);
    }
    expect(predioSchema.safeParse({ ...base, latitud: "90", longitud: "180" }).success).toBe(true);
    expect(predioSchema.safeParse({ ...base, latitud: "-90", longitud: "-180" }).success).toBe(true);
  });

  it("la superficie debe ser positiva con hasta 4 decimales", () => {
    for (const s of ["0", "-1", "abc", "", "1.23456", "1e3", "1234567"]) {
      expect(predioSchema.safeParse({ ...base, superficieHa: s }).success, s).toBe(false);
    }
    expect(predioSchema.safeParse({ ...base, superficieHa: "0.0001" }).success).toBe(true);
    expect(predioSchema.safeParse({ ...base, superficieHa: "999999.9999" }).success).toBe(true);
  });

  it("exige código de 2 a 20 caracteres, nombre, sector y titular válidos", () => {
    expect(predioSchema.safeParse({ ...base, codigo: "P" }).success).toBe(false);
    expect(predioSchema.safeParse({ ...base, codigo: "X".repeat(21) }).success).toBe(false);
    expect(predioSchema.safeParse({ ...base, codigo: "  P-9  " }).success).toBe(true);
    expect(predioSchema.safeParse({ ...base, nombre: "  " }).success).toBe(false);
    expect(predioSchema.safeParse({ ...base, sectorId: "" }).success).toBe(false);
    expect(predioSchema.safeParse({ ...base, socioId: "no-uuid" }).success).toBe(false);
  });

  it("recorta espacios en el código y el nombre", () => {
    const r = predioSchema.parse({ ...base, codigo: "  P-9 ", nombre: "  Mi parcela  " });
    expect(r).toMatchObject({ codigo: "P-9", nombre: "Mi parcela" });
  });
});

describe("filtrosPredioSchema", () => {
  it("usa la página 1 por defecto y valida los filtros", () => {
    expect(filtrosPredioSchema.parse({}).pagina).toBe(1);
    expect(filtrosPredioSchema.safeParse({ sectorId: "x" }).success).toBe(false);
    expect(filtrosPredioSchema.safeParse({ estado: "borrado" }).success).toBe(false);
    expect(filtrosPredioSchema.parse({ sectorId: SECTOR, estado: "activo", pagina: "2" })).toMatchObject({ pagina: 2 });
  });
});

describe("fueraDeEcuador", () => {
  it("reconoce puntos dentro del país (continente y Galápagos)", () => {
    expect(fueraDeEcuador(-0.18, -78.47)).toBe(false); // Quito
    expect(fueraDeEcuador(-2.17, -79.9)).toBe(false); // Guayaquil
    expect(fueraDeEcuador(-0.74, -90.31)).toBe(false); // Galápagos
  });

  it("avisa de puntos fuera de Ecuador", () => {
    expect(fueraDeEcuador(40.4, -3.7)).toBe(true); // Madrid
    expect(fueraDeEcuador(4.6, -74.1)).toBe(true); // Bogotá
    expect(fueraDeEcuador(0, 0)).toBe(true);
  });
});
