import postgres from "postgres";

/**
 * Borra de la base de DESARROLLO las juntas que dejan las pruebas E2E (y todo lo que cuelga de ellas).
 * Solo toca juntas cuyo nombre empieza por "Junta E2E ", "Junta Admin ", "Junta Prueba " o
 * "Junta Renombrada ". Se niega a ejecutarse contra una base que no se llame "multijunta".
 */
const PATRON = "^Junta (E2E|Admin|Prueba|Renombrada) ";

async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("Falta DATABASE_ADMIN_URL");
  const bd = new URL(url).pathname.slice(1);
  if (bd !== "multijunta") throw new Error(`Solo se limpia la base "multijunta" (recibida: "${bd}")`);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      const ids = (await tx`SELECT id FROM junta WHERE nombre ~ ${PATRON}`).map((r) => r.id as string);
      if (ids.length === 0) {
        console.log("No hay juntas de prueba que borrar.");
        return;
      }
      await tx`DELETE FROM sesion WHERE tenant_id = ANY(${ids})`;
      await tx`DELETE FROM token_recuperacion WHERE usuario_id IN (SELECT id FROM usuario WHERE tenant_id = ANY(${ids}))`;
      await tx`DELETE FROM designacion_administrador WHERE junta_id = ANY(${ids})`;
      await tx`DELETE FROM sector WHERE tenant_id = ANY(${ids})`;
      await tx`DELETE FROM usuario WHERE tenant_id = ANY(${ids})`;
      await tx`DELETE FROM audit_log WHERE tenant_id = ANY(${ids}) OR entidad_id = ANY(${ids})`;
      await tx`DELETE FROM junta WHERE id = ANY(${ids})`;
      console.log(`Juntas de prueba borradas: ${ids.length}`);
    });
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
