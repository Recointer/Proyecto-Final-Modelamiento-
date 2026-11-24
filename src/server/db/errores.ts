/** Código SQLSTATE y nombre de restricción de un error de PostgreSQL (Drizzle lo envuelve en `cause`). */
export function codigoPg(e: unknown): { codigo?: string; restriccion?: string } {
  const c = ((e as { cause?: unknown })?.cause ?? e) as { code?: string; constraint_name?: string };
  return { codigo: c?.code, restriccion: c?.constraint_name };
}
