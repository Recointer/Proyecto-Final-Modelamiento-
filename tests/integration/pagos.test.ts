import { describe, expect, it } from "vitest";
import { crearConcepto, listarConceptos, cambiarEstadoConcepto, editarConcepto } from "@/server/services/concepto-service";
import { anularCargo, emitirCargos, listarCargos, obtenerCargo } from "@/server/services/cargo-service";
import { anularPago, comprobanteDe, registrarPago } from "@/server/services/pago-service";
import { adminSql } from "./setup";
import { codigo, escenarioFinanzas } from "./helpers-finanzas";

const emision = (conceptoId: string, extra: Record<string, unknown> = {}) => ({ conceptoId, anio: 2026, alcance: "todos" as const, ...extra });
const pago = (cargoId: string, monto: string, extra: Record<string, unknown> = {}) => ({ cargoId, monto, fecha: "2026-02-01", forma: "efectivo" as const, ...extra });

async function conCargo(monto = "24.00") {
  const e = await escenarioFinanzas();
  const { id: conceptoId } = await crearConcepto(e.ctxA, { nombre: "Cuota anual de riego", tipo: "cuota", montoDefecto: monto });
  await emitirCargos(e.ctxA, emision(conceptoId, { alcance: "socio", socioId: e.s1 }));
  const { items } = await listarCargos(e.ctxA);
  return { ...e, conceptoId, cargoId: items[0]!.id };
}

describe("conceptos de cobro", () => {
  it("crea, lista, edita, desactiva y rechaza duplicados sin distinguir mayúsculas", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearConcepto(e.ctxA, { nombre: "Mantenimiento", tipo: "servicio", montoDefecto: "5.00" });
    expect(await codigo(crearConcepto(e.ctxA, { nombre: "MANTENIMIENTO", tipo: "cuota", montoDefecto: "1.00" }))).toBe("CONCEPTO_DUPLICADO");
    await editarConcepto(e.ctxA, id, { nombre: "Mantenimiento de canales", tipo: "servicio", montoDefecto: "6.50" });
    await cambiarEstadoConcepto(e.ctxA, id, "inactivo");
    const [c] = await listarConceptos(e.ctxA);
    expect(c).toMatchObject({ nombre: "Mantenimiento de canales", montoDefecto: "6.50", estado: "inactivo" });
    expect(await codigo(emitirCargos(e.ctxA, emision(id)))).toBe("CONCEPTO_INACTIVO");
    expect(await listarConceptos(e.ctxB, { soloActivos: false })).toEqual([]);
  });
});

describe("emisión de cargos", () => {
  it("emite a todos los socios activos sin duplicar al repetir", async () => {
    const e = await escenarioFinanzas();
    await adminSql()`UPDATE socio SET estado = 'inactivo' WHERE id = ${e.s3}`;
    const { id } = await crearConcepto(e.ctxA, { nombre: "Cuota", tipo: "cuota", montoDefecto: "10.00" });
    expect(await emitirCargos(e.ctxA, emision(id))).toMatchObject({ emitidos: 2, existentes: 0, monto: "10.00" });
    expect(await emitirCargos(e.ctxA, emision(id))).toMatchObject({ emitidos: 0, existentes: 2 });
    expect((await listarCargos(e.ctxA)).total).toBe(2);
  });

  it("emite por sector y por socio, y usa el monto indicado si lo hay", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearConcepto(e.ctxA, { nombre: "Cuota", tipo: "cuota", montoDefecto: "10.00" });
    expect((await emitirCargos(e.ctxA, emision(id, { alcance: "sector", sectorId: e.sur, monto: "12.5" }))).monto).toBe("12.50");
    expect((await listarCargos(e.ctxA, { sectorId: e.sur })).total).toBe(1);
    expect((await listarCargos(e.ctxA, { sectorId: e.norte })).total).toBe(0);
  });

  it("no emite a socios que ingresaron después del año ni a un socio de otra junta", async () => {
    const e = await escenarioFinanzas();
    await adminSql()`UPDATE socio SET fecha_ingreso = '2027-01-01' WHERE id = ${e.s2}`;
    const { id } = await crearConcepto(e.ctxA, { nombre: "Cuota", tipo: "cuota", montoDefecto: "10.00" });
    expect((await emitirCargos(e.ctxA, emision(id))).emitidos).toBe(2);
    expect(await codigo(emitirCargos(e.ctxA, emision(id, { alcance: "socio", socioId: e.sb })))).toBe("SOCIO_NO_ENCONTRADO");
  });

  it("exige monto cuando el concepto no tiene monto por defecto", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearConcepto(e.ctxA, { nombre: "Variable", tipo: "servicio", montoDefecto: "0.00" });
    expect(await codigo(emitirCargos(e.ctxA, emision(id)))).toBe("MONTO_INVALIDO");
  });
});

describe("pagos y saldo", () => {
  it("pago parcial y luego el saldo: pasa de pendiente a parcial y a pagado", async () => {
    const e = await conCargo("24.00");
    let c = await obtenerCargo(e.ctxA, e.cargoId);
    expect(c).toMatchObject({ estado: "pendiente", pagado: "0.00", saldo: "24.00" });
    const p1 = await registrarPago(e.ctxA, pago(e.cargoId, "10"));
    c = await obtenerCargo(e.ctxA, e.cargoId);
    expect(c).toMatchObject({ estado: "parcial", pagado: "10.00", saldo: "14.00" });
    const p2 = await registrarPago(e.ctxA, pago(e.cargoId, "14.00", { forma: "transferencia", referencia: "TR-123" }));
    c = await obtenerCargo(e.ctxA, e.cargoId);
    expect(c).toMatchObject({ estado: "pagado", saldo: "0.00" });
    expect([p1.numero, p2.numero]).toEqual([1, 2]);
    expect(c!.pagos.map((p) => p.numero)).toEqual([1, 2]);
  });

  it("rechaza un pago mayor al saldo y nada cambia", async () => {
    const e = await conCargo("24.00");
    await registrarPago(e.ctxA, pago(e.cargoId, "20"));
    expect(await codigo(registrarPago(e.ctxA, pago(e.cargoId, "4.01")))).toBe("PAGO_EXCEDE_SALDO");
    expect((await obtenerCargo(e.ctxA, e.cargoId))!.saldo).toBe("4.00");
  });

  it("dos pagos simultáneos que juntos exceden el saldo: solo uno entra y el saldo no queda negativo", async () => {
    const e = await conCargo("24.00");
    const r = await Promise.allSettled([registrarPago(e.ctxA, pago(e.cargoId, "15")), registrarPago(e.ctxA, pago(e.cargoId, "15"))]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await obtenerCargo(e.ctxA, e.cargoId))!.saldo).toBe("9.00");
  });

  it("el consecutivo de comprobantes no tiene saltos ni repeticiones con pagos simultáneos", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearConcepto(e.ctxA, { nombre: "Cuota", tipo: "cuota", montoDefecto: "10.00" });
    await emitirCargos(e.ctxA, emision(id));
    const cargos = (await listarCargos(e.ctxA)).items;
    const r = await Promise.all(cargos.map((c) => registrarPago(e.ctxA, pago(c.id, "10"))));
    expect(r.map((x) => x.numero).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    // un pago rechazado no consume número
    expect(await codigo(registrarPago(e.ctxA, pago(cargos[0]!.id, "1")))).toBe("PAGO_EXCEDE_SALDO");
    const nuevo = await crearConcepto(e.ctxA, { nombre: "Otra", tipo: "cuota", montoDefecto: "3.00" });
    await emitirCargos(e.ctxA, emision(nuevo.id, { alcance: "socio", socioId: e.s1 }));
    const ultimo = (await listarCargos(e.ctxA, { conceptoId: nuevo.id })).items[0]!;
    expect((await registrarPago(e.ctxA, pago(ultimo.id, "3"))).numero).toBe(4);
  });

  it("cada junta lleva su propio consecutivo", async () => {
    const e = await escenarioFinanzas();
    const cA = await crearConcepto(e.ctxA, { nombre: "Cuota", tipo: "cuota", montoDefecto: "5.00" });
    const cB = await crearConcepto(e.ctxB, { nombre: "Cuota", tipo: "cuota", montoDefecto: "5.00" });
    await emitirCargos(e.ctxA, emision(cA.id, { alcance: "socio", socioId: e.s1 }));
    await emitirCargos(e.ctxB, emision(cB.id, { alcance: "socio", socioId: e.sb }));
    const pa = await registrarPago(e.ctxA, pago((await listarCargos(e.ctxA)).items[0]!.id, "5"));
    const pb = await registrarPago(e.ctxB, pago((await listarCargos(e.ctxB)).items[0]!.id, "5"));
    expect([pa.numero, pb.numero]).toEqual([1, 1]);
  });

  it("anular un pago restituye el saldo, conserva el número y no se puede anular dos veces", async () => {
    const e = await conCargo("24.00");
    const p = await registrarPago(e.ctxA, pago(e.cargoId, "24"));
    expect((await obtenerCargo(e.ctxA, e.cargoId))!.estado).toBe("pagado");
    await anularPago(e.ctxA, p.id, "Monto mal registrado");
    const c = await obtenerCargo(e.ctxA, e.cargoId);
    expect(c).toMatchObject({ estado: "pendiente", saldo: "24.00" });
    expect(c!.pagos[0]).toMatchObject({ numero: 1, anulado: true, motivoAnulacion: "Monto mal registrado" });
    expect(await codigo(anularPago(e.ctxA, p.id, "otra vez"))).toBe("PAGO_ANULADO");
    const comp = await comprobanteDe(e.ctxA, p.id);
    expect(comp).toMatchObject({ numero: 1, anulado: true, socioNombres: "Ana Torres", junta: "Junta A" });
    // el siguiente pago toma el número 2 (el 1 queda anulado, nunca se reutiliza)
    expect((await registrarPago(e.ctxA, pago(e.cargoId, "24"))).numero).toBe(2);
  });

  it("anula un cargo solo si no tiene pagos vigentes y no admite pagos después", async () => {
    const e = await conCargo("24.00");
    const p = await registrarPago(e.ctxA, pago(e.cargoId, "5"));
    expect(await codigo(anularCargo(e.ctxA, e.cargoId, "Emitido por error"))).toBe("CARGO_CON_PAGOS");
    await anularPago(e.ctxA, p.id, "Devuelto");
    await anularCargo(e.ctxA, e.cargoId, "Emitido por error");
    expect((await obtenerCargo(e.ctxA, e.cargoId))).toMatchObject({ estado: "anulado", motivoAnulacion: "Emitido por error" });
    expect(await codigo(registrarPago(e.ctxA, pago(e.cargoId, "1")))).toBe("CARGO_ANULADO");
    expect(await codigo(anularCargo(e.ctxA, e.cargoId, "otra vez"))).toBe("CARGO_ANULADO");
    // al anular el cargo se puede volver a emitir el mismo (socio, año, concepto)
    expect((await emitirCargos(e.ctxA, emision(e.conceptoId, { alcance: "socio", socioId: e.s1 }))).emitidos).toBe(1);
  });

  it("filtra por estado, vencido y búsqueda, y suma el saldo del filtro", async () => {
    const e = await escenarioFinanzas();
    const { id } = await crearConcepto(e.ctxA, { nombre: "Cuota", tipo: "cuota", montoDefecto: "10.00" });
    await emitirCargos(e.ctxA, emision(id, { vence: "2020-01-01" }));
    const todos = (await listarCargos(e.ctxA)).items;
    await registrarPago(e.ctxA, pago(todos[0]!.id, "10"));
    expect((await listarCargos(e.ctxA, { estado: "pagado" })).total).toBe(1);
    const pend = await listarCargos(e.ctxA, { abiertos: true });
    expect(pend).toMatchObject({ total: 2, totalSaldo: "20.00" });
    expect((await listarCargos(e.ctxA, { vencido: true })).total).toBe(2);
    expect((await listarCargos(e.ctxA, { busqueda: "Mora" })).items.map((i) => i.socioNombres)).toEqual(["Luis Mora"]);
    expect((await listarCargos(e.ctxA, { busqueda: "0102030405" })).total).toBe(1);
  });

  it("la base de datos impide modificar o borrar pagos aun con acceso directo", async () => {
    const e = await conCargo("24.00");
    const p = await registrarPago(e.ctxA, pago(e.cargoId, "10"));
    const sql = adminSql();
    await expect(sql`UPDATE pago SET monto = 1 WHERE id = ${p.id}`).rejects.toThrow(/solo puede anularse/);
    await expect(sql`UPDATE cargo SET monto = 99 WHERE id = ${e.cargoId}`).rejects.toThrow(/solo puede anularse/);
    // la prohibición de borrado rige con contexto de aplicación
    await expect(
      sql.begin(async (tx) => {
        await tx`SELECT set_config('app.role', 'tenant', true)`;
        await tx`DELETE FROM pago WHERE id = ${p.id}`;
      }),
    ).rejects.toThrow(/no se eliminan/);
  });
});

describe("aislamiento entre juntas", () => {
  it("la junta B no ve ni paga cargos de la junta A", async () => {
    const e = await conCargo("24.00");
    expect(await obtenerCargo(e.ctxB, e.cargoId)).toBeNull();
    expect((await listarCargos(e.ctxB)).total).toBe(0);
    expect(await codigo(registrarPago(e.ctxB, pago(e.cargoId, "5")))).toBe("CARGO_NO_ENCONTRADO");
    expect(await codigo(anularCargo(e.ctxB, e.cargoId, "intento"))).toBe("CARGO_NO_ENCONTRADO");
    const p = await registrarPago(e.ctxA, pago(e.cargoId, "5"));
    expect(await comprobanteDe(e.ctxB, p.id)).toBeNull();
    expect(await codigo(anularPago(e.ctxB, p.id, "intento"))).toBe("PAGO_NO_ENCONTRADO");
  });
});
