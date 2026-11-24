import { describe, expect, it } from "vitest";
import { activoSchema, egresoSchema, emisionSchema, movimientoSchema, pagoSchema } from "@/server/validation/finanzas";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("validación financiera", () => {
  it("normaliza el monto del pago y rechaza cero, negativos y más de 2 decimales", () => {
    const base = { cargoId: uuid, fecha: "2020-01-02", forma: "efectivo" };
    expect(pagoSchema.parse({ ...base, monto: "12,5" }).monto).toBe("12.50");
    for (const monto of ["0", "-1", "1.234", "abc", ""]) expect(pagoSchema.safeParse({ ...base, monto }).success).toBe(false);
  });

  it("rechaza pagos y egresos con fecha futura o inexistente", () => {
    const futura = "2999-01-01";
    expect(pagoSchema.safeParse({ cargoId: uuid, monto: "1", fecha: futura, forma: "efectivo" }).success).toBe(false);
    expect(egresoSchema.safeParse({ fecha: futura, categoria: "compras", descripcion: "Tubería", beneficiario: "Ferretería", monto: "5" }).success).toBe(false);
    expect(egresoSchema.safeParse({ fecha: "2020-02-30", categoria: "compras", descripcion: "Tubería", beneficiario: "Ferretería", monto: "5" }).success).toBe(false);
  });

  it("exige sector o socio según el alcance de la emisión", () => {
    const base = { conceptoId: uuid, anio: "2026" };
    expect(emisionSchema.safeParse({ ...base, alcance: "todos" }).success).toBe(true);
    expect(emisionSchema.safeParse({ ...base, alcance: "sector" }).success).toBe(false);
    expect(emisionSchema.safeParse({ ...base, alcance: "socio" }).success).toBe(false);
    expect(emisionSchema.safeParse({ ...base, alcance: "sector", sectorId: uuid }).success).toBe(true);
    expect(emisionSchema.safeParse({ ...base, alcance: "todos", anio: "1999" }).success).toBe(false);
    expect(emisionSchema.safeParse({ ...base, alcance: "todos", monto: "0" }).success).toBe(false);
  });

  it("valida movimientos de inventario y activos", () => {
    expect(movimientoSchema.safeParse({ materialId: uuid, tipo: "salida", cantidad: "0", motivo: "Reparación" }).success).toBe(false);
    expect(movimientoSchema.safeParse({ materialId: uuid, tipo: "salida", cantidad: "2.5", motivo: "Reparación" }).success).toBe(true);
    expect(activoSchema.safeParse({ codigo: "A", nombre: "Bomba", fechaAdquisicion: "2020-01-01", valor: "10", ubicacion: "Bodega" }).success).toBe(false);
    expect(activoSchema.safeParse({ codigo: "AF-1", nombre: "Bomba", fechaAdquisicion: "2020-01-01", valor: "0", ubicacion: "Bodega" }).success).toBe(true);
  });
});
