import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

/** Contexto de la petición para RLS (ver drizzle/0001_rls.sql). */
export type DbContext =
  | { role: "auth" }
  | { role: "super_admin"; userId: string }
  | { role: "tenant"; tenantId: string; userId: string };

export type Db = PostgresJsDatabase<typeof schema>;

// El cliente se guarda en globalThis: en desarrollo la recarga en caliente reevalúa este módulo y,
// sin esto, cada recarga abriría un pool nuevo sin cerrar el anterior (fuga de conexiones).
const g = globalThis as unknown as { __multijuntaClient?: postgres.Sql; __multijuntaDb?: Db };

function getDb(): Db {
  if (!g.__multijuntaDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta DATABASE_URL");
    g.__multijuntaClient = postgres(url, { max: 10, onnotice: () => {} });
    g.__multijuntaDb = drizzle(g.__multijuntaClient, { schema });
  }
  return g.__multijuntaDb;
}

/** Cierra el pool (pruebas y scripts). */
export async function closeDb(): Promise<void> {
  if (g.__multijuntaClient) await g.__multijuntaClient.end();
  g.__multijuntaClient = undefined;
  g.__multijuntaDb = undefined;
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto RLS fijado.
 * Sin contexto las tablas de junta no devuelven filas (Principio I).
 */
export async function withTenant<T>(ctx: DbContext, fn: (tx: Db) => Promise<T>): Promise<T> {
  const tenantId = ctx.role === "tenant" ? ctx.tenantId : "";
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.role', ${ctx.role}, true), set_config('app.tenant_id', ${tenantId}, true)`,
    );
    return fn(tx as unknown as Db);
  });
}
