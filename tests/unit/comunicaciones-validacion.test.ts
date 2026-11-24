import { describe, expect, it } from "vitest";
import { esPasada } from "@/lib/fechas";
import { comunicacionSchema, convocatoriaSchema, documentoSchema, nuevoHiloSchema } from "@/server/validation/comunicaciones";

describe("esPasada (hora de Ecuador, UTC-5)", () => {
  const ahora = new Date("2026-06-10T15:00:00Z"); // 10:00 en Ecuador
  it("compara fecha y hora locales", () => {
    expect(esPasada("2026-06-10", "09:59", ahora)).toBe(true);
    expect(esPasada("2026-06-10", "10:00", ahora)).toBe(true);
    expect(esPasada("2026-06-10", "10:01", ahora)).toBe(false);
    expect(esPasada("2026-06-09", "23:59", ahora)).toBe(true);
    expect(esPasada("2026-06-11", "00:00", ahora)).toBe(false);
  });
});

describe("validación de comunicaciones", () => {
  it("valida la convocatoria", () => {
    const ok = { tipo: "asamblea", titulo: "Asamblea ordinaria", fecha: "2030-01-10", hora: "18:30", lugar: "Casa comunal" };
    expect(convocatoriaSchema.safeParse(ok).success).toBe(true);
    for (const malo of [{ hora: "25:00" }, { fecha: "2030-02-30" }, { tipo: "reunion" }, { titulo: "ab" }, { lugar: "" }]) {
      expect(convocatoriaSchema.safeParse({ ...ok, ...malo }).success).toBe(false);
    }
  });

  it("valida documentos y comunicaciones (la recepción no puede ser futura)", () => {
    expect(documentoSchema.safeParse({ tipo: "resolucion", titulo: "Resolución 1", fecha: "2026-01-01" }).success).toBe(true);
    expect(documentoSchema.safeParse({ tipo: "otro", titulo: "Resolución 1", fecha: "2026-01-01" }).success).toBe(false);
    const base = { institucion: "GAD Parroquial", asunto: "Oficio de prueba", fechaRecepcion: "2026-01-01", resumen: "Resumen" };
    expect(comunicacionSchema.safeParse(base).success).toBe(true);
    expect(comunicacionSchema.safeParse({ ...base, fechaRecepcion: "2999-01-01" }).success).toBe(false);
  });

  it("limita el mensaje a 2.000 caracteres", () => {
    expect(nuevoHiloSchema.safeParse({ asunto: "Consulta", texto: "a".repeat(2000) }).success).toBe(true);
    expect(nuevoHiloSchema.safeParse({ asunto: "Consulta", texto: "a".repeat(2001) }).success).toBe(false);
    expect(nuevoHiloSchema.safeParse({ asunto: "Consulta", texto: "   " }).success).toBe(false);
  });
});
