import { describe, expect, it } from "vitest";
import { anularEvento } from "@/server/services/evento-service";
import { listarCargos } from "@/server/services/cargo-service";
import { generarMultas, listarEventosParaMultas } from "@/server/services/multa-service";
import { registrarPago } from "@/server/services/pago-service";
import { adminSql } from "./setup";
import { crearEventoDirecto } from "./helpers";
import { codigo, configurarMultas, escenarioFinanzas, eventoConAsistencia } from "./helpers-finanzas";

async function conAsamblea() {
  const e = await escenarioFinanzas();
  await configurarMultas(e.a, 5, 8);
  const eventoId = await eventoConAsistencia({
    tenantId: e.a,
    creadoPor: e.tesA,
    asistencias: [
      { socioId: e.s1, estado: "presente" },
      { socioId: e.s2, estado: "ausente" },
      { socioId: e.s3, estado: "justificado" },
    ],
  });
  return { ...e, eventoId };
}

describe("multas por inasistencia (RF-15)", () => {
  it("solo los ausentes injustificados reciben multa, con el monto configurado", async () => {
    const e = await conAsamblea();
    expect(await generarMultas(e.ctxA, e.eventoId)).toEqual({ generadas: 1, existentes: 0, monto: "5.00" });
    const { items } = await listarCargos(e.ctxA);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ socioNombres: "Luis Mora", monto: "5.00", saldo: "5.00", concepto: "Multa por inasistencia a asamblea", anio: 2026 });
  });

  it("repetir la generación no duplica", async () => {
    const e = await conAsamblea();
    await generarMultas(e.ctxA, e.eventoId);
    expect(await generarMultas(e.ctxA, e.eventoId)).toMatchObject({ generadas: 0, existentes: 1 });
    expect((await listarCargos(e.ctxA)).total).toBe(1);
  });

  it("usa la multa de minga para las mingas", async () => {
    const e = await escenarioFinanzas();
    await configurarMultas(e.a, 5, 8);
    const id = await eventoConAsistencia({ tenantId: e.a, creadoPor: e.tesA, tipo: "minga", asistencias: [{ socioId: e.s1, estado: "ausente" }] });
    expect(await generarMultas(e.ctxA, id)).toMatchObject({ generadas: 1, monto: "8.00" });
  });

  it("rechaza sin multa configurada, sin asistencia, anulado o futuro", async () => {
    const e = await escenarioFinanzas();
    const ev = await eventoConAsistencia({ tenantId: e.a, creadoPor: e.tesA, asistencias: [{ socioId: e.s1, estado: "ausente" }] });
    expect(await codigo(generarMultas(e.ctxA, ev))).toBe("MULTA_NO_CONFIGURADA");
    await configurarMultas(e.a, 5, 5);
    const sinAsistencia = await crearEventoDirecto({ tenantId: e.a, creadoPor: e.tesA });
    expect(await codigo(generarMultas(e.ctxA, sinAsistencia))).toBe("EVENTO_SIN_ASISTENCIA");
    const futuro = await crearEventoDirecto({ tenantId: e.a, creadoPor: e.tesA, fecha: "2999-01-01" });
    expect(await codigo(generarMultas(e.ctxA, futuro))).toBe("EVENTO_FUTURO");
    const anulado = await crearEventoDirecto({ tenantId: e.a, creadoPor: e.tesA, estado: "anulado" });
    expect(await codigo(generarMultas(e.ctxA, anulado))).toBe("EVENTO_ANULADO");
    expect(await codigo(generarMultas(e.ctxB, ev))).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("lista los eventos con ausentes y multas ya generadas", async () => {
    const e = await conAsamblea();
    expect(await listarEventosParaMultas(e.ctxA)).toMatchObject([{ id: e.eventoId, ausentes: 1, multasGeneradas: 0, monto: "5.00" }]);
    await generarMultas(e.ctxA, e.eventoId);
    expect((await listarEventosParaMultas(e.ctxA))[0]).toMatchObject({ multasGeneradas: 1 });
    expect(await listarEventosParaMultas(e.ctxB)).toEqual([]);
  });

  it("al anular el evento se anulan las multas sin pagos y se conservan las que ya tienen pagos", async () => {
    const e = await escenarioFinanzas();
    await configurarMultas(e.a, 5, 5);
    const ev = await eventoConAsistencia({
      tenantId: e.a,
      creadoPor: e.tesA,
      asistencias: [
        { socioId: e.s1, estado: "ausente" },
        { socioId: e.s2, estado: "ausente" },
      ],
    });
    await generarMultas(e.ctxA, ev);
    const conPago = (await listarCargos(e.ctxA, { busqueda: "Ana" })).items[0]!;
    await registrarPago(e.ctxA, { cargoId: conPago.id, monto: "2.00", fecha: "2026-03-11", forma: "efectivo" });
    await anularEvento(e.ctxA, ev, "Convocatoria equivocada");
    const estados = Object.fromEntries((await listarCargos(e.ctxA)).items.map((c) => [c.socioNombres, c.estado]));
    expect(estados).toEqual({ "Ana Torres": "parcial", "Luis Mora": "anulado" });
    const filas = await adminSql()`SELECT count(*)::int AS n FROM audit_log WHERE accion = 'multa.anular_por_evento'`;
    expect(filas[0]!.n).toBe(1);
  });
});
