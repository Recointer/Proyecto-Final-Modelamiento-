import { describe, expect, it } from "vitest";
import { sql as sqlTag } from "drizzle-orm";
import { withTenant } from "@/server/db/context";
import { adminSql } from "./setup";
import {
  crearEventoDirecto,
  crearJuntaDirecta,
  crearPredioDirecto,
  crearSectorDirecto,
  crearServicioDirecto,
  crearSocioDirecto,
  crearTurnoDirecto,
  crearUsuarioDirecto,
} from "./helpers";

const TABLAS = ["socio", "evento", "asistencia", "predio", "servicio", "turno"] as const;

async function junta(slug: string, cedulaAdmin: string, cedulaSocio: string) {
  const id = await crearJuntaDirecta(slug);
  const admin = await crearUsuarioDirecto({ tenantId: id, cedula: cedulaAdmin, rol: "admin_junta" });
  const sector = await crearSectorDirecto(id, "Norte");
  const socio = await crearSocioDirecto({ tenantId: id, sectorId: sector, cedula: cedulaSocio });
  const evento = await crearEventoDirecto({ tenantId: id, creadoPor: admin, fecha: "2026-03-10" });
  await adminSql()`
    INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, registrado_por, modificado_por)
    VALUES (${id}, ${evento}, ${socio}, 'presente', ${admin}, ${admin})`;
  const predio = await crearPredioDirecto({ tenantId: id, sectorId: sector, socioId: socio });
  const servicio = await crearServicioDirecto(id);
  const turno = await crearTurnoDirecto({ tenantId: id, servicioId: servicio, sectorId: sector });
  return { id, admin, sector, socio, evento, predio, servicio, turno, ctx: { role: "tenant" as const, tenantId: id, userId: admin } };
}

async function dosJuntas() {
  const a = await junta("junta-a", "1710034065", "0926687856");
  const b = await junta("junta-b", "1713175071", "0926687856");
  return { a, b };
}

const contar = (ctx: Parameters<typeof withTenant>[0], tabla: string) =>
  withTenant(ctx, async (tx) => {
    const filas = await tx.execute(sqlTag.raw(`SELECT count(*)::int AS n FROM ${tabla}`));
    return Number((filas[0] as { n: number }).n);
  });

describe("aislamiento de las tablas del módulo administrativo (RLS)", () => {
  it("un contexto de junta ve solo las filas de su junta en las seis tablas", async () => {
    const { a } = await dosJuntas();
    for (const t of TABLAS) expect(await contar(a.ctx, t), t).toBe(1);
  });

  it("el super_admin y el contexto de autenticación no ven ninguna fila", async () => {
    await dosJuntas();
    for (const t of TABLAS) {
      expect(await contar({ role: "super_admin", userId: "x" }, t), `super_admin/${t}`).toBe(0);
      expect(await contar({ role: "auth" }, t), `auth/${t}`).toBe(0);
    }
  });

  it("sin contexto de junta no se ve nada", async () => {
    await dosJuntas();
    expect(await contar({ role: "tenant", tenantId: "", userId: "x" }, "socio").catch(() => 0)).toBe(0);
  });

  it("una junta no puede insertar filas con el tenant_id de otra", async () => {
    const { a, b } = await dosJuntas();
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO servicio (tenant_id, nombre, tipo) VALUES (${b.id}, 'Intruso', 'otro')`),
      ),
    ).rejects.toThrow();
  });

  it("una junta no puede modificar filas de otra", async () => {
    const { a, b } = await dosJuntas();
    await withTenant(a.ctx, (tx) => tx.execute(sqlTag`UPDATE socio SET nombres = 'Hackeado Total' WHERE id = ${b.socio}`));
    const [s] = await adminSql()`SELECT nombres FROM socio WHERE id = ${b.socio}`;
    expect(s?.nombres).not.toBe("Hackeado Total");
  });
});

describe("claves foráneas compuestas (id, tenant_id)", () => {
  it("rechazan referencias cruzadas entre juntas aunque se salte la RLS", async () => {
    const { a, b } = await dosJuntas();
    const sql = adminSql();

    // socio de A con un sector de B
    await expect(
      sql`INSERT INTO socio (tenant_id, cedula, nombres, sector_id, fecha_ingreso)
          VALUES (${a.id}, '1750000001', 'Cruzado Uno', ${b.sector}, '2020-01-01')`,
    ).rejects.toMatchObject({ code: "23503" });

    // asistencia de A con el evento de B, y con el socio de B
    await expect(
      sql`INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, registrado_por, modificado_por)
          VALUES (${a.id}, ${b.evento}, ${a.socio}, 'ausente', ${a.admin}, ${a.admin})`,
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      sql`INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, registrado_por, modificado_por)
          VALUES (${a.id}, ${a.evento}, ${b.socio}, 'ausente', ${a.admin}, ${a.admin})`,
    ).rejects.toMatchObject({ code: "23503" });

    // predio de A con sector de B, o titular de B
    await expect(
      sql`INSERT INTO predio (tenant_id, codigo, nombre, superficie_ha, sector_id, socio_id)
          VALUES (${a.id}, 'X-1', 'Cruzado', 1, ${b.sector}, ${a.socio})`,
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      sql`INSERT INTO predio (tenant_id, codigo, nombre, superficie_ha, sector_id, socio_id)
          VALUES (${a.id}, 'X-2', 'Cruzado', 1, ${a.sector}, ${b.socio})`,
    ).rejects.toMatchObject({ code: "23503" });

    // turno de A con servicio o sector de B
    await expect(
      sql`INSERT INTO turno (tenant_id, servicio_id, sector_id, dia_semana, hora_inicio, hora_fin)
          VALUES (${a.id}, ${b.servicio}, ${a.sector}, 3, '08:00', '09:00')`,
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      sql`INSERT INTO turno (tenant_id, servicio_id, sector_id, dia_semana, hora_inicio, hora_fin)
          VALUES (${a.id}, ${a.servicio}, ${b.sector}, 3, '08:00', '09:00')`,
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("impiden eliminar un sector con socios, predios o turnos asociados (ON DELETE RESTRICT)", async () => {
    const { a } = await dosJuntas();
    await expect(
      withTenant(a.ctx, (tx) => tx.execute(sqlTag`DELETE FROM sector WHERE id = ${a.sector}`)),
    ).rejects.toThrow();
    expect(await adminSql()`SELECT 1 FROM sector WHERE id = ${a.sector}`).toHaveLength(1);
  });
});

describe("privilegios del rol de la aplicación", () => {
  it("no puede hacer DELETE sobre socio, evento, asistencia, predio ni servicio (bajas lógicas)", async () => {
    const { a } = await dosJuntas();
    for (const t of ["socio", "evento", "asistencia", "predio", "servicio"]) {
      await expect(
        withTenant(a.ctx, (tx) => tx.execute(sqlTag.raw(`DELETE FROM ${t}`))),
        `DELETE en ${t}`,
      ).rejects.toThrow();
    }
  });

  it("sí puede eliminar turnos, y solo los de su junta", async () => {
    const { a, b } = await dosJuntas();
    await withTenant(a.ctx, (tx) => tx.execute(sqlTag`DELETE FROM turno`));
    expect(await adminSql()`SELECT 1 FROM turno WHERE id = ${a.turno}`).toHaveLength(0);
    expect(await adminSql()`SELECT 1 FROM turno WHERE id = ${b.turno}`).toHaveLength(1);
  });
});

describe("restricciones de datos", () => {
  it("la cédula del socio es única por junta pero puede repetirse en otra", async () => {
    const { a } = await dosJuntas(); // ambas juntas ya tienen un socio con la misma cédula
    await expect(
      crearSocioDirecto({ tenantId: a.id, sectorId: a.sector, cedula: "0926687856" }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("evento: una anulación exige motivo, actor y fecha; la asistencia justificada exige motivo", async () => {
    const { a } = await dosJuntas();
    const sql = adminSql();
    await expect(sql`UPDATE evento SET estado = 'anulado' WHERE id = ${a.evento}`).rejects.toMatchObject({ code: "23514" });
    await expect(sql`UPDATE asistencia SET estado = 'justificado', motivo = NULL WHERE evento_id = ${a.evento}`).rejects.toMatchObject({
      code: "23514",
    });
    await expect(sql`UPDATE asistencia SET estado = 'justificado', motivo = '   ' WHERE evento_id = ${a.evento}`).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("predio: coordenadas en rango y ambas o ninguna; superficie positiva; código único sin distinguir mayúsculas", async () => {
    const { a } = await dosJuntas();
    const sql = adminSql();
    const base = { tenantId: a.id, sectorId: a.sector, socioId: a.socio };
    await expect(crearPredioDirecto({ ...base, codigo: "C-1", latitud: 91, longitud: 0 })).rejects.toMatchObject({ code: "23514" });
    await expect(crearPredioDirecto({ ...base, codigo: "C-2", latitud: 0, longitud: -181 })).rejects.toMatchObject({ code: "23514" });
    await expect(crearPredioDirecto({ ...base, codigo: "C-3", latitud: -0.2, longitud: null })).rejects.toMatchObject({ code: "23514" });
    await expect(crearPredioDirecto({ ...base, codigo: "C-4", superficieHa: 0 })).rejects.toMatchObject({ code: "23514" });
    await expect(crearPredioDirecto({ ...base, codigo: "p-001" })).rejects.toMatchObject({ code: "23505" });
    expect(await sql`SELECT 1 FROM predio WHERE tenant_id = ${a.id}`).toHaveLength(1);
  });
});

describe("funciones agregadas de eventos (solo super_admin)", () => {
  async function eventos() {
    const { a, b } = await dosJuntas();
    await crearEventoDirecto({ tenantId: a.id, creadoPor: a.admin, fecha: "2026-03-10" });
    await crearEventoDirecto({ tenantId: b.id, creadoPor: b.admin, fecha: "2026-03-10", tipo: "minga" });
    await crearEventoDirecto({ tenantId: b.id, creadoPor: b.admin, fecha: "2026-03-22" });
    await crearEventoDirecto({ tenantId: a.id, creadoPor: a.admin, fecha: "2026-03-22", estado: "anulado" });
    await crearEventoDirecto({ tenantId: a.id, creadoPor: a.admin, fecha: "2026-04-01" });
    return { a, b };
  }

  const sup = { role: "super_admin" as const, userId: "x" };

  it("devuelve el total de eventos activos de todas las juntas, sin los anulados", async () => {
    await eventos();
    const r = await withTenant(sup, (tx) => tx.execute(sqlTag`SELECT total_eventos_plataforma() AS n`));
    // 2 del escenario (uno por junta) + 4 activos añadidos; el anulado no cuenta
    expect(Number((r[0] as { n: number }).n)).toBe(6);
  });

  it("devuelve la cantidad por día del mes, sin títulos ni identificar la junta", async () => {
    await eventos();
    const r = await withTenant(sup, (tx) => tx.execute(sqlTag`SELECT * FROM eventos_plataforma_por_dia(2026, 3)`));
    const filas = r as unknown as { dia: number; total: number }[];
    expect(filas.map((f) => ({ dia: Number(f.dia), total: Number(f.total) }))).toEqual([
      { dia: 10, total: 4 }, // 2 del escenario + 1 de a + 1 de b
      { dia: 22, total: 1 }, // el anulado no cuenta
    ]);
    expect(Object.keys(filas[0] as object).sort()).toEqual(["dia", "total"]);
  });

  it("rechaza mes o año no válidos", async () => {
    await expect(withTenant(sup, (tx) => tx.execute(sqlTag`SELECT * FROM eventos_plataforma_por_dia(2026, 13)`))).rejects.toThrow();
    await expect(withTenant(sup, (tx) => tx.execute(sqlTag`SELECT * FROM eventos_plataforma_por_dia(1999, 1)`))).rejects.toThrow();
  });

  it("no funcionan para una junta ni para el contexto de autenticación", async () => {
    const { a } = await eventos();
    for (const ctx of [a.ctx, { role: "auth" as const }]) {
      await expect(withTenant(ctx, (tx) => tx.execute(sqlTag`SELECT total_eventos_plataforma()`))).rejects.toThrow();
      await expect(withTenant(ctx, (tx) => tx.execute(sqlTag`SELECT * FROM eventos_plataforma_por_dia(2026, 3)`))).rejects.toThrow();
    }
  });
});
