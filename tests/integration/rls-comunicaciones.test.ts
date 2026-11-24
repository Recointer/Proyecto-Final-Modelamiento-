import { describe, expect, it } from "vitest";
import { sql as sqlTag } from "drizzle-orm";
import { withTenant } from "@/server/db/context";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto } from "./helpers";

const TABLAS = ["convocatoria", "documento", "comunicacion_recibida", "hilo", "mensaje"] as const;

async function junta(slug: string, cedula: string, cedulaSocio: string) {
  const id = await crearJuntaDirecta(slug);
  const sec = await crearUsuarioDirecto({ tenantId: id, cedula, rol: "secretario" });
  const socio = await crearUsuarioDirecto({ tenantId: id, cedula: cedulaSocio, rol: "socio" });
  const sql = adminSql();
  await sql`INSERT INTO convocatoria (tenant_id, tipo, titulo, fecha, hora, lugar, creado_por) VALUES (${id}, 'asamblea', 'Asamblea', '2030-01-01', '18:00', 'Casa', ${sec})`;
  await sql`INSERT INTO documento (tenant_id, tipo, titulo, fecha, archivo_ruta, creado_por) VALUES (${id}, 'resolucion', 'Resolución', '2026-01-01', 'x/y.pdf', ${sec})`;
  await sql`INSERT INTO comunicacion_recibida (tenant_id, institucion, asunto, fecha_recepcion, resumen, creado_por) VALUES (${id}, 'GAD', 'Oficio', '2026-01-01', 'Resumen', ${sec})`;
  const [h] = await sql`INSERT INTO hilo (tenant_id, usuario_id, asunto) VALUES (${id}, ${socio}, 'Consulta') RETURNING id`;
  await sql`INSERT INTO mensaje (tenant_id, hilo_id, autor_id, de_administracion, texto) VALUES (${id}, ${h!.id}, ${socio}, false, 'Hola')`;
  return { id, sec, socio, hilo: h!.id as string, ctx: { role: "tenant" as const, tenantId: id, userId: sec } };
}

async function dosJuntas() {
  return { a: await junta("junta-a", "1710034065", "0926687856"), b: await junta("junta-b", "1713175071", "0926687856") };
}

const contar = (ctx: Parameters<typeof withTenant>[0], tabla: string) =>
  withTenant(ctx, async (tx) => Number(((await tx.execute(sqlTag.raw(`SELECT count(*)::int AS n FROM ${tabla}`)))[0] as { n: number }).n));

describe("aislamiento de las tablas del módulo de comunicaciones (RLS)", () => {
  it("una junta ve solo sus filas; el super_admin y el contexto de autenticación no ven ninguna", async () => {
    const { a } = await dosJuntas();
    for (const t of TABLAS) {
      expect(await contar(a.ctx, t), t).toBe(1);
      expect(await contar({ role: "super_admin", userId: "x" }, t), `super_admin/${t}`).toBe(0);
      expect(await contar({ role: "auth" }, t), `auth/${t}`).toBe(0);
    }
  });

  it("no se pueden insertar filas con el tenant_id de otra junta ni asociar una conversación a una cuenta ajena", async () => {
    const { a, b } = await dosJuntas();
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO convocatoria (tenant_id, tipo, titulo, fecha, hora, lugar, creado_por) VALUES (${b.id}, 'minga', 'Intruso', '2030-01-01', '10:00', 'X', ${a.sec})`),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(a.ctx, (tx) => tx.execute(sqlTag`INSERT INTO hilo (tenant_id, usuario_id, asunto) VALUES (${a.id}, ${b.socio}, 'Cuenta ajena')`)),
    ).rejects.toThrow();
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO mensaje (tenant_id, hilo_id, autor_id, de_administracion, texto) VALUES (${a.id}, ${b.hilo}, ${a.sec}, true, 'Hilo ajeno')`),
      ),
    ).rejects.toThrow();
  });

  it("la junta A no modifica ni borra filas de la junta B, y la aplicación no puede borrar en ninguna tabla", async () => {
    const { a, b } = await dosJuntas();
    await withTenant(a.ctx, (tx) => tx.execute(sqlTag`UPDATE documento SET publicado = true WHERE tenant_id = ${b.id}`));
    expect((await adminSql()`SELECT publicado FROM documento WHERE tenant_id = ${b.id}`)[0]!.publicado).toBe(false);
    for (const t of TABLAS) {
      await expect(withTenant(a.ctx, (tx) => tx.execute(sqlTag.raw(`DELETE FROM ${t}`))), t).rejects.toThrow();
    }
  });
});
