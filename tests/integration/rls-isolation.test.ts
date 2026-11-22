import { describe, expect, it } from "vitest";
import { sql as sqlTag } from "drizzle-orm";
import { withTenant } from "@/server/db/context";
import { sector, usuario } from "@/server/db/schema";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto } from "./helpers";

async function prepararDosJuntas() {
  const a = await crearJuntaDirecta("junta-a");
  const b = await crearJuntaDirecta("junta-b");
  await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "admin_junta" });
  await crearUsuarioDirecto({ tenantId: b, cedula: "0926687856", rol: "admin_junta" });
  await crearUsuarioDirecto({ tenantId: b, cedula: "1713175071", rol: "socio" });
  await adminSql()`INSERT INTO sector (tenant_id, nombre) VALUES (${a}, 'Norte'), (${b}, 'Sur')`;
  return { a, b };
}

describe("aislamiento por junta (RLS)", () => {
  it("un usuario de la junta A solo ve usuarios y sectores de A", async () => {
    const { a } = await prepararDosJuntas();
    const { usuarios, sectores } = await withTenant(
      { role: "tenant", tenantId: a, userId: "x" },
      async (tx) => ({
        usuarios: await tx.select().from(usuario),
        sectores: await tx.select().from(sector),
      }),
    );
    expect(usuarios).toHaveLength(1);
    expect(usuarios.every((u) => u.tenantId === a)).toBe(true);
    expect(sectores).toHaveLength(1);
    expect(sectores[0]?.nombre).toBe("Norte");
  });

  it("sin contexto de tenant las tablas de junta no devuelven filas", async () => {
    await prepararDosJuntas();
    const filas = await withTenant({ role: "tenant", tenantId: "", userId: "x" }, (tx) =>
      tx.select().from(usuario),
    ).catch(() => []);
    expect(filas).toHaveLength(0);
  });

  it("la junta A no puede insertar datos con el tenant_id de la junta B", async () => {
    const { a, b } = await prepararDosJuntas();
    await expect(
      withTenant({ role: "tenant", tenantId: a, userId: "x" }, (tx) =>
        tx.insert(sector).values({ tenantId: b, nombre: "Intruso" }),
      ),
    ).rejects.toThrow();
  });

  it("la junta A no puede modificar usuarios de la junta B", async () => {
    const { a, b } = await prepararDosJuntas();
    await withTenant({ role: "tenant", tenantId: a, userId: "x" }, (tx) =>
      tx.execute(sqlTag`UPDATE usuario SET nombres = 'hack' WHERE tenant_id = ${b}`),
    );
    const filas = await adminSql()`SELECT nombres FROM usuario WHERE tenant_id = ${b}`;
    expect(filas.every((f) => f.nombres !== "hack")).toBe(true);
  });

  it("el super_admin no ve socios ni sectores de las juntas", async () => {
    await prepararDosJuntas();
    const { usuarios, sectores } = await withTenant(
      { role: "super_admin", userId: "x" },
      async (tx) => ({
        usuarios: await tx.select().from(usuario),
        sectores: await tx.select().from(sector),
      }),
    );
    expect(sectores).toHaveLength(0);
    expect(usuarios.every((u) => u.rol === "admin_junta" || u.rol === "super_admin")).toBe(true);
  });

  it("el rol de la aplicación no puede modificar ni borrar la auditoría", async () => {
    await prepararDosJuntas();
    await withTenant({ role: "super_admin", userId: "x" }, (tx) =>
      tx.execute(sqlTag`INSERT INTO audit_log (accion, entidad) VALUES ('prueba', 'junta')`),
    );
    await expect(
      withTenant({ role: "super_admin", userId: "x" }, (tx) =>
        tx.execute(sqlTag`DELETE FROM audit_log`),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant({ role: "super_admin", userId: "x" }, (tx) =>
        tx.execute(sqlTag`UPDATE audit_log SET accion = 'x'`),
      ),
    ).rejects.toThrow();
  });
});
