import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generarCsv } from "@/lib/csv";
import { generarComprobantePdf } from "@/server/reportes/comprobante-pdf";
import { generarReportePdf } from "@/server/reportes/tabla-pdf";
import { emitirCargos, listarCargos } from "@/server/services/cargo-service";
import { crearConcepto } from "@/server/services/concepto-service";
import { anularEgreso, listarEgresos, obtenerRespaldo, registrarEgreso } from "@/server/services/egreso-service";
import { obtenerMiEstadoCuenta } from "@/server/services/estado-cuenta-service";
import { anularPago, comprobanteDe, registrarPago } from "@/server/services/pago-service";
import { obtenerPanel } from "@/server/services/panel-service";
import { filasCsv, generarReporte } from "@/server/services/reporte-service";
import { resumenFinanciero } from "@/server/services/resumen-service";
import { adminSql } from "./setup";
import { crearUsuarioDirecto } from "./helpers";
import { codigo, configurarMultas, escenarioFinanzas, eventoConAsistencia } from "./helpers-finanzas";
import { generarMultas } from "@/server/services/multa-service";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const egreso = (extra: Record<string, string> = {}) => ({
  fecha: "2026-02-10",
  categoria: "compras" as const,
  descripcion: "Compra de tubería",
  beneficiario: "Ferretería Central",
  monto: "40.00",
  ...extra,
});

describe("egresos (RF-16)", () => {
  it("registra con respaldo, filtra, suma lo vigente y anula con motivo sin borrar", async () => {
    const e = await escenarioFinanzas();
    const a = await registrarEgreso(e.ctxA, egreso(), PDF);
    await registrarEgreso(e.ctxA, egreso({ categoria: "tasas", descripcion: "Tasa de agua", beneficiario: "Empresa de Agua", monto: "10.50", fecha: "2026-03-01" }), null);
    expect((await obtenerRespaldo(e.ctxA, a.id))!.mime).toBe("application/pdf");

    let l = await listarEgresos(e.ctxA);
    expect(l).toMatchObject({ total: 2, totalVigente: "50.50" });
    expect((await listarEgresos(e.ctxA, { categoria: "tasas" })).totalVigente).toBe("10.50");
    expect((await listarEgresos(e.ctxA, { desde: "2026-02-15" })).total).toBe(1);
    expect((await listarEgresos(e.ctxA, { busqueda: "ferret" })).total).toBe(1);

    await anularEgreso(e.ctxA, a.id, "Registrado dos veces");
    l = await listarEgresos(e.ctxA);
    expect(l).toMatchObject({ total: 2, totalVigente: "10.50" });
    expect(l.items.find((i) => i.id === a.id)).toMatchObject({ anulado: true, motivoAnulacion: "Registrado dos veces" });
    expect(await codigo(anularEgreso(e.ctxA, a.id, "otra vez"))).toBe("EGRESO_ANULADO");
    await expect(adminSql()`UPDATE egreso SET monto = 1 WHERE id = ${a.id}`).rejects.toThrow(/solo puede anularse/);
  });

  it("rechaza respaldos de tipo no permitido y los de otra junta no se leen", async () => {
    const e = await escenarioFinanzas();
    expect(await codigo(registrarEgreso(e.ctxA, egreso(), new Uint8Array([1, 2, 3, 4])))).toBe("RESPALDO_INVALIDO");
    expect((await listarEgresos(e.ctxA)).total).toBe(0);
    const a = await registrarEgreso(e.ctxA, egreso(), PNG);
    expect(await obtenerRespaldo(e.ctxB, a.id)).toBeNull();
    expect((await listarEgresos(e.ctxB)).total).toBe(0);
    expect(await codigo(anularEgreso(e.ctxB, a.id, "intento ajeno"))).toBe("EGRESO_NO_ENCONTRADO");
  });
});

async function conMovimientos() {
  const e = await escenarioFinanzas();
  const c = await crearConcepto(e.ctxA, { nombre: "Cuota anual", tipo: "cuota", montoDefecto: "24.00" });
  await emitirCargos(e.ctxA, { conceptoId: c.id, anio: 2026, alcance: "todos", vence: "2020-01-01" });
  const cargos = (await listarCargos(e.ctxA)).items;
  const ana = cargos.find((x) => x.socioNombres === "Ana Torres")!;
  const luis = cargos.find((x) => x.socioNombres === "Luis Mora")!;
  const pagoAna = await registrarPago(e.ctxA, { cargoId: ana.id, monto: "24", fecha: "2026-02-01", forma: "efectivo" });
  const pagoLuis = await registrarPago(e.ctxA, { cargoId: luis.id, monto: "10.05", fecha: "2026-03-05", forma: "transferencia", referencia: "TR-9" });
  await registrarEgreso(e.ctxA, egreso({ monto: "30.00" }), null);
  await registrarEgreso(e.ctxA, egreso({ categoria: "honorarios", descripcion: "Honorarios técnico", monto: "20.25", fecha: "2026-03-15" }), null);
  return { ...e, ana, luis, pagoAna, pagoLuis };
}

describe("resumen y reportes (RF-24)", () => {
  it("los totales cuadran al centavo y los movimientos anulados no suman", async () => {
    const e = await conMovimientos();
    let r = await resumenFinanciero(e.ctxA, { anio: 2026 });
    expect(r).toMatchObject({ ingresos: "34.05", egresos: "50.25", caja: "-16.20", porCobrar: "37.95", porCobrarVencido: "37.95", pagos: 2 });
    expect(r.egresosPorCategoria).toEqual([
      { categoria: "compras", total: "30.00" },
      { categoria: "honorarios", total: "20.25" },
    ]);
    await anularPago(e.ctxA, e.pagoLuis.id, "Error de captura");
    r = await resumenFinanciero(e.ctxA, { anio: 2026 });
    expect(r).toMatchObject({ ingresos: "24.00", pagos: 1, porCobrar: "48.00" });
    // rango de fechas: solo febrero
    expect(await resumenFinanciero(e.ctxA, { desde: "2026-02-01", hasta: "2026-02-28" })).toMatchObject({ ingresos: "24.00", egresos: "30.00", caja: "-6.00" });
    // otra junta no ve nada
    expect(await resumenFinanciero(e.ctxB, { anio: 2026 })).toMatchObject({ ingresos: "0.00", egresos: "0.00", caja: "0.00", porCobrar: "0.00" });
  });

  it("los reportes traen los mismos totales que el detalle y exportan CSV y PDF válidos", async () => {
    const e = await conMovimientos();
    const ing = await generarReporte(e.ctxA, "ingresos", { anio: 2026 });
    expect(ing.filas).toHaveLength(2);
    expect(ing.totales[0]).toEqual({ etiqueta: "Total ingresos", valor: "34.05" });
    const egr = await generarReporte(e.ctxA, "egresos", { anio: 2026 });
    expect(egr.totales[0]!.valor).toBe("50.25");
    const pc = await generarReporte(e.ctxA, "por-cobrar", { anio: 2026 });
    expect(pc.filas).toHaveLength(2); // Luis (parcial) y Eva (pendiente)
    expect(pc.totales).toEqual([
      { etiqueta: "Total por cobrar", valor: "37.95" },
      { etiqueta: "De ello, vencido", valor: "37.95" },
    ]);
    const caja = await generarReporte(e.ctxA, "caja", { anio: 2026 });
    expect(caja.totales[0]).toEqual({ etiqueta: "Saldo de caja", valor: "-16.20" });

    const csv = generarCsv(filasCsv(ing));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Libro de ingresos");
    expect(csv).toContain("Total ingresos");
    expect(csv).toContain("34.05");
    for (const rep of [ing, egr, pc, caja]) {
      const bytes = await generarReportePdf({ junta: "Junta A", emitidoEn: "2026-06-01", reporte: rep });
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
    }
  });

  it("un reporte sin movimientos genera un PDF con estado vacío", async () => {
    const e = await escenarioFinanzas();
    const rep = await generarReporte(e.ctxA, "ingresos", { anio: 2026 });
    expect(rep.filas).toEqual([]);
    expect(rep.totales[0]!.valor).toBe("0.00");
    expect((await generarReportePdf({ junta: "Junta A", emitidoEn: "2026-06-01", reporte: rep })).byteLength).toBeGreaterThan(500);
  });

  it("el comprobante se genera en PDF con los datos del pago", async () => {
    const e = await conMovimientos();
    const datos = await comprobanteDe(e.ctxA, e.pagoAna.id);
    expect(datos).toMatchObject({ numero: 1, socioNombres: "Ana Torres", monto: "24.00", junta: "Junta A" });
    expect((await PDFDocument.load(await generarComprobantePdf(datos!))).getPageCount()).toBe(1);
  });
});

describe("estado de cuenta del Socio", () => {
  it("muestra solo lo propio, con saldo, vencidos y comprobantes; nunca lo de otro socio", async () => {
    const e = await conMovimientos();
    await configurarMultas(e.a, 5, 5);
    const ev = await eventoConAsistencia({ tenantId: e.a, creadoPor: e.tesA, asistencias: [{ socioId: e.s2, estado: "ausente" }] });
    await generarMultas(e.ctxA, ev);

    const luis = await obtenerMiEstadoCuenta(e.ctxA, { cedula: "1713175071" });
    expect(luis!.socio.nombres).toBe("Luis Mora");
    expect(luis!.cargos.map((c) => [c.concepto, c.estado, c.saldo])).toEqual([
      ["Cuota anual", "parcial", "13.95"],
      ["Multa por inasistencia a asamblea", "pendiente", "5.00"],
    ]);
    expect(luis!.totalPendiente).toBe("18.95");
    expect(luis!.totalVencido).toBe("13.95");
    expect(luis!.cargos[0]!.pagos).toMatchObject([{ id: e.pagoLuis.id, numero: 2, monto: "10.05" }]);
    expect(luis!.cargos.flatMap((c) => c.pagos).some((p) => p.id === e.pagoAna.id)).toBe(false);

    const filtrado = await obtenerMiEstadoCuenta(e.ctxA, { cedula: "1713175071" }, { anio: 2025 });
    expect(filtrado!.cargos).toEqual([]);
    expect(filtrado!.anios).toEqual([2026]);
  });

  it("devuelve null si la cédula no está en el padrón y no ve cargos de otra junta con la misma cédula", async () => {
    const e = await conMovimientos();
    expect(await obtenerMiEstadoCuenta(e.ctxA, { cedula: "0999999999" })).toBeNull();
    // la misma cédula existe en la junta B (socio de B): su estado de cuenta está vacío
    const b = await obtenerMiEstadoCuenta(e.ctxB, { cedula: "1710034065" });
    expect(b!.cargos).toEqual([]);
  });

  it("un pago de otro socio no se obtiene como comprobante propio", async () => {
    const e = await conMovimientos();
    expect(await comprobanteDe(e.ctxA, e.pagoAna.id, e.s2)).toBeNull();
    expect(await comprobanteDe(e.ctxA, e.pagoAna.id, e.s1)).not.toBeNull();
  });
});

describe("panel del Super Administrador", () => {
  it("recibe solo la cifra de pagos vigentes, sin montos ni datos de las juntas", async () => {
    const e = await conMovimientos();
    const sa = await crearUsuarioDirecto({ tenantId: null, cedula: "1710034065", rol: "super_admin" });
    const ctx = { role: "super_admin" as const, userId: sa };
    expect((await obtenerPanel(ctx)).totalPagos).toBe(2);
    await anularPago(e.ctxA, e.pagoAna.id, "Error");
    expect((await obtenerPanel(ctx)).totalPagos).toBe(1);
    // el super_admin no puede leer filas financieras
    const { withTenant } = await import("@/server/db/context");
    const { pago } = await import("@/server/db/schema");
    expect(await withTenant(ctx, (tx) => tx.select().from(pago))).toEqual([]);
  });
});
