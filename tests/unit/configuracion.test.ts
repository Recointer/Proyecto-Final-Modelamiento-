import { describe, expect, it } from "vitest";
import {
  configuracionSchema,
  parametrosDe,
  PARAMETROS_POR_DEFECTO,
  sectorSchema,
} from "@/server/validation/configuracion";

const base = {
  nombre: "Junta San Antonio",
  tipo: "riego",
  provincia: "Pichincha",
  canton: "Quito",
  parroquia: "San Antonio",
  multaAsamblea: "5",
  multaMinga: "2,50",
  quorumPorcentaje: "50",
};

describe("parametrosDe", () => {
  it("devuelve los valores por defecto si no hay nada guardado", () => {
    expect(parametrosDe(undefined)).toEqual(PARAMETROS_POR_DEFECTO);
    expect(parametrosDe(null)).toEqual(PARAMETROS_POR_DEFECTO);
    expect(parametrosDe({})).toEqual(PARAMETROS_POR_DEFECTO);
  });

  it("conserva lo guardado y completa lo que falta", () => {
    expect(parametrosDe({ multaMinga: 3 })).toEqual({ ...PARAMETROS_POR_DEFECTO, multaMinga: 3 });
  });

  it("ignora valores que no son números", () => {
    expect(parametrosDe({ multaAsamblea: "mucho", quorumPorcentaje: NaN })).toEqual(PARAMETROS_POR_DEFECTO);
  });
});

describe("configuracionSchema", () => {
  it("acepta coma o punto decimal y convierte a número", () => {
    const r = configuracionSchema.parse(base);
    expect(r.multaAsamblea).toBe(5);
    expect(r.multaMinga).toBe(2.5);
    expect(r.quorumPorcentaje).toBe(50);
  });

  it("rechaza montos negativos, con letras, con más de 2 decimales o sobre el máximo", () => {
    for (const v of ["-1", "abc", "1.234", "", "1001", "1e3"]) {
      expect(configuracionSchema.safeParse({ ...base, multaAsamblea: v }).success, `monto "${v}"`).toBe(false);
    }
    expect(configuracionSchema.safeParse({ ...base, multaAsamblea: "1000" }).success).toBe(true);
    expect(configuracionSchema.safeParse({ ...base, multaAsamblea: "0" }).success).toBe(true);
  });

  it("el quórum debe ser un entero entre 1 y 100", () => {
    for (const v of ["0", "101", "50.5", "", "abc", "-5"]) {
      expect(configuracionSchema.safeParse({ ...base, quorumPorcentaje: v }).success, `quórum "${v}"`).toBe(false);
    }
    expect(configuracionSchema.safeParse({ ...base, quorumPorcentaje: "100" }).success).toBe(true);
    expect(configuracionSchema.safeParse({ ...base, quorumPorcentaje: "1" }).success).toBe(true);
  });

  it("exige los datos generales de la junta", () => {
    expect(configuracionSchema.safeParse({ ...base, nombre: "" }).success).toBe(false);
    expect(configuracionSchema.safeParse({ ...base, tipo: "inventado" }).success).toBe(false);
    expect(configuracionSchema.safeParse({ ...base, provincia: " " }).success).toBe(false);
  });
});

describe("sectorSchema", () => {
  it("exige nombre de al menos 2 caracteres y limita la descripción", () => {
    expect(sectorSchema.safeParse({ nombre: "A" }).success).toBe(false);
    expect(sectorSchema.safeParse({ nombre: "Norte" }).success).toBe(true);
    expect(sectorSchema.safeParse({ nombre: "Norte", descripcion: "x".repeat(301) }).success).toBe(false);
  });

  it("recorta espacios y trata la descripción vacía como ausente", () => {
    const r = sectorSchema.parse({ nombre: "  Sector Norte  ", descripcion: "  " });
    expect(r.nombre).toBe("Sector Norte");
    expect(r.descripcion).toBeUndefined();
  });
});
