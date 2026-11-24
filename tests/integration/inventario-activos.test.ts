import { describe, expect, it } from "vitest";
import { crearActivo, darDeBajaActivo, editarActivo, listarActivos, obtenerActivo } from "@/server/services/activo-service";
import { crearMaterial, editarMaterial, listarMateriales, listarMovimientos, registrarMovimiento } from "@/server/services/inventario-service";
import { adminSql } from "./setup";
import { codigo, escenarioFinanzas } from "./helpers-finanzas";

const material = (extra: Record<string, string> = {}) => ({ nombre: "Tubería PVC", unidad: "m", stockInicial: "50.00", minimo: "10.00", ...extra });
const activo = (extra: Record<string, string> = {}) => ({ codigo: "AF-001", nombre: "Bomba de agua", fechaAdquisicion: "2020-05-01", valor: "850.00", ubicacion: "Bodega", ...extra });

describe("inventario (RF-21)", () => {
  it("registra entradas y salidas, actualiza el stock y deja historial", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearMaterial(e.ctxA, material());
    expect((await registrarMovimiento(e.ctxA, { materialId: id, tipo: "salida", cantidad: "12.5", motivo: "Reparación canal" })).stock).toBe("37.50");
    expect((await registrarMovimiento(e.ctxA, { materialId: id, tipo: "entrada", cantidad: "20", motivo: "Compra" })).stock).toBe("57.50");
    const movs = await listarMovimientos(e.ctxA, id);
    expect(movs.map((m) => [m.tipo, m.cantidad, m.motivo])).toEqual([
      ["entrada", "20.00", "Compra"],
      ["salida", "12.50", "Reparación canal"],
      ["entrada", "50.00", "Stock inicial"],
    ]);
  });

  it("rechaza una salida mayor al stock y no cambia nada", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearMaterial(e.ctxA, material({ stockInicial: "5.00" }));
    expect(await codigo(registrarMovimiento(e.ctxA, { materialId: id, tipo: "salida", cantidad: "5.01", motivo: "Prueba" }))).toBe("STOCK_INSUFICIENTE");
    expect((await listarMateriales(e.ctxA))[0]!.stock).toBe("5.00");
    expect(await listarMovimientos(e.ctxA, id)).toHaveLength(1);
  });

  it("dos salidas simultáneas no dejan el stock negativo", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearMaterial(e.ctxA, material({ stockInicial: "10.00" }));
    const r = await Promise.allSettled([
      registrarMovimiento(e.ctxA, { materialId: id, tipo: "salida", cantidad: "7", motivo: "Uso A" }),
      registrarMovimiento(e.ctxA, { materialId: id, tipo: "salida", cantidad: "7", motivo: "Uso B" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await listarMateriales(e.ctxA))[0]!.stock).toBe("3.00");
  });

  it("marca el stock bajo, evita nombres duplicados y aísla por junta", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearMaterial(e.ctxA, material({ stockInicial: "10.00", minimo: "10.00" }));
    expect((await listarMateriales(e.ctxA))[0]!.bajo).toBe(true);
    await registrarMovimiento(e.ctxA, { materialId: id, tipo: "entrada", cantidad: "1", motivo: "Compra" });
    expect((await listarMateriales(e.ctxA))[0]!.bajo).toBe(false);
    expect(await codigo(crearMaterial(e.ctxA, material({ nombre: "tubería pvc" })))).toBe("MATERIAL_DUPLICADO");
    await editarMaterial(e.ctxA, id, { nombre: "Tubería PVC 2\"", unidad: "m", minimo: "3.00", estado: "inactivo" });
    expect((await listarMateriales(e.ctxA))[0]).toMatchObject({ nombre: 'Tubería PVC 2"', estado: "inactivo", bajo: false });
    expect(await listarMateriales(e.ctxB)).toEqual([]);
    expect(await codigo(registrarMovimiento(e.ctxB, { materialId: id, tipo: "entrada", cantidad: "1", motivo: "Intento" }))).toBe("MATERIAL_NO_ENCONTRADO");
  });

  it("los movimientos no se modifican ni se borran con acceso directo", async () => {
    const e = await escenarioFinanzas();
    await crearMaterial(e.ctxA, material());
    await expect(
      adminSql().begin(async (tx) => {
        await tx`SELECT set_config('app.role', 'tenant', true)`;
        await tx`DELETE FROM movimiento_material`;
      }),
    ).rejects.toThrow(/no se eliminan/);
  });
});

describe("activos fijos (RF-22)", () => {
  it("crea, edita, rechaza códigos duplicados y da de baja con motivo", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearActivo(e.ctxA, activo());
    expect(await codigo(crearActivo(e.ctxA, activo({ codigo: "af-001" })))).toBe("ACTIVO_DUPLICADO");
    await editarActivo(e.ctxA, id, activo({ ubicacion: "Casa comunal", valor: "900.00" }));
    expect(await obtenerActivo(e.ctxA, id)).toMatchObject({ ubicacion: "Casa comunal", valor: "900.00", estado: "vigente" });

    await darDeBajaActivo(e.ctxA, id, "Dañado sin reparación");
    expect(await obtenerActivo(e.ctxA, id)).toMatchObject({ estado: "baja", motivoBaja: "Dañado sin reparación" });
    expect(await codigo(darDeBajaActivo(e.ctxA, id, "otra vez"))).toBe("ACTIVO_EN_BAJA");
    expect(await codigo(editarActivo(e.ctxA, id, activo()))).toBe("ACTIVO_EN_BAJA");
    expect(await listarActivos(e.ctxA)).toHaveLength(1);
  });

  it("aísla los activos por junta y permite el mismo código en otra junta", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearActivo(e.ctxA, activo());
    expect(await obtenerActivo(e.ctxB, id)).toBeNull();
    expect(await listarActivos(e.ctxB)).toEqual([]);
    await crearActivo(e.ctxB, activo());
    expect(await codigo(darDeBajaActivo(e.ctxB, id, "Intento ajeno"))).toBe("ACTIVO_NO_ENCONTRADO");
  });
});
