import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Ejecuta las migraciones SQL de /drizzle con el rol administrador y crea el rol de la aplicación
 * (sin BYPASSRLS, no propietario) a partir de DATABASE_URL.
 */
export async function migrate(adminUrl: string, appUrl: string): Promise<void> {
  const app = new URL(appUrl);
  const appUser = decodeURIComponent(app.username);
  const appPassword = decodeURIComponent(app.password);
  if (!/^[a-z_][a-z0-9_]*$/.test(appUser)) throw new Error("Nombre de rol de la app no válido");

  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`CREATE TABLE IF NOT EXISTS _migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`;

    const existe = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${appUser}`;
    if (existe.length === 0) {
      await sql.unsafe(
        `CREATE ROLE ${appUser} LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      );
    }

    const dir = path.resolve(process.cwd(), "drizzle");
    const archivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const archivo of archivos) {
      const hecha = await sql`SELECT 1 FROM _migraciones WHERE nombre = ${archivo}`;
      if (hecha.length > 0) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(path.join(dir, archivo), "utf8"));
        await tx`INSERT INTO _migraciones (nombre) VALUES (${archivo})`;
      });
      console.log(`Migración aplicada: ${archivo}`);
    }

    // Permisos del rol de la aplicación (auditoría: solo INSERT y SELECT)
    await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${appUser}`);
    await sql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON junta, usuario, sector, designacion_administrador, sesion, token_recuperacion TO ${appUser}`,
    );
    await sql.unsafe(`GRANT SELECT, INSERT ON audit_log TO ${appUser}`);
    // módulo administrativo: sin DELETE (bajas lógicas); solo los turnos se eliminan
    await sql.unsafe(`GRANT SELECT, INSERT, UPDATE ON socio, evento, asistencia, predio, servicio TO ${appUser}`);
    await sql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON turno TO ${appUser}`);
    // módulo de comunicaciones: sin DELETE y con UPDATE solo en las columnas que cambian (inmutabilidad)
    await sql.unsafe(`GRANT SELECT, INSERT ON convocatoria, documento, comunicacion_recibida, hilo, mensaje TO ${appUser}`);
    await sql.unsafe(
      `GRANT UPDATE (estado, anulado_por, anulado_en, motivo_anulacion, notificados) ON convocatoria TO ${appUser}`,
    );
    await sql.unsafe(`GRANT UPDATE (publicado, estado, anulado_por, anulado_en, motivo_anulacion) ON documento TO ${appUser}`);
    await sql.unsafe(
      `GRANT UPDATE (publicada, estado, anulado_por, anulado_en, motivo_anulacion) ON comunicacion_recibida TO ${appUser}`,
    );
    await sql.unsafe(`GRANT UPDATE (ultimo_mensaje_en) ON hilo TO ${appUser}`);
    await sql.unsafe(`GRANT UPDATE (leido_en) ON mensaje TO ${appUser}`);
    // módulo financiero: sin DELETE (los registros se anulan); los movimientos son solo de inserción
    await sql.unsafe(
      `GRANT SELECT, INSERT, UPDATE ON concepto_cobro, cargo, pago, contador_comprobante, egreso, material, activo_fijo TO ${appUser}`,
    );
    await sql.unsafe(`GRANT SELECT, INSERT ON movimiento_material TO ${appUser}`);
    await sql.unsafe(`GRANT SELECT ON cargo_saldo TO ${appUser}`);
    await sql.unsafe(`GRANT EXECUTE ON FUNCTION total_pagos_plataforma() TO ${appUser}`);
    await sql.unsafe(`GRANT EXECUTE ON FUNCTION total_eventos_plataforma() TO ${appUser}`);
    await sql.unsafe(`GRANT EXECUTE ON FUNCTION eventos_plataforma_por_dia(integer, integer) TO ${appUser}`);
    await sql.unsafe(`GRANT EXECUTE ON FUNCTION degradar_administrador(uuid, uuid) TO ${appUser}`);
    await sql.unsafe(`GRANT EXECUTE ON FUNCTION revocar_sesiones_usuario(uuid) TO ${appUser}`);
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const admin = process.env.DATABASE_ADMIN_URL;
  const app = process.env.DATABASE_URL;
  if (!admin || !app) throw new Error("Faltan DATABASE_ADMIN_URL o DATABASE_URL");
  migrate(admin, app).then(() => console.log("Migraciones completas"));
}
