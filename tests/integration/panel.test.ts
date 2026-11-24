import { describe, expect, it } from "vitest";
import { generarReportePlataforma, obtenerPanel } from "@/server/services/panel-service";
import { withTenant } from "@/server/db/context";
import { sector } from "@/server/db/schema";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto } from "./helpers";

const ctx = { role: "super_admin" as const, userId: "00000000-0000-0000-0000-000000000001" };
const AHORA = new Date("2026-11-21T15:00:00Z"); // noviembre de 2026 en Ecuador

async function juntaEn(slug: string, creada: string, estado: "activa" | "desactivada" = "activa", nombre?: string) {
  const id = await crearJuntaDirecta(slug, nombre ?? `Junta ${slug}`);
  await adminSql()`UPDATE junta SET creada_en = ${creada}, estado = ${estado} WHERE id = ${id}`;
  return id;
}

describe("panel del Super Administrador", () => {
  it("sin datos devuelve ceros y evento = 0", async () => {
    const p = await obtenerPanel(ctx, { ahora: AHORA });
    expect(p).toMatchObject({
      totalJuntas: 0,
      juntasActivas: 0,
      juntasDesactivadas: 0,
      juntasSinAdministrador: 0,
      nuevasEsteMes: 0,
      nuevasMesAnterior: 0,
      totalEventos: 0,
      totalPagos: 0,
    });
    expect(p.eventosDelMes).toEqual([]);
    expect(p.recientes).toEqual([]);
  });

  it("cuenta totales, activas y desactivadas", async () => {
    await juntaEn("a", "2026-05-01T12:00:00Z");
    await juntaEn("b", "2026-06-01T12:00:00Z");
    await juntaEn("c", "2026-07-01T12:00:00Z", "desactivada");
    const p = await obtenerPanel(ctx, { ahora: AHORA });
    expect(p.totalJuntas).toBe(3);
    expect(p.juntasActivas).toBe(2);
    expect(p.juntasDesactivadas).toBe(1);
  });

  it("compara las juntas nuevas del mes con las del mes anterior (hora de Ecuador)", async () => {
    await juntaEn("nov-1", "2026-11-03T12:00:00Z");
    await juntaEn("nov-2", "2026-11-20T12:00:00Z");
    await juntaEn("oct-1", "2026-10-15T12:00:00Z");
    await juntaEn("sep-1", "2026-09-30T12:00:00Z");
    // 1 de noviembre 03:00 UTC = 31 de octubre 22:00 en Ecuador → cuenta como octubre
    await juntaEn("limite", "2026-11-01T03:00:00Z");
    const p = await obtenerPanel(ctx, { ahora: AHORA });
    expect(p.nuevasEsteMes).toBe(2);
    expect(p.nuevasMesAnterior).toBe(2);
  });

  it("cuenta las juntas activas sin administrador vigente", async () => {
    const conAdmin = await juntaEn("con-admin", "2026-05-01T12:00:00Z");
    await juntaEn("sin-admin", "2026-05-01T12:00:00Z");
    const desactivada = await juntaEn("inactiva", "2026-05-01T12:00:00Z", "desactivada");
    await crearUsuarioDirecto({ tenantId: conAdmin, cedula: "1710034065", rol: "admin_junta" });
    // una junta desactivada sin admin no cuenta como pendiente
    expect(desactivada).toBeTruthy();
    const p = await obtenerPanel(ctx, { ahora: AHORA });
    expect(p.juntasSinAdministrador).toBe(1);

    // un administrador desactivado equivale a no tener administrador
    await adminSql()`UPDATE usuario SET estado = 'desactivado' WHERE tenant_id = ${conAdmin}`;
    expect((await obtenerPanel(ctx, { ahora: AHORA })).juntasSinAdministrador).toBe(2);
  });

  it("lista las 5 juntas más recientes", async () => {
    for (let i = 1; i <= 7; i++) await juntaEn(`j${i}`, `2026-0${i}-10T12:00:00Z`);
    const p = await obtenerPanel(ctx, { ahora: AHORA });
    expect(p.recientes).toHaveLength(5);
    expect(p.recientes[0]?.nombre).toBe("Junta j7");
  });

  it("solo expone datos agregados: ningún dato interno de las juntas", async () => {
    const j = await juntaEn("con-datos", "2026-05-01T12:00:00Z");
    await crearUsuarioDirecto({ tenantId: j, cedula: "1713175071", rol: "socio", correo: "secreto@socio.com" });
    await adminSql()`INSERT INTO sector (tenant_id, nombre) VALUES (${j}, 'Sector Reservado')`;

    const p = await obtenerPanel(ctx, { ahora: AHORA });
    const serializado = JSON.stringify(p);
    expect(serializado).not.toContain("secreto@socio.com");
    expect(serializado).not.toContain("1713175071");
    expect(serializado).not.toContain("Sector Reservado");

    // y el rol de plataforma tampoco puede leer esas tablas directamente
    const sectores = await withTenant(ctx, (tx) => tx.select().from(sector));
    expect(sectores).toHaveLength(0);
  });
});

describe("reporte de la plataforma (CSV)", () => {
  it("incluye totales y el listado de juntas", async () => {
    const a = await juntaEn("alfa", "2026-05-01T12:00:00Z", "activa", "Junta Alfa");
    await juntaEn("beta", "2026-06-01T12:00:00Z", "desactivada", "Junta Beta");
    await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "admin_junta" });

    const csv = await generarReportePlataforma(ctx, AHORA);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Total de juntas,2");
    expect(csv).toContain("Juntas activas,1");
    expect(csv).toContain("Juntas desactivadas,1");
    expect(csv).toContain("Total de eventos,0");
    expect(csv).toContain("Nombre,Identificador,Tipo,Provincia,Cantón,Parroquia,Estado,Creada,Tiene administrador");
    expect(csv).toMatch(/Junta Alfa,alfa,riego,Pichincha,Quito,Parroquia alfa,activa,.+,sí/);
    expect(csv).toMatch(/Junta Beta,beta,riego,Pichincha,Quito,Parroquia beta,desactivada,.+,no/);
  });

  it("escapa nombres con comas o fórmulas", async () => {
    await juntaEn("peligro", "2026-05-01T12:00:00Z", "activa", '=CMD("x"), Junta');
    const csv = await generarReportePlataforma(ctx, AHORA);
    expect(csv).toContain(`"'=CMD(""x""), Junta"`);
  });

  it("no incluye datos internos de las juntas", async () => {
    const j = await juntaEn("secreta", "2026-05-01T12:00:00Z");
    await crearUsuarioDirecto({ tenantId: j, cedula: "1713175071", rol: "socio", correo: "secreto@socio.com" });
    const csv = await generarReportePlataforma(ctx, AHORA);
    expect(csv).not.toContain("secreto@socio.com");
    expect(csv).not.toContain("1713175071");
  });
});
