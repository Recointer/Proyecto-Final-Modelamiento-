import { and, eq } from "drizzle-orm";
import { withTenant, type Db, type DbContext } from "../db/context";
import { socio, type Socio } from "../db/schema";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

/**
 * Padrón ↔ cuenta: se vinculan por la MISMA cédula dentro de la junta (sin clave foránea).
 * El socio de un usuario siempre se deriva de la sesión, nunca viene del cliente (FR-021).
 * Devuelve null si la cédula del usuario todavía no figura en el padrón.
 */
export async function socioDeSesionTx(tx: Db, ctx: CtxTenant, user: { cedula: string }): Promise<Socio | null> {
  const [s] = await tx
    .select()
    .from(socio)
    .where(and(eq(socio.tenantId, ctx.tenantId), eq(socio.cedula, user.cedula)))
    .limit(1);
  return s ?? null;
}

export async function socioDeSesion(ctx: CtxTenant, user: { cedula: string }): Promise<Socio | null> {
  return withTenant(ctx, (tx) => socioDeSesionTx(tx, ctx, user));
}
