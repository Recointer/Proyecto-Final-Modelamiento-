import { describe, expect, it } from "vitest";
import { guardarAsistencia } from "@/server/services/asistencia-service";
import { anularEvento } from "@/server/services/evento-service";
import { obtenerMiHistorial, obtenerMiInformacion } from "@/server/services/mi-informacion-service";
import { adminSql } from "./setup";
import {
  crearEventoDirecto,
  crearJuntaDirecta,
  crearPredioDirecto,
  crearSectorDirecto,
  crearSocioDirecto,
  crearUsuarioDirecto,
} from "./helpers";

async function escenario() {
  const a = await crearJuntaDirecta("junta-a", "Junta A");
  const b = await crearJuntaDirecta("junta-b", "Junta B");
  const norte = await crearSectorDirecto(a, "Norte");
  const sur = await crearSectorDirecto(a, "Sur");
  const secB = await crearSectorDirecto(b, "Norte");
  const secretario = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "secretario" });
  const secretarioB = await crearUsuarioDirecto({ tenantId: b, cedula: "1710034065", rol: "secretario" });
  const ana = await crearSocioDirecto({ tenantId: a, sectorId: norte, cedula: "1710000017", nombres: "Ana Torres", fechaIngreso: "2026-02-01" });
  const beto = await crearSocioDirecto({ tenantId: a, sectorId: sur, cedula: "1710000025", nombres: "Beto Pérez" });
  const anaB = await crearSocioDirecto({ tenantId: b, sectorId: secB, cedula: "1710000017", nombres: "Otra Ana de B" });
  // la cuenta de Ana y la de Beto: se vinculan por la cédula
  await crearUsuarioDirecto({ tenantId: a, cedula: "1710000017", rol: "socio" });
  const ctxSec = { role: "tenant" as const, tenantId: a, userId: secretario };
  const ctxSecB = { role: "tenant" as const, tenantId: b, userId: secretarioB };
  const ctxAna = { role: "tenant" as const, tenantId: a, userId: secretario };
  return { a, b, norte, sur, ctxSec, ctxSecB, ctxAna, ana, beto, anaB, secretario, secretarioB };
}

const ANA = { cedula: "1710000017" };
const BETO = { cedula: "1710000025" };

describe("mi información (RF-14)", () => {
  it("devuelve ficha, sector y solo los predios del propio socio", async () => {
    const { a, norte, sur, ctxAna, ana, beto } = await escenario();
    await crearPredioDirecto({ tenantId: a, sectorId: norte, socioId: ana, codigo: "P-001" });
    await crearPredioDirecto({ tenantId: a, sectorId: norte, socioId: ana, codigo: "P-002" });
    await crearPredioDirecto({ tenantId: a, sectorId: sur, socioId: beto, codigo: "S-001" });

    const info = await obtenerMiInformacion(ctxAna, ANA);
    expect(info?.ficha).toMatchObject({ nombres: "Ana Torres", cedula: ANA.cedula, sectorNombre: "Norte", fechaIngreso: "2026-02-01", estado: "activo" });
    expect(info?.predios.map((p) => p.codigo)).toEqual(["P-001", "P-002"]);
    expect(info?.totalPredios).toBe(2);

    const deBeto = await obtenerMiInformacion(ctxAna, BETO);
    expect(deBeto?.predios.map((p) => p.codigo)).toEqual(["S-001"]);
  });

  it("una cédula que no está en el padrón no obtiene datos (NO_EN_PADRON)", async () => {
    const { ctxAna } = await escenario();
    expect(await obtenerMiInformacion(ctxAna, { cedula: "1710000090" })).toBeNull();
    expect(await obtenerMiHistorial(ctxAna, { cedula: "1710000090" })).toBeNull();
  });

  it("la cédula se busca solo dentro de la junta del contexto", async () => {
    const { ctxSecB, ana } = await escenario();
    // en la junta B la misma cédula pertenece a otro socio: nunca se ve el de la junta A
    const info = await obtenerMiInformacion(ctxSecB, ANA);
    expect(info?.ficha.nombres).toBe("Otra Ana de B");
    expect(info?.ficha.id).not.toBe(ana);
    expect(info?.predios).toEqual([]);
  });
});

describe("mi historial de asistencia (RF-15)", () => {
  it("incluye solo eventos no anulados, con asistencia registrada y desde el ingreso", async () => {
    const { a, ctxSec, ctxAna, ana, beto, secretario } = await escenario();
    const antes = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-01-15", titulo: "Antes de ingresar" });
    const e1 = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-03-10", titulo: "Asamblea marzo" });
    const e2 = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-04-05", tipo: "minga", titulo: "Minga abril" });
    const e3 = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-05-05", titulo: "Asamblea mayo" });
    await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-06-05", titulo: "Sin asistencia aún" });

    // la app no deja registrar a un socio antes de su ingreso: se simula un dato anterior directamente en la BD
    const sql = adminSql();
    await sql`INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, registrado_por, modificado_por)
              VALUES (${a}, ${antes}, ${ana}, 'ausente', ${secretario}, ${secretario})`;
    await sql`UPDATE evento SET asistencia_registrada_en = now() WHERE id = ${antes}`;
    await guardarAsistencia(ctxSec, e1, [{ socioId: ana, estado: "presente" }, { socioId: beto, estado: "ausente" }]);
    await guardarAsistencia(ctxSec, e2, [{ socioId: ana, estado: "ausente" }, { socioId: beto, estado: "presente" }]);
    await guardarAsistencia(ctxSec, e3, [{ socioId: ana, estado: "justificado", motivo: "Viaje" }, { socioId: beto, estado: "presente" }]);
    await anularEvento(ctxSec, e3, "Se suspendió por lluvia");

    const h = await obtenerMiHistorial(ctxAna, ANA);
    expect(h?.items.map((i) => [i.titulo, i.estado])).toEqual([
      ["Minga abril", "ausente"],
      ["Asamblea marzo", "presente"],
    ]);
    expect(h?.cumplimiento).toMatchObject({ presentes: 1, ausentes: 1, justificados: 0, porcentaje: 50 });
  });

  it("filtra por tipo de evento y recalcula el porcentaje con lo filtrado", async () => {
    const { a, ctxSec, ctxAna, ana, secretario } = await escenario();
    const e1 = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-03-10", titulo: "Asamblea" });
    const e2 = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-04-05", tipo: "minga", titulo: "Minga" });
    await guardarAsistencia(ctxSec, e1, [{ socioId: ana, estado: "presente" }]);
    await guardarAsistencia(ctxSec, e2, [{ socioId: ana, estado: "ausente" }]);

    expect((await obtenerMiHistorial(ctxAna, ANA, { tipo: "asamblea" }))?.cumplimiento.porcentaje).toBe(100);
    expect((await obtenerMiHistorial(ctxAna, ANA, { tipo: "minga" }))?.cumplimiento.porcentaje).toBe(0);
    expect((await obtenerMiHistorial(ctxAna, ANA))?.cumplimiento.porcentaje).toBe(50);
  });

  it("sin eventos computables el cumplimiento «no aplica»", async () => {
    const { a, ctxSec, ctxAna, ana, secretario } = await escenario();
    expect((await obtenerMiHistorial(ctxAna, ANA))?.cumplimiento.porcentaje).toBeNull();
    const e = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-03-10" });
    await guardarAsistencia(ctxSec, e, [{ socioId: ana, estado: "justificado", motivo: "Enfermedad" }]);
    const h = await obtenerMiHistorial(ctxAna, ANA);
    expect(h?.items).toHaveLength(1);
    expect(h?.cumplimiento).toMatchObject({ justificados: 1, porcentaje: null, cumpleMeta: null });
  });

  it("un socio nunca obtiene el historial de otro", async () => {
    const { a, ctxSec, ctxAna, ana, beto, secretario } = await escenario();
    const e = await crearEventoDirecto({ tenantId: a, creadoPor: secretario, fecha: "2026-03-10", titulo: "Asamblea" });
    await guardarAsistencia(ctxSec, e, [{ socioId: ana, estado: "presente" }, { socioId: beto, estado: "ausente" }]);
    expect((await obtenerMiHistorial(ctxAna, ANA))?.items.map((i) => i.estado)).toEqual(["presente"]);
    expect((await obtenerMiHistorial(ctxAna, BETO))?.items.map((i) => i.estado)).toEqual(["ausente"]);
  });
});
