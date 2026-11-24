import { describe, expect, it } from "vitest";
import { guardarAsistencia, listarInasistenciasInjustificadas } from "@/server/services/asistencia-service";
import { generarReportePlataforma, obtenerPanel } from "@/server/services/panel-service";
import { anularEvento } from "@/server/services/evento-service";
import { adminSql } from "./setup";
import {
  crearEventoDirecto,
  crearJuntaDirecta,
  crearSectorDirecto,
  crearSocioDirecto,
  crearUsuarioDirecto,
} from "./helpers";

const sup = { role: "super_admin" as const, userId: "00000000-0000-0000-0000-000000000001" };
const AHORA = new Date("2026-03-20T15:00:00Z");

async function junta(slug: string, cedulaSecretario: string, cedulas: [string, string]) {
  const id = await crearJuntaDirecta(slug, `Junta ${slug}`);
  const sector = await crearSectorDirecto(id, "Norte");
  const secretario = await crearUsuarioDirecto({ tenantId: id, cedula: cedulaSecretario, rol: "secretario" });
  const ana = await crearSocioDirecto({ tenantId: id, sectorId: sector, cedula: cedulas[0], nombres: "Ana Torres" });
  const beto = await crearSocioDirecto({ tenantId: id, sectorId: sector, cedula: cedulas[1], nombres: "Beto Pérez" });
  return { id, secretario, ana, beto, ctx: { role: "tenant" as const, tenantId: id, userId: secretario } };
}

describe("inasistencias injustificadas para Financiero", () => {
  async function datos() {
    const a = await junta("junta-a", "1710034065", ["1710000017", "1710000025"]);
    const b = await junta("junta-b", "1710034065", ["1710000033", "1710000041"]);
    const e1 = await crearEventoDirecto({ tenantId: a.id, creadoPor: a.secretario, fecha: "2026-01-10", titulo: "Asamblea enero" });
    const e2 = await crearEventoDirecto({ tenantId: a.id, creadoPor: a.secretario, fecha: "2026-02-10", tipo: "minga", titulo: "Minga febrero" });
    const e3 = await crearEventoDirecto({ tenantId: a.id, creadoPor: a.secretario, fecha: "2026-03-01", titulo: "Asamblea marzo" });
    await guardarAsistencia(a.ctx, e1, [
      { socioId: a.ana, estado: "ausente" },
      { socioId: a.beto, estado: "presente" },
    ]);
    await guardarAsistencia(a.ctx, e2, [
      { socioId: a.ana, estado: "justificado", motivo: "Enfermedad" },
      { socioId: a.beto, estado: "ausente" },
    ]);
    await guardarAsistencia(a.ctx, e3, [
      { socioId: a.ana, estado: "ausente" },
      { socioId: a.beto, estado: "ausente" },
    ]);
    // la junta B tiene sus propias ausencias
    const eb = await crearEventoDirecto({ tenantId: b.id, creadoPor: b.secretario, fecha: "2026-01-10" });
    await guardarAsistencia(b.ctx, eb, [{ socioId: b.ana, estado: "ausente" }]);
    return { a, b, e1, e2, e3 };
  }

  it("devuelve solo las ausencias (no presentes ni justificadas) con socio, evento y fecha", async () => {
    const { a, e1, e2, e3 } = await datos();
    const r = await listarInasistenciasInjustificadas(a.ctx);
    expect(r.map((x) => `${x.fecha}|${x.nombres}`)).toEqual([
      "2026-01-10|Ana Torres",
      "2026-02-10|Beto Pérez",
      "2026-03-01|Ana Torres",
      "2026-03-01|Beto Pérez",
    ]);
    expect(r[0]).toMatchObject({ socioId: a.ana, cedula: "1710000017", eventoId: e1, tipo: "asamblea", titulo: "Asamblea enero" });
    expect(r.find((x) => x.eventoId === e2)).toMatchObject({ tipo: "minga", nombres: "Beto Pérez" });
    expect(r.some((x) => x.eventoId === e3)).toBe(true);
  });

  it("filtra por rango de fechas y por socio", async () => {
    const { a } = await datos();
    expect((await listarInasistenciasInjustificadas(a.ctx, { desde: "2026-02-01" })).map((x) => x.fecha)).toEqual(["2026-02-10", "2026-03-01", "2026-03-01"]);
    expect((await listarInasistenciasInjustificadas(a.ctx, { hasta: "2026-01-31" })).map((x) => x.fecha)).toEqual(["2026-01-10"]);
    expect((await listarInasistenciasInjustificadas(a.ctx, { socioId: a.ana })).map((x) => x.nombres)).toEqual(["Ana Torres", "Ana Torres"]);
    expect(await listarInasistenciasInjustificadas(a.ctx, { desde: "2030-01-01" })).toEqual([]);
  });

  it("no cuenta las ausencias de eventos anulados", async () => {
    const { a, e3 } = await datos();
    await anularEvento(a.ctx, e3, "Evento suspendido");
    const r = await listarInasistenciasInjustificadas(a.ctx);
    expect(r.every((x) => x.eventoId !== e3)).toBe(true);
    expect(r).toHaveLength(2);
  });

  it("no mezcla datos de otras juntas", async () => {
    const { a, b } = await datos();
    const deA = await listarInasistenciasInjustificadas(a.ctx);
    const deB = await listarInasistenciasInjustificadas(b.ctx);
    expect(deA.every((x) => x.socioId === a.ana || x.socioId === a.beto)).toBe(true);
    expect(deB).toHaveLength(1);
    expect(deB[0]?.socioId).toBe(b.ana);
  });
});

describe("panel de plataforma con eventos reales", () => {
  async function conEventos() {
    const a = await junta("junta-a", "1710034065", ["1710000017", "1710000025"]);
    const b = await junta("junta-b", "1710034065", ["1710000033", "1710000041"]);
    await crearEventoDirecto({ tenantId: a.id, creadoPor: a.secretario, fecha: "2026-03-10", titulo: "Reunión confidencial de A" });
    await crearEventoDirecto({ tenantId: a.id, creadoPor: a.secretario, fecha: "2026-03-10", tipo: "minga" });
    await crearEventoDirecto({ tenantId: b.id, creadoPor: b.secretario, fecha: "2026-03-22" });
    await crearEventoDirecto({ tenantId: b.id, creadoPor: b.secretario, fecha: "2026-03-25", estado: "anulado" });
    await crearEventoDirecto({ tenantId: b.id, creadoPor: b.secretario, fecha: "2026-04-02" });
    return { a, b };
  }

  it("cuenta los eventos activos de todas las juntas y los agrupa por día del mes mostrado", async () => {
    await conEventos();
    const marzo = await obtenerPanel(sup, { ahora: AHORA, mes: { anio: 2026, mes: 3 } });
    expect(marzo.totalEventos).toBe(4); // 2 + 1 + 1 (el anulado no cuenta)
    expect(marzo.eventosDelMes).toEqual([
      { dia: 10, titulo: "2 eventos" },
      { dia: 22, titulo: "1 evento" },
    ]);

    const abril = await obtenerPanel(sup, { ahora: AHORA, mes: { anio: 2026, mes: 4 } });
    expect(abril.eventosDelMes).toEqual([{ dia: 2, titulo: "1 evento" }]);
    expect(abril.totalEventos).toBe(4);
  });

  it("por defecto muestra el mes actual", async () => {
    await conEventos();
    const p = await obtenerPanel(sup, { ahora: AHORA });
    expect(p.eventosDelMes.map((e) => e.dia)).toEqual([10, 22]);
  });

  it("no expone títulos, lugares ni la junta de los eventos", async () => {
    await conEventos();
    const p = await obtenerPanel(sup, { ahora: AHORA, mes: { anio: 2026, mes: 3 } });
    const texto = JSON.stringify(p) + (await generarReportePlataforma(sup, AHORA));
    expect(texto).not.toContain("Reunión confidencial de A");
    expect(texto).not.toContain("Casa comunal");
  });

  it("el reporte CSV incluye el total de eventos", async () => {
    await conEventos();
    const csv = await generarReportePlataforma(sup, AHORA);
    expect(csv).toContain("Total de eventos,4");
  });

  it("anular un evento lo quita del conteo del panel", async () => {
    const { a } = await conEventos();
    const [ev] = await adminSql()`SELECT id FROM evento WHERE tenant_id = ${a.id} AND tipo = 'minga'`;
    await anularEvento(a.ctx, ev!.id, "Anulada para la prueba");
    const p = await obtenerPanel(sup, { ahora: AHORA, mes: { anio: 2026, mes: 3 } });
    expect(p.totalEventos).toBe(3);
    expect(p.eventosDelMes[0]).toEqual({ dia: 10, titulo: "1 evento" });
  });

  it("sin eventos el panel sigue funcionando en cero", async () => {
    const p = await obtenerPanel(sup, { ahora: AHORA });
    expect(p.totalEventos).toBe(0);
    expect(p.eventosDelMes).toEqual([]);
  });
});
