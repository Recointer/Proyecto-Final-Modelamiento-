import { hashPassword } from "@/server/auth/password";
import { adminSql } from "./setup";

export const PASSWORD_PRUEBA = "ClavePrueba123";

export async function crearJuntaDirecta(slug: string, nombre = `Junta ${slug}`) {
  const sql = adminSql();
  const [j] = await sql`
    INSERT INTO junta (slug, nombre, tipo, provincia, canton, parroquia)
    VALUES (${slug}, ${nombre}, 'riego', 'Pichincha', 'Quito', ${`Parroquia ${slug}`})
    RETURNING id`;
  return j!.id as string;
}

export async function crearUsuarioDirecto(o: {
  tenantId: string | null;
  cedula: string;
  rol: "super_admin" | "admin_junta" | "secretario" | "tesorero" | "socio";
  correo?: string;
  estado?: "activo" | "desactivado";
  debeCambiar?: boolean;
  password?: string;
}) {
  const sql = adminSql();
  const hash = await hashPassword(o.password ?? PASSWORD_PRUEBA);
  const [u] = await sql`
    INSERT INTO usuario (tenant_id, cedula, nombres, correo, rol, estado, password_hash, debe_cambiar_password)
    VALUES (${o.tenantId}, ${o.cedula}, ${`Usuario ${o.cedula}`}, ${o.correo ?? null}, ${o.rol},
            ${o.estado ?? "activo"}, ${hash}, ${o.debeCambiar ?? false})
    RETURNING id`;
  return u!.id as string;
}

// ---------------------------------------------------------------------------------------------
// Ayudantes del módulo administrativo (conexión administradora: no pasan por RLS)
// ---------------------------------------------------------------------------------------------

export async function crearSectorDirecto(tenantId: string, nombre = "Sector Norte") {
  const sql = adminSql();
  const [s] = await sql`INSERT INTO sector (tenant_id, nombre) VALUES (${tenantId}, ${nombre}) RETURNING id`;
  return s!.id as string;
}

export async function crearSocioDirecto(o: {
  tenantId: string;
  sectorId: string;
  cedula: string;
  nombres?: string;
  correo?: string | null;
  estado?: "activo" | "inactivo";
  fechaIngreso?: string;
}) {
  const sql = adminSql();
  const [s] = await sql`
    INSERT INTO socio (tenant_id, cedula, nombres, sector_id, correo, estado, fecha_ingreso)
    VALUES (${o.tenantId}, ${o.cedula}, ${o.nombres ?? `Socio ${o.cedula}`}, ${o.sectorId}, ${o.correo ?? null},
            ${o.estado ?? "activo"}, ${o.fechaIngreso ?? "2020-01-01"})
    RETURNING id`;
  return s!.id as string;
}

export async function crearEventoDirecto(o: {
  tenantId: string;
  creadoPor: string;
  tipo?: "asamblea" | "minga";
  titulo?: string;
  fecha?: string;
  estado?: "activo" | "anulado";
}) {
  const sql = adminSql();
  const anulado = o.estado === "anulado";
  const [e] = await sql`
    INSERT INTO evento (tenant_id, tipo, titulo, fecha, lugar, estado, motivo_anulacion, anulado_por, anulado_en, creado_por)
    VALUES (${o.tenantId}, ${o.tipo ?? "asamblea"}, ${o.titulo ?? "Asamblea de prueba"}, ${o.fecha ?? "2026-01-15"}, 'Casa comunal',
            ${o.estado ?? "activo"}, ${anulado ? "Anulado en prueba" : null}, ${anulado ? o.creadoPor : null},
            ${anulado ? new Date() : null}, ${o.creadoPor})
    RETURNING id`;
  return e!.id as string;
}

export async function crearPredioDirecto(o: {
  tenantId: string;
  sectorId: string;
  socioId: string;
  codigo?: string;
  nombre?: string;
  superficieHa?: number;
  latitud?: number | null;
  longitud?: number | null;
}) {
  const sql = adminSql();
  const [p] = await sql`
    INSERT INTO predio (tenant_id, codigo, nombre, superficie_ha, sector_id, socio_id, latitud, longitud)
    VALUES (${o.tenantId}, ${o.codigo ?? "P-001"}, ${o.nombre ?? "Parcela de prueba"}, ${o.superficieHa ?? 1.25},
            ${o.sectorId}, ${o.socioId}, ${o.latitud ?? null}, ${o.longitud ?? null})
    RETURNING id`;
  return p!.id as string;
}

export async function crearServicioDirecto(tenantId: string, nombre = "Riego principal") {
  const sql = adminSql();
  const [s] = await sql`INSERT INTO servicio (tenant_id, nombre, tipo) VALUES (${tenantId}, ${nombre}, 'agua_riego') RETURNING id`;
  return s!.id as string;
}

export async function crearTurnoDirecto(o: {
  tenantId: string;
  servicioId: string;
  sectorId: string;
  diaSemana?: number;
  horaInicio?: string;
  horaFin?: string;
}) {
  const sql = adminSql();
  const [t] = await sql`
    INSERT INTO turno (tenant_id, servicio_id, sector_id, dia_semana, hora_inicio, hora_fin)
    VALUES (${o.tenantId}, ${o.servicioId}, ${o.sectorId}, ${o.diaSemana ?? 2}, ${o.horaInicio ?? "20:00"}, ${o.horaFin ?? "22:00"})
    RETURNING id`;
  return t!.id as string;
}
