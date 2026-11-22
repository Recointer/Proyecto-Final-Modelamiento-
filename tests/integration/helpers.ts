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
