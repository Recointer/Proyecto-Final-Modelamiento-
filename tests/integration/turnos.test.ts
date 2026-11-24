import { describe, expect, it } from "vitest";
import {
  crearServicio,
  crearTurno,
  desactivarServicio,
  editarServicio,
  editarTurno,
  eliminarTurno,
  listarServicios,
  obtenerServicio,
  reactivarServicio,
} from "@/server/services/servicio-service";
import { obtenerCalendarioSemanal } from "@/server/services/calendario-service";
import { eliminarSector } from "@/server/services/configuracion-service";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearSectorDirecto, crearUsuarioDirecto } from "./helpers";

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "SIN_ERROR";
}

async function escenario() {
  const a = await crearJuntaDirecta("junta-a", "Junta A");
  const b = await crearJuntaDirecta("junta-b", "Junta B");
  const norte = await crearSectorDirecto(a, "Norte");
  const sur = await crearSectorDirecto(a, "Sur");
  const secB = await crearSectorDirecto(b, "Norte");
  const uA = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "secretario" });
  const uB = await crearUsuarioDirecto({ tenantId: b, cedula: "1710034065", rol: "secretario" });
  return {
    a,
    b,
    norte,
    sur,
    secB,
    ctxA: { role: "tenant" as const, tenantId: a, userId: uA },
    ctxB: { role: "tenant" as const, tenantId: b, userId: uB },
  };
}

const turno = (servicioId: string, sectorId: string, extra: Record<string, unknown> = {}) => ({
  servicioId,
  sectorId,
  diaSemana: 2,
  horaInicio: "20:00",
  horaFin: "22:00",
  ...extra,
});

describe("servicios (RF-12)", () => {
  it("crea, edita y lista servicios con auditoría", async () => {
    const { ctxA } = await escenario();
    const { id } = await crearServicio(ctxA, { nombre: "  Riego principal ", tipo: "agua_riego" });
    await crearServicio(ctxA, { nombre: "Salón comunal", tipo: "espacio_comunal" });
    expect((await listarServicios(ctxA)).map((s) => s.nombre)).toEqual(["Riego principal", "Salón comunal"]);

    await editarServicio(ctxA, id, { nombre: "Riego canal norte", tipo: "agua_riego" });
    expect((await obtenerServicio(ctxA, id))?.nombre).toBe("Riego canal norte");
    const acciones = (await adminSql()`SELECT accion FROM audit_log ORDER BY creado_en`).map((r) => r.accion);
    expect(acciones).toEqual(expect.arrayContaining(["servicio.crear", "servicio.editar"]));
  });

  it("rechaza nombres repetidos en la junta (sin distinguir mayúsculas) pero no en otra", async () => {
    const { ctxA, ctxB } = await escenario();
    await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    expect(await codigo(crearServicio(ctxA, { nombre: "RIEGO", tipo: "otro" }))).toBe("SERVICIO_DUPLICADO");
    const otro = await crearServicio(ctxA, { nombre: "Maquinaria", tipo: "maquinaria" });
    expect(await codigo(editarServicio(ctxA, otro.id, { nombre: "riego", tipo: "maquinaria" }))).toBe("SERVICIO_DUPLICADO");
    await expect(crearServicio(ctxB, { nombre: "Riego", tipo: "agua_riego" })).resolves.toBeDefined();
  });

  it("baja y reactivación lógicas", async () => {
    const { ctxA } = await escenario();
    const { id } = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    await desactivarServicio(ctxA, id);
    expect((await listarServicios(ctxA, { estado: "inactivo" })).map((s) => s.id)).toEqual([id]);
    await reactivarServicio(ctxA, id);
    expect((await listarServicios(ctxA, { estado: "activo" })).map((s) => s.id)).toEqual([id]);
    expect(await codigo(desactivarServicio(ctxA, "00000000-0000-4000-8000-000000000000"))).toBe("SERVICIO_NO_ENCONTRADO");
  });
});

describe("turnos y solapamiento", () => {
  it("crea turnos y los devuelve ordenados por día y hora con el nombre del sector", async () => {
    const { ctxA, norte, sur } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    await crearTurno(ctxA, turno(s.id, sur, { diaSemana: 4, horaInicio: "06:00", horaFin: "08:00" }));
    await crearTurno(ctxA, turno(s.id, norte));
    const d = await obtenerServicio(ctxA, s.id);
    expect(d?.turnos).toBe(2);
    expect(d?.turnosDetalle.map((t) => [t.diaSemana, t.sectorNombre, t.horaInicio, t.horaFin])).toEqual([
      [2, "Norte", "20:00", "22:00"],
      [4, "Sur", "06:00", "08:00"],
    ]);
  });

  it("rechaza fin menor o igual al inicio (restricción de la base de datos)", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    expect(await codigo(crearTurno(ctxA, turno(s.id, norte, { horaFin: "20:00" })))).toBe("TURNO_HORARIO_INVALIDO");
    expect(await codigo(crearTurno(ctxA, turno(s.id, norte, { horaFin: "19:00" })))).toBe("TURNO_HORARIO_INVALIDO");
    expect((await obtenerServicio(ctxA, s.id))?.turnos).toBe(0);
  });

  it("rechaza turnos que se solapan para el mismo servicio, sector y día", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    await crearTurno(ctxA, turno(s.id, norte));
    for (const [ini, fin] of [["21:00", "23:00"], ["19:00", "20:30"], ["20:30", "21:30"], ["19:00", "23:00"], ["20:00", "22:00"]]) {
      expect(await codigo(crearTurno(ctxA, turno(s.id, norte, { horaInicio: ini, horaFin: fin }))), `${ini}-${fin}`).toBe("TURNO_SOLAPADO");
    }
    expect((await obtenerServicio(ctxA, s.id))?.turnos).toBe(1);
  });

  it("los turnos contiguos son válidos (rangos semiabiertos)", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    await crearTurno(ctxA, turno(s.id, norte, { horaInicio: "08:00", horaFin: "10:00" }));
    await expect(crearTurno(ctxA, turno(s.id, norte, { horaInicio: "10:00", horaFin: "12:00" }))).resolves.toBeDefined();
    await expect(crearTurno(ctxA, turno(s.id, norte, { horaInicio: "06:00", horaFin: "08:00" }))).resolves.toBeDefined();
  });

  it("el mismo horario es válido en otro día, otro sector u otro servicio", async () => {
    const { ctxA, norte, sur } = await escenario();
    const riego = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    const salon = await crearServicio(ctxA, { nombre: "Salón", tipo: "espacio_comunal" });
    await crearTurno(ctxA, turno(riego.id, norte));
    await expect(crearTurno(ctxA, turno(riego.id, norte, { diaSemana: 3 }))).resolves.toBeDefined();
    await expect(crearTurno(ctxA, turno(riego.id, sur))).resolves.toBeDefined();
    await expect(crearTurno(ctxA, turno(salon.id, norte))).resolves.toBeDefined();
  });

  it("dos guardados simultáneos con el mismo horario: solo uno se guarda", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => crearTurno(ctxA, turno(s.id, norte))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.filter((x) => x.status === "rejected" && (x.reason as AppError).codigo === "TURNO_SOLAPADO")).toHaveLength(4);
    expect((await obtenerServicio(ctxA, s.id))?.turnos).toBe(1);
  });

  it("edita un turno (sin chocar consigo mismo) y rechaza el choque con otro", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    const t1 = await crearTurno(ctxA, turno(s.id, norte, { horaInicio: "08:00", horaFin: "10:00" }));
    await crearTurno(ctxA, turno(s.id, norte, { horaInicio: "12:00", horaFin: "14:00" }));
    await editarTurno(ctxA, t1.id, { sectorId: norte, diaSemana: 2, horaInicio: "08:30", horaFin: "10:30" });
    expect((await obtenerServicio(ctxA, s.id))?.turnosDetalle[0]).toMatchObject({ horaInicio: "08:30", horaFin: "10:30" });
    expect(await codigo(editarTurno(ctxA, t1.id, { sectorId: norte, diaSemana: 2, horaInicio: "11:00", horaFin: "12:30" }))).toBe("TURNO_SOLAPADO");
    expect(await codigo(editarTurno(ctxA, t1.id, { sectorId: norte, diaSemana: 2, horaInicio: "11:00", horaFin: "10:00" }))).toBe("TURNO_HORARIO_INVALIDO");
    expect(await codigo(editarTurno(ctxA, "00000000-0000-4000-8000-000000000000", { sectorId: norte, diaSemana: 2, horaInicio: "01:00", horaFin: "02:00" }))).toBe("TURNO_NO_ENCONTRADO");
  });

  it("elimina turnos con auditoría", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    const t = await crearTurno(ctxA, turno(s.id, norte));
    await eliminarTurno(ctxA, t.id);
    expect((await obtenerServicio(ctxA, s.id))?.turnos).toBe(0);
    expect(await adminSql()`SELECT 1 FROM audit_log WHERE accion = 'turno.eliminar'`).toHaveLength(1);
    expect(await codigo(eliminarTurno(ctxA, t.id))).toBe("TURNO_NO_ENCONTRADO");
  });

  it("rechaza sectores o servicios de otra junta e inexistentes", async () => {
    const { ctxA, ctxB, norte, secB } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    const sB = await crearServicio(ctxB, { nombre: "Riego B", tipo: "agua_riego" });
    expect(await codigo(crearTurno(ctxA, turno(s.id, secB)))).toBe("SECTOR_NO_ENCONTRADO");
    expect(await codigo(crearTurno(ctxA, turno(sB.id, norte)))).toBe("SERVICIO_NO_ENCONTRADO");
    expect(await codigo(crearTurno(ctxA, turno("00000000-0000-4000-8000-000000000000", norte)))).toBe("SERVICIO_NO_ENCONTRADO");
  });

  it("un sector con turnos no se puede eliminar", async () => {
    const { ctxA, norte } = await escenario();
    const s = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    await crearTurno(ctxA, turno(s.id, norte));
    expect(await codigo(eliminarSector(ctxA, norte))).toBe("SECTOR_CON_ASOCIADOS");
  });

  it("una junta no ve ni modifica servicios ni turnos de otra", async () => {
    const { ctxA, ctxB, secB } = await escenario();
    const sB = await crearServicio(ctxB, { nombre: "Riego B", tipo: "agua_riego" });
    const tB = await crearTurno(ctxB, turno(sB.id, secB));
    expect(await obtenerServicio(ctxA, sB.id)).toBeNull();
    expect((await listarServicios(ctxA)).map((s) => s.id)).not.toContain(sB.id);
    expect(await codigo(editarServicio(ctxA, sB.id, { nombre: "Hackeado", tipo: "otro" }))).toBe("SERVICIO_NO_ENCONTRADO");
    expect(await codigo(eliminarTurno(ctxA, tB.id))).toBe("TURNO_NO_ENCONTRADO");
    expect(await adminSql()`SELECT 1 FROM turno WHERE id = ${tB.id}`).toHaveLength(1);
  });
});

describe("calendario semanal por sector", () => {
  it("agrupa los turnos del sector por día, solo de servicios activos, y calcula los próximos", async () => {
    const { ctxA, norte, sur } = await escenario();
    const riego = await crearServicio(ctxA, { nombre: "Riego", tipo: "agua_riego" });
    const salon = await crearServicio(ctxA, { nombre: "Salón", tipo: "espacio_comunal" });
    const inactivo = await crearServicio(ctxA, { nombre: "Antiguo", tipo: "otro" });
    await crearTurno(ctxA, turno(riego.id, norte, { diaSemana: 2, horaInicio: "20:00", horaFin: "22:00" }));
    await crearTurno(ctxA, turno(salon.id, norte, { diaSemana: 2, horaInicio: "08:00", horaFin: "10:00" }));
    await crearTurno(ctxA, turno(riego.id, norte, { diaSemana: 5, horaInicio: "06:00", horaFin: "07:00" }));
    await crearTurno(ctxA, turno(riego.id, sur, { diaSemana: 3, horaInicio: "06:00", horaFin: "07:00" }));
    await crearTurno(ctxA, turno(inactivo.id, norte, { diaSemana: 6, horaInicio: "06:00", horaFin: "07:00" }));
    await desactivarServicio(ctxA, inactivo.id);

    const ahora = new Date("2026-11-23T15:30:00Z"); // lunes 10:30 en Ecuador
    const cal = await obtenerCalendarioSemanal(ctxA, norte, ahora);
    expect(cal.dias.map((d) => d.length)).toEqual([0, 2, 0, 0, 1, 0, 0]);
    expect(cal.dias[1]!.map((t) => `${t.inicio}-${t.fin} ${t.servicio}`)).toEqual(["08:00-10:00 Salón", "20:00-22:00 Riego"]);
    expect(cal.proximos.map((p) => `${p.dia} ${p.inicio}`)).toEqual(["2 08:00", "2 20:00", "5 06:00"]);

    expect((await obtenerCalendarioSemanal(ctxA, sur, ahora)).dias[2]).toHaveLength(1);
  });

  it("un sector sin turnos devuelve una semana vacía; el de otra junta no devuelve nada", async () => {
    const { ctxA, ctxB, sur, secB } = await escenario();
    const vacio = await obtenerCalendarioSemanal(ctxA, sur);
    expect(vacio.dias.every((d) => d.length === 0)).toBe(true);
    expect(vacio.proximos).toEqual([]);
    const sB = await crearServicio(ctxB, { nombre: "Riego B", tipo: "agua_riego" });
    await crearTurno(ctxB, turno(sB.id, secB));
    expect((await obtenerCalendarioSemanal(ctxA, secB)).dias.every((d) => d.length === 0)).toBe(true);
  });
});
