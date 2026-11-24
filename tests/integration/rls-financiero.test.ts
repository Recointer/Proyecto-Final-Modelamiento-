import { describe, expect, it } from "vitest";
import { sql as sqlTag } from "drizzle-orm";
import { withTenant } from "@/server/db/context";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearSectorDirecto, crearSocioDirecto, crearUsuarioDirecto } from "./helpers";

const TABLAS = ["concepto_cobro", "cargo", "pago", "contador_comprobante", "egreso", "material", "movimiento_material", "activo_fijo"] as const;

async function junta(slug: string, cedula: string) {
  const id = await crearJuntaDirecta(slug);
  const tes = await crearUsuarioDirecto({ tenantId: id, cedula, rol: "tesorero" });
  const sector = await crearSectorDirecto(id, "Norte");
  const socio = await crearSocioDirecto({ tenantId: id, sectorId: sector, cedula: "0926687856" });
  const sql = adminSql();
  const [concepto] = await sql`INSERT INTO concepto_cobro (tenant_id, nombre, tipo, monto_defecto) VALUES (${id}, 'Cuota', 'cuota', 10) RETURNING id`;
  const [cargo] = await sql`INSERT INTO cargo (tenant_id, concepto_id, socio_id, anio, monto, creado_por) VALUES (${id}, ${concepto!.id}, ${socio}, 2026, 10, ${tes}) RETURNING id`;
  await sql`INSERT INTO pago (tenant_id, cargo_id, numero, monto, fecha, forma, creado_por) VALUES (${id}, ${cargo!.id}, 0, 4, '2026-01-10', 'efectivo', ${tes})`;
  await sql`INSERT INTO egreso (tenant_id, fecha, categoria, descripcion, beneficiario, monto, creado_por) VALUES (${id}, '2026-01-11', 'compras', 'Tubería', 'Proveedor', 3, ${tes})`;
  const [material] = await sql`INSERT INTO material (tenant_id, nombre, unidad, stock) VALUES (${id}, 'Tubo', 'm', 5) RETURNING id`;
  await sql`INSERT INTO movimiento_material (tenant_id, material_id, tipo, cantidad, motivo, creado_por) VALUES (${id}, ${material!.id}, 'entrada', 5, 'Stock inicial', ${tes})`;
  await sql`INSERT INTO activo_fijo (tenant_id, codigo, nombre, fecha_adquisicion, valor, ubicacion) VALUES (${id}, 'AF-1', 'Bomba', '2024-01-01', 100, 'Bodega')`;
  return { id, tes, socio, concepto: concepto!.id as string, cargo: cargo!.id as string, ctx: { role: "tenant" as const, tenantId: id, userId: tes } };
}

async function dosJuntas() {
  return { a: await junta("junta-a", "1710034065"), b: await junta("junta-b", "1713175071") };
}

const contar = (ctx: Parameters<typeof withTenant>[0], tabla: string) =>
  withTenant(ctx, async (tx) => Number(((await tx.execute(sqlTag.raw(`SELECT count(*)::int AS n FROM ${tabla}`)))[0] as { n: number }).n));

describe("aislamiento de las tablas del módulo financiero (RLS)", () => {
  it("un contexto de junta ve solo las filas de su junta en todas las tablas y en la vista de saldos", async () => {
    const { a } = await dosJuntas();
    for (const t of TABLAS) expect(await contar(a.ctx, t), t).toBe(1);
    expect(await contar(a.ctx, "cargo_saldo")).toBe(1);
  });

  it("el super_admin y el contexto de autenticación no ven ninguna fila financiera", async () => {
    await dosJuntas();
    for (const t of [...TABLAS, "cargo_saldo"]) {
      expect(await contar({ role: "super_admin", userId: "x" }, t), `super_admin/${t}`).toBe(0);
      expect(await contar({ role: "auth" }, t), `auth/${t}`).toBe(0);
    }
  });

  it("una junta no puede insertar filas con el tenant_id de otra", async () => {
    const { a, b } = await dosJuntas();
    await expect(
      withTenant(a.ctx, (tx) => tx.execute(sqlTag`INSERT INTO concepto_cobro (tenant_id, nombre, tipo) VALUES (${b.id}, 'Intruso', 'cuota')`)),
    ).rejects.toThrow();
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO egreso (tenant_id, fecha, categoria, descripcion, beneficiario, monto, creado_por) VALUES (${b.id}, '2026-01-01', 'otros', 'Intruso', 'X', 1, ${a.tes})`),
      ),
    ).rejects.toThrow();
  });

  it("las claves foráneas compuestas impiden apuntar a socios, conceptos o cargos de otra junta", async () => {
    const { a, b } = await dosJuntas();
    // cargo de A con el socio de B
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO cargo (tenant_id, concepto_id, socio_id, anio, monto, creado_por) VALUES (${a.id}, ${a.concepto}, ${b.socio}, 2027, 5, ${a.tes})`),
      ),
    ).rejects.toThrow(/cargo_socio_fk|violates foreign key/);
    // cargo de A con el concepto de B
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO cargo (tenant_id, concepto_id, socio_id, anio, monto, creado_por) VALUES (${a.id}, ${b.concepto}, ${a.socio}, 2027, 5, ${a.tes})`),
      ),
    ).rejects.toThrow(/violates foreign key/);
    // pago de A sobre el cargo de B
    await expect(
      withTenant(a.ctx, (tx) =>
        tx.execute(sqlTag`INSERT INTO pago (tenant_id, cargo_id, numero, monto, fecha, forma, creado_por) VALUES (${a.id}, ${b.cargo}, 0, 1, '2026-02-01', 'efectivo', ${a.tes})`),
      ),
    ).rejects.toThrow();
  });

  it("la junta A no puede modificar ni borrar registros de la junta B", async () => {
    const { a, b } = await dosJuntas();
    const antes = await adminSql()`SELECT stock FROM material WHERE tenant_id = ${b.id}`;
    await withTenant(a.ctx, (tx) => tx.execute(sqlTag`UPDATE material SET stock = 999 WHERE tenant_id = ${b.id}`));
    await withTenant(a.ctx, (tx) => tx.execute(sqlTag`UPDATE activo_fijo SET valor = 1 WHERE tenant_id = ${b.id}`));
    expect(await adminSql()`SELECT stock FROM material WHERE tenant_id = ${b.id}`).toEqual(antes);
    expect((await adminSql()`SELECT valor FROM activo_fijo WHERE tenant_id = ${b.id}`)[0]!.valor).toBe("100.00");
  });

  it("el rol de la aplicación no puede borrar ninguna tabla financiera", async () => {
    const { a } = await dosJuntas();
    for (const t of TABLAS) {
      await expect(withTenant(a.ctx, (tx) => tx.execute(sqlTag.raw(`DELETE FROM ${t}`))), t).rejects.toThrow();
    }
  });
});
