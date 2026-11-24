import { describe, expect, it } from "vitest";
import {
  anularEvento,
  crearEvento,
  editarEvento,
  listarEventos,
  obtenerEvento,
} from "@/server/services/evento-service";
import { guardarAsistencia, obtenerListaAsistencia } from "@/server/services/asistencia-service";
import { filtrosEventoSchema } from "@/server/validation/evento";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import {
  crearEventoDirecto,
  crearJuntaDirecta,
  crearSectorDirecto,
  crearSocioDirecto,
  crearUsuarioDirecto,
} from "./helpers";

const FECHA_PASADA = "2026-03-10";
const FECHA_FUTURA = "2999-01-01";

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
  const secA = await crearSectorDirecto(a, "Norte");
  const secB = await crearSectorDirecto(b, "Norte");
  const secretarioA = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "secretario" });
  const secretarioB = await crearUsuarioDirecto({ tenantId: b, cedula: "1710034065", rol: "secretario" });

  const s1 = await crearSocioDirecto({ tenantId: a, sectorId: secA, cedula: "1710000017", nombres: "Ana Torres" });
  const s2 = await crearSocioDirecto({ tenantId: a, sectorId: secA, cedula: "1710000025", nombres: "Beto Pérez" });
  const s3 = await crearSocioDirecto({ tenantId: a, sectorId: secA, cedula: "1710000033", nombres: "Carla Ríos" });
  const sInactivo = await crearSocioDirecto({ tenantId: a, sectorId: secA, cedula: "1710000041", nombres: "Dario Baja", estado: "inactivo" });
  const sNuevo = await crearSocioDirecto({ tenantId: a, sectorId: secA, cedula: "1710000058", nombres: "Elena Nueva", fechaIngreso: "2026-06-01" });
  const sB = await crearSocioDirecto({ tenantId: b, sectorId: secB, cedula: "1710000066", nombres: "Socio de B" });

  const ctxA = { role: "tenant" as const, tenantId: a, userId: secretarioA };
  const ctxB = { role: "tenant" as const, tenantId: b, userId: secretarioB };
  const evento = await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, fecha: FECHA_PASADA, titulo: "Asamblea Ordinaria" });
  return { a, b, secA, ctxA, ctxB, s1, s2, s3, sInactivo, sNuevo, sB, evento, secretarioA, secretarioB };
}

const f = (o: Record<string, unknown> = {}) => filtrosEventoSchema.parse(o);

describe("eventos (RF-08)", () => {
  it("crea un evento activo con auditoría y lo devuelve sin asistencia registrada", async () => {
    const { a, ctxA } = await escenario();
    const { id } = await crearEvento(ctxA, { tipo: "minga", titulo: "  Limpieza de acequia  ", fecha: "2026-05-01", lugar: " Acequia Norte " });
    const e = await obtenerEvento(ctxA, id);
    expect(e).toMatchObject({ tipo: "minga", titulo: "Limpieza de acequia", lugar: "Acequia Norte", estado: "activo", asistenciaRegistrada: false });
    const [aud] = await adminSql()`SELECT tenant_id, actor_id FROM audit_log WHERE accion = 'evento.crear'`;
    expect(aud).toMatchObject({ tenant_id: a, actor_id: ctxA.userId });
  });

  it("edita un evento activo y audita antes y después", async () => {
    const { ctxA, evento } = await escenario();
    await editarEvento(ctxA, evento, { tipo: "asamblea", titulo: "Asamblea Extraordinaria", fecha: "2026-03-11", lugar: "Plaza" });
    expect(await obtenerEvento(ctxA, evento)).toMatchObject({ titulo: "Asamblea Extraordinaria", fecha: "2026-03-11", lugar: "Plaza" });
    const [aud] = await adminSql()`SELECT antes, despues FROM audit_log WHERE accion = 'evento.editar'`;
    expect(aud?.antes.titulo).toBe("Asamblea Ordinaria");
    expect(aud?.despues.titulo).toBe("Asamblea Extraordinaria");
  });

  it("anular exige motivo, es irreversible y no se puede editar un evento anulado", async () => {
    const { ctxA, evento } = await escenario();
    expect(await codigo(anularEvento(ctxA, evento, "   "))).toBe("MOTIVO_REQUERIDO");
    expect(await codigo(anularEvento(ctxA, evento, "abc"))).toBe("MOTIVO_REQUERIDO");

    await anularEvento(ctxA, evento, "Se suspendió por lluvia");
    expect(await obtenerEvento(ctxA, evento)).toMatchObject({ estado: "anulado", motivoAnulacion: "Se suspendió por lluvia" });
    const [fila] = await adminSql()`SELECT anulado_por, anulado_en FROM evento WHERE id = ${evento}`;
    expect(fila?.anulado_por).toBe(ctxA.userId);
    expect(fila?.anulado_en).toBeInstanceOf(Date);

    expect(await codigo(anularEvento(ctxA, evento, "Otro motivo válido"))).toBe("EVENTO_ANULADO");
    expect(await codigo(editarEvento(ctxA, evento, { tipo: "minga", titulo: "Nuevo título", fecha: FECHA_PASADA, lugar: "X" }))).toBe("EVENTO_ANULADO");
    expect(await adminSql()`SELECT 1 FROM audit_log WHERE accion = 'evento.anular'`).toHaveLength(1);
  });

  it("no existe forma de eliminar un evento (solo se anula)", async () => {
    const { ctxA, evento } = await escenario();
    await anularEvento(ctxA, evento, "Motivo de prueba");
    expect(await adminSql()`SELECT 1 FROM evento WHERE id = ${evento}`).toHaveLength(1);
  });

  it("lista con filtros, paginación y conteos de asistencia", async () => {
    const { a, ctxA, secretarioA, evento, s1, s2 } = await escenario();
    await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, fecha: "2026-04-05", tipo: "minga", titulo: "Minga abril" });
    await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, fecha: "2026-05-05", estado: "anulado", titulo: "Anulada mayo" });
    await guardarAsistencia(ctxA, evento, [
      { socioId: s1, estado: "presente" },
      { socioId: s2, estado: "ausente" },
    ]);

    const todos = await listarEventos(ctxA, f());
    expect(todos.total).toBe(3);
    expect(todos.items.map((e) => e.fecha)).toEqual(["2026-05-05", "2026-04-05", FECHA_PASADA]); // más reciente primero

    const conAsistencia = todos.items.find((e) => e.id === evento);
    expect(conAsistencia).toMatchObject({ asistenciaRegistrada: true, registrados: 2, presentes: 1 });
    expect(todos.items.find((e) => e.titulo === "Minga abril")).toMatchObject({ asistenciaRegistrada: false, registrados: 0, presentes: 0 });

    expect((await listarEventos(ctxA, f({ tipo: "minga" }))).total).toBe(1);
    expect((await listarEventos(ctxA, f({ estado: "anulado" }))).items.map((e) => e.titulo)).toEqual(["Anulada mayo"]);
    expect((await listarEventos(ctxA, f({ desde: "2026-04-01", hasta: "2026-04-30" }))).total).toBe(1);
  });

  it("no ve, edita ni anula los eventos de otra junta", async () => {
    const { b, ctxA, secretarioB } = await escenario();
    const ajeno = await crearEventoDirecto({ tenantId: b, creadoPor: secretarioB, titulo: "Evento de B" });
    expect(await obtenerEvento(ctxA, ajeno)).toBeNull();
    expect(await codigo(editarEvento(ctxA, ajeno, { tipo: "minga", titulo: "Hackeado", fecha: FECHA_PASADA, lugar: "X" }))).toBe("EVENTO_NO_ENCONTRADO");
    expect(await codigo(anularEvento(ctxA, ajeno, "Intento ajeno válido"))).toBe("EVENTO_NO_ENCONTRADO");
    expect((await listarEventos(ctxA, f())).items.map((e) => e.id)).not.toContain(ajeno);
  });
});

describe("lista de asistencia (RF-09)", () => {
  it("incluye socios activos con ingreso hasta la fecha del evento, todos «ausente» por defecto", async () => {
    const { ctxA, evento } = await escenario();
    const lista = await obtenerListaAsistencia(ctxA, evento);
    expect(lista.items.map((i) => i.nombres)).toEqual(["Ana Torres", "Beto Pérez", "Carla Ríos"]); // sin inactivos ni ingresados después
    expect(lista.items.every((i) => i.estado === "ausente" && !i.registrado)).toBe(true);
    expect(lista.puedeRegistrar).toBe(true);
    expect(lista.motivoBloqueo).toBeNull();
    expect(lista.resumen).toMatchObject({ total: 3, presentes: 0, ausentes: 3, quorumPorcentaje: 50, alcanzaQuorum: false });
  });

  it("usa el quórum configurado por la junta", async () => {
    const { a, ctxA, evento, s1, s2 } = await escenario();
    await adminSql()`UPDATE junta SET parametros = '{"quorumPorcentaje": 60}'::jsonb WHERE id = ${a}`;
    await guardarAsistencia(ctxA, evento, [
      { socioId: s1, estado: "presente" },
      { socioId: s2, estado: "presente" },
    ]);
    const lista = await obtenerListaAsistencia(ctxA, evento);
    expect(lista.resumen).toMatchObject({ total: 3, presentes: 2, porcentaje: 66.7, quorumPorcentaje: 60, alcanzaQuorum: true });
  });

  it("busca por nombre o cédula", async () => {
    const { ctxA, evento } = await escenario();
    expect((await obtenerListaAsistencia(ctxA, evento, { busqueda: "beto" })).items.map((i) => i.nombres)).toEqual(["Beto Pérez"]);
    expect((await obtenerListaAsistencia(ctxA, evento, { busqueda: "1710000033" })).items.map((i) => i.nombres)).toEqual(["Carla Ríos"]);
    expect((await obtenerListaAsistencia(ctxA, evento, { busqueda: "nadie" })).items).toHaveLength(0);
  });

  it("un socio dado de baja con asistencia previa sigue apareciendo en ese evento", async () => {
    const { a, ctxA, evento, s1, sInactivo } = await escenario();
    await adminSql()`
      INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, registrado_por, modificado_por)
      VALUES (${a}, ${evento}, ${sInactivo}, 'presente', ${ctxA.userId}, ${ctxA.userId})`;
    const lista = await obtenerListaAsistencia(ctxA, evento);
    const baja = lista.items.find((i) => i.socioId === sInactivo);
    expect(baja).toMatchObject({ estado: "presente", registrado: true, inactivo: true });
    expect(lista.items.map((i) => i.socioId)).toContain(s1);
  });

  it("marca el bloqueo de eventos futuros y anulados", async () => {
    const { a, ctxA, secretarioA } = await escenario();
    const futuro = await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, fecha: FECHA_FUTURA });
    const anulado = await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, estado: "anulado" });
    expect(await obtenerListaAsistencia(ctxA, futuro)).toMatchObject({ puedeRegistrar: false, motivoBloqueo: "futuro" });
    expect(await obtenerListaAsistencia(ctxA, anulado)).toMatchObject({ puedeRegistrar: false, motivoBloqueo: "anulado" });
  });

  it("no entrega la lista de un evento de otra junta", async () => {
    const { b, ctxA, secretarioB } = await escenario();
    const ajeno = await crearEventoDirecto({ tenantId: b, creadoPor: secretarioB });
    expect(await codigo(obtenerListaAsistencia(ctxA, ajeno))).toBe("EVENTO_NO_ENCONTRADO");
  });
});

describe("guardar asistencia (RF-09)", () => {
  it("guarda toda la lista, completa los datos de registro y audita el resumen", async () => {
    const { a, ctxA, evento, s1, s2, s3 } = await escenario();
    const resumen = await guardarAsistencia(ctxA, evento, [
      { socioId: s1, estado: "presente" },
      { socioId: s2, estado: "ausente" },
      { socioId: s3, estado: "justificado", motivo: "  Calamidad doméstica " },
    ]);
    expect(resumen).toMatchObject({ total: 3, presentes: 1, ausentes: 1, justificados: 1 });

    const filas = await adminSql()`SELECT socio_id, estado, motivo, registrado_por, modificado_por FROM asistencia WHERE evento_id = ${evento}`;
    expect(filas).toHaveLength(3);
    expect(filas.find((r) => r.socio_id === s3)).toMatchObject({ estado: "justificado", motivo: "Calamidad doméstica" });
    expect(filas.every((r) => r.registrado_por === ctxA.userId && r.modificado_por === ctxA.userId)).toBe(true);
    expect((await obtenerEvento(ctxA, evento))?.asistenciaRegistrada).toBe(true);

    const [aud] = await adminSql()`SELECT tenant_id, despues FROM audit_log WHERE accion = 'asistencia.guardar'`;
    expect(aud?.tenant_id).toBe(a);
    expect(aud?.despues).toMatchObject({ total: 3, presentes: 1, ausentes: 1, justificados: 1, creados: 3, modificados: 0 });
  });

  it("al reabrir y corregir solo se modifican las filas que cambian", async () => {
    const { ctxA, evento, s1, s2, s3 } = await escenario();
    const otro = await crearUsuarioDirecto({ tenantId: ctxA.tenantId, cedula: "1750000002", rol: "secretario" });
    await guardarAsistencia(ctxA, evento, [
      { socioId: s1, estado: "presente" },
      { socioId: s2, estado: "ausente" },
      { socioId: s3, estado: "presente" },
    ]);
    const antes = await adminSql()`SELECT socio_id, modificado_en FROM asistencia WHERE evento_id = ${evento}`;
    await new Promise((r) => setTimeout(r, 20));

    // otro usuario corrige solo a s2
    const ctxOtro = { ...ctxA, userId: otro };
    await guardarAsistencia(ctxOtro, evento, [
      { socioId: s1, estado: "presente" },
      { socioId: s2, estado: "presente" },
      { socioId: s3, estado: "presente" },
    ]);
    const despues = await adminSql()`SELECT socio_id, estado, registrado_por, modificado_por, modificado_en FROM asistencia WHERE evento_id = ${evento}`;
    const t = (id: string, filas: typeof antes) => filas.find((r) => r.socio_id === id)!.modificado_en.getTime();
    expect(t(s1, despues)).toBe(t(s1, antes));
    expect(t(s3, despues)).toBe(t(s3, antes));
    expect(t(s2, despues)).toBeGreaterThan(t(s2, antes));
    const fila2 = despues.find((r) => r.socio_id === s2)!;
    expect(fila2).toMatchObject({ estado: "presente", registrado_por: ctxA.userId, modificado_por: otro });

    const [aud] = await adminSql()`SELECT despues FROM audit_log WHERE accion = 'asistencia.guardar' ORDER BY creado_en DESC LIMIT 1`;
    expect(aud?.despues).toMatchObject({ creados: 0, modificados: 1, cambios: [{ socioId: s2, de: "ausente", a: "presente" }] });
  });

  it("guardar sin cambios es idempotente y el motivo se borra al dejar de estar justificado", async () => {
    const { ctxA, evento, s1 } = await escenario();
    await guardarAsistencia(ctxA, evento, [{ socioId: s1, estado: "justificado", motivo: "Enfermedad" }]);
    await guardarAsistencia(ctxA, evento, [{ socioId: s1, estado: "justificado", motivo: "Enfermedad" }]);
    expect((await adminSql()`SELECT despues FROM audit_log WHERE accion = 'asistencia.guardar' ORDER BY creado_en DESC LIMIT 1`)[0]?.despues).toMatchObject({ creados: 0, modificados: 0 });

    await guardarAsistencia(ctxA, evento, [{ socioId: s1, estado: "presente", motivo: "ignorado" }]);
    const [fila] = await adminSql()`SELECT estado, motivo FROM asistencia WHERE socio_id = ${s1}`;
    expect(fila).toMatchObject({ estado: "presente", motivo: null });
  });

  it("una justificación sin motivo se rechaza y no guarda nada", async () => {
    const { ctxA, evento, s1, s2 } = await escenario();
    expect(
      await codigo(
        guardarAsistencia(ctxA, evento, [
          { socioId: s1, estado: "presente" },
          { socioId: s2, estado: "justificado", motivo: "   " },
        ]),
      ),
    ).toBe("MOTIVO_REQUERIDO");
    expect(await adminSql()`SELECT 1 FROM asistencia`).toHaveLength(0);
    expect((await obtenerEvento(ctxA, evento))?.asistenciaRegistrada).toBe(false);
  });

  it("rechaza eventos futuros, anulados e inexistentes", async () => {
    const { a, ctxA, secretarioA, s1 } = await escenario();
    const futuro = await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, fecha: FECHA_FUTURA });
    const anulado = await crearEventoDirecto({ tenantId: a, creadoPor: secretarioA, estado: "anulado" });
    const reg = [{ socioId: s1, estado: "presente" as const }];
    expect(await codigo(guardarAsistencia(ctxA, futuro, reg))).toBe("EVENTO_FUTURO");
    expect(await codigo(guardarAsistencia(ctxA, anulado, reg))).toBe("EVENTO_ANULADO");
    expect(await codigo(guardarAsistencia(ctxA, "00000000-0000-4000-8000-000000000000", reg))).toBe("EVENTO_NO_ENCONTRADO");
  });

  it("rechaza socios no permitidos y es atómico: si uno falla no se guarda ninguno", async () => {
    const { ctxA, evento, s1, sInactivo, sNuevo, sB } = await escenario();
    for (const intruso of [sB, sInactivo, sNuevo, "00000000-0000-4000-8000-000000000000"]) {
      expect(
        await codigo(
          guardarAsistencia(ctxA, evento, [
            { socioId: s1, estado: "presente" },
            { socioId: intruso, estado: "presente" },
          ]),
        ),
        `socio ${intruso}`,
      ).toBe("SOCIO_NO_PERMITIDO");
    }
    expect(await adminSql()`SELECT 1 FROM asistencia`).toHaveLength(0);
  });

  it("rechaza socios repetidos y listas vacías", async () => {
    const { ctxA, evento, s1 } = await escenario();
    expect(
      await codigo(
        guardarAsistencia(ctxA, evento, [
          { socioId: s1, estado: "presente" },
          { socioId: s1, estado: "ausente" },
        ]),
      ),
    ).toBe("DATOS_INVALIDOS");
    expect(await codigo(guardarAsistencia(ctxA, evento, []))).toBe("DATOS_INVALIDOS");
  });

  it("un socio dado de baja que ya tenía asistencia se puede corregir en ese evento", async () => {
    const { a, ctxA, evento, sInactivo } = await escenario();
    await adminSql()`
      INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, registrado_por, modificado_por)
      VALUES (${a}, ${evento}, ${sInactivo}, 'ausente', ${ctxA.userId}, ${ctxA.userId})`;
    await expect(guardarAsistencia(ctxA, evento, [{ socioId: sInactivo, estado: "presente" }])).resolves.toBeDefined();
  });

  it("no puede guardar asistencia en un evento de otra junta", async () => {
    const { b, ctxA, secretarioB, s1 } = await escenario();
    const ajeno = await crearEventoDirecto({ tenantId: b, creadoPor: secretarioB });
    expect(await codigo(guardarAsistencia(ctxA, ajeno, [{ socioId: s1, estado: "presente" }]))).toBe("EVENTO_NO_ENCONTRADO");
    expect(await adminSql()`SELECT 1 FROM asistencia`).toHaveLength(0);
  });

  it("guarda la asistencia de 100 socios en una sola operación", async () => {
    const { a, secA, ctxA, evento } = await escenario();
    await adminSql()`
      INSERT INTO socio (tenant_id, cedula, nombres, sector_id, fecha_ingreso)
      SELECT ${a}, '17' || lpad(g::text, 8, '0'), 'Socio ' || lpad(g::text, 4, '0'), ${secA}::uuid, '2020-01-01'
      FROM generate_series(1, 100) g`;
    const lista = await obtenerListaAsistencia(ctxA, evento);
    expect(lista.items.length).toBe(103); // 3 del escenario + 100
    const inicio = performance.now();
    const resumen = await guardarAsistencia(
      ctxA,
      evento,
      lista.items.map((i, n) => ({ socioId: i.socioId, estado: n % 4 === 0 ? ("ausente" as const) : ("presente" as const) })),
    );
    expect(performance.now() - inicio).toBeLessThan(5000);
    expect(resumen.total).toBe(103);
  });
});
