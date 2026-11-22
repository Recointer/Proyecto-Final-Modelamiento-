import type { Db } from "../db/context";
import { auditLog } from "../db/schema";

export interface EntradaAuditoria {
  actorId?: string | null;
  tenantId?: string | null;
  accion: string; // p. ej. junta.crear, junta.desactivar, admin.cambiar, usuario.crear
  entidad: string;
  entidadId?: string | null;
  antes?: unknown;
  despues?: unknown;
}

/** Registra la auditoría dentro de la misma transacción de la operación (append-only). */
export async function auditar(tx: Db, e: EntradaAuditoria): Promise<void> {
  await tx.insert(auditLog).values({
    actorId: e.actorId ?? null,
    tenantId: e.tenantId ?? null,
    accion: e.accion,
    entidad: e.entidad,
    entidadId: e.entidadId ?? null,
    antes: e.antes ?? null,
    despues: e.despues ?? null,
  });
}
