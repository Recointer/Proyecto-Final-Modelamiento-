import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearSectorDirecto, crearSocioDirecto, crearUsuarioDirecto } from "./helpers";

/** Código del AppError que lanza una promesa, o SIN_ERROR. */
export async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "SIN_ERROR";
}

/** Dos juntas con un Tesorero/a, un sector y socios cada una. */
export async function escenarioFinanzas() {
  const a = await crearJuntaDirecta("junta-a", "Junta A");
  const b = await crearJuntaDirecta("junta-b", "Junta B");
  const norte = await crearSectorDirecto(a, "Norte");
  const sur = await crearSectorDirecto(a, "Sur");
  const secB = await crearSectorDirecto(b, "Norte");
  const tesA = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "tesorero" });
  const tesB = await crearUsuarioDirecto({ tenantId: b, cedula: "1710034065", rol: "tesorero" });
  const s1 = await crearSocioDirecto({ tenantId: a, sectorId: norte, cedula: "1710034065", nombres: "Ana Torres" });
  const s2 = await crearSocioDirecto({ tenantId: a, sectorId: norte, cedula: "1713175071", nombres: "Luis Mora" });
  const s3 = await crearSocioDirecto({ tenantId: a, sectorId: sur, cedula: "0102030405", nombres: "Eva Ruiz" });
  const sb = await crearSocioDirecto({ tenantId: b, sectorId: secB, cedula: "1710034065", nombres: "Socio de B" });
  return {
    a,
    b,
    norte,
    sur,
    s1,
    s2,
    s3,
    sb,
    tesA,
    ctxA: { role: "tenant" as const, tenantId: a, userId: tesA },
    ctxB: { role: "tenant" as const, tenantId: b, userId: tesB },
  };
}

export async function configurarMultas(tenantId: string, asamblea: number, minga: number) {
  await adminSql()`UPDATE junta SET parametros = ${adminSql().json({ multaAsamblea: asamblea, multaMinga: minga, quorumPorcentaje: 50 })} WHERE id = ${tenantId}`;
}

export async function eventoConAsistencia(o: {
  tenantId: string;
  creadoPor: string;
  tipo?: "asamblea" | "minga";
  fecha?: string;
  asistencias: { socioId: string; estado: "presente" | "ausente" | "justificado" }[];
}) {
  const sql = adminSql();
  const [e] = await sql`
    INSERT INTO evento (tenant_id, tipo, titulo, fecha, lugar, creado_por, asistencia_registrada_en)
    VALUES (${o.tenantId}, ${o.tipo ?? "asamblea"}, 'Asamblea con asistencia', ${o.fecha ?? "2026-03-10"}, 'Casa comunal', ${o.creadoPor}, now())
    RETURNING id`;
  for (const a of o.asistencias) {
    await sql`
      INSERT INTO asistencia (tenant_id, evento_id, socio_id, estado, motivo, registrado_por, modificado_por)
      VALUES (${o.tenantId}, ${e!.id}, ${a.socioId}, ${a.estado}, ${a.estado === "justificado" ? "Enfermedad" : null}, ${o.creadoPor}, ${o.creadoPor})`;
  }
  return e!.id as string;
}
