import { closeDb, withTenant } from "./context";
import { junta, usuario } from "./schema";
import { hashPassword, validarFortaleza } from "../auth/password";
import { validarCedula } from "../validation/cedula";
import { and, eq, isNull } from "drizzle-orm";

/** Crea el Super Administrador inicial (por variables de entorno) y dos juntas de ejemplo. */
async function main() {
  const cedula = process.env.SEED_SUPERADMIN_CEDULA;
  const correo = process.env.SEED_SUPERADMIN_CORREO;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!cedula || !correo || !password) {
    throw new Error("Defina SEED_SUPERADMIN_CEDULA, SEED_SUPERADMIN_CORREO y SEED_SUPERADMIN_PASSWORD");
  }
  if (!validarCedula(cedula)) throw new Error("SEED_SUPERADMIN_CEDULA no es una cédula válida");
  if (!validarFortaleza(password)) throw new Error("SEED_SUPERADMIN_PASSWORD es débil");

  await withTenant({ role: "super_admin", userId: "seed" }, async (tx) => {
    const existe = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.rol, "super_admin"), isNull(usuario.tenantId)))
      .limit(1);
    if (existe.length === 0) {
      await tx.insert(usuario).values({
        cedula,
        correo,
        nombres: "Super Administrador",
        rol: "super_admin",
        tenantId: null,
        passwordHash: await hashPassword(password),
      });
      console.log("Super Administrador creado");
    }

    // en producción (SEED_SOLO_SUPERADMIN=1) no se crean las juntas de ejemplo
    if (process.env.SEED_SOLO_SUPERADMIN === "1") return;
    await tx
      .insert(junta)
      .values([
        {
          slug: "san-antonio",
          nombre: "Junta de Riego San Antonio",
          tipo: "riego",
          provincia: "Pichincha",
          canton: "Quito",
          parroquia: "San Antonio",
        },
        {
          slug: "san-pedro",
          nombre: "Junta Parroquial San Pedro",
          tipo: "parroquial",
          provincia: "Tungurahua",
          canton: "Ambato",
          parroquia: "San Pedro",
        },
      ])
      .onConflictDoNothing();
  });
}

main()
  .then(() => console.log("Seed completo"))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
