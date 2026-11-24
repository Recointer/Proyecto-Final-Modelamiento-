import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { migrate } from "@/server/db/migrate";
import { closeDb } from "@/server/db/context";

if (existsSync(".env.test")) process.loadEnvFile(".env.test");

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
const appUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error(
    "Defina TEST_DATABASE_ADMIN_URL y TEST_DATABASE_URL (ver .env.example) para las pruebas de integración",
  );
}

process.env.DATABASE_URL = appUrl;
process.env.DATABASE_ADMIN_URL = adminUrl;
process.env.FILE_STORE_DIR = path.join(os.tmpdir(), "multijunta-test-storage");

let admin: postgres.Sql;

beforeAll(async () => {
  const nombreBd = new URL(adminUrl).pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*$/.test(nombreBd) || !nombreBd.includes("test")) {
    throw new Error("La base de pruebas debe llamarse con 'test' (p. ej. multijunta_test)");
  }
  const raiz = new URL(adminUrl);
  raiz.pathname = "/postgres";
  const sqlRaiz = postgres(raiz.toString(), { max: 1, onnotice: () => {} });
  const existe = await sqlRaiz`SELECT 1 FROM pg_database WHERE datname = ${nombreBd}`;
  if (existe.length === 0) await sqlRaiz.unsafe(`CREATE DATABASE ${nombreBd}`);
  await sqlRaiz.end();

  await migrate(adminUrl, appUrl);
  admin = postgres(adminUrl, { max: 2, onnotice: () => {} });
});

beforeEach(async () => {
  await admin.unsafe(
    "TRUNCATE pago, contador_comprobante, cargo, concepto_cobro, egreso, movimiento_material, material, activo_fijo, asistencia, turno, predio, servicio, evento, socio, audit_log, token_recuperacion, sesion, designacion_administrador, sector, usuario, junta CASCADE",
  );
});

afterAll(async () => {
  await closeDb();
  await admin?.end();
});

export function adminSql(): postgres.Sql {
  return admin;
}
