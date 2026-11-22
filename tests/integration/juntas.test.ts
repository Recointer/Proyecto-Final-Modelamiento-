import { describe, expect, it } from "vitest";
import {
  crearJunta,
  desactivarJunta,
  editarJunta,
  obtenerJunta,
  reactivarJunta,
} from "@/server/services/junta-service";
import { iniciarSesion } from "@/server/services/auth-service";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto, PASSWORD_PRUEBA } from "./helpers";

const ctx = { role: "super_admin" as const, userId: "00000000-0000-0000-0000-000000000001" };

const base = {
  nombre: "Junta de Riego San Antonio",
  tipo: "riego" as const,
  provincia: "Pichincha",
  canton: "Quito",
  parroquia: "San Antonio",
};

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "SIN_ERROR";
}

describe("servicio de juntas (RF-01)", () => {
  it("crea una junta activa con identificador generado y auditoría", async () => {
    const j = await crearJunta(ctx, base);
    expect(j.estado).toBe("activa");
    expect(j.slug).toBe("junta-de-riego-san-antonio");
    const aud = await adminSql()`SELECT accion FROM audit_log WHERE entidad_id = ${j.id}`;
    expect(aud.map((a) => a.accion)).toContain("junta.crear");
  });

  it("genera identificadores únicos cuando el nombre se repite en otra parroquia", async () => {
    const a = await crearJunta(ctx, base);
    const b = await crearJunta(ctx, { ...base, parroquia: "Otra Parroquia" });
    expect(a.slug).not.toBe(b.slug);
  });

  it("rechaza duplicados (mismo nombre en la misma parroquia, sin distinguir mayúsculas)", async () => {
    await crearJunta(ctx, base);
    expect(await codigo(crearJunta(ctx, { ...base, nombre: "JUNTA DE RIEGO SAN ANTONIO", parroquia: "san antonio" }))).toBe(
      "JUNTA_DUPLICADA",
    );
  });

  it("rechaza un identificador ya usado", async () => {
    await crearJunta(ctx, { ...base, slug: "mi-junta" });
    expect(await codigo(crearJunta(ctx, { ...base, nombre: "Otra", parroquia: "X", slug: "mi-junta" }))).toBe(
      "SLUG_DUPLICADO",
    );
  });

  it("edita los datos y audita antes y después", async () => {
    const j = await crearJunta(ctx, base);
    const nueva = await editarJunta(ctx, j.id, { ...base, nombre: "Junta Renombrada", contactoCorreo: "a@b.com" });
    expect(nueva.nombre).toBe("Junta Renombrada");
    expect(nueva.slug).toBe(j.slug); // el identificador no cambia
    const [aud] = await adminSql()`SELECT antes, despues FROM audit_log WHERE accion = 'junta.editar'`;
    expect(aud?.antes.nombre).toBe(base.nombre);
    expect(aud?.despues.nombre).toBe("Junta Renombrada");
  });

  it("al editar no choca consigo misma pero sí con otra junta", async () => {
    const a = await crearJunta(ctx, base);
    const b = await crearJunta(ctx, { ...base, nombre: "Otra Junta" });
    await expect(editarJunta(ctx, a.id, { ...base, tipo: "barrial" })).resolves.toBeDefined();
    expect(await codigo(editarJunta(ctx, b.id, base))).toBe("JUNTA_DUPLICADA");
  });

  it("desactivar exige confirmación y conserva los datos", async () => {
    const j = await crearJunta(ctx, base);
    expect(await codigo(desactivarJunta(ctx, j.id, false))).toBe("CONFIRMACION_REQUERIDA");
    await crearUsuarioDirecto({ tenantId: j.id, cedula: "1710034065", rol: "socio" });
    await desactivarJunta(ctx, j.id, true);
    expect((await obtenerJunta(ctx, j.id))?.estado).toBe("desactivada");
    const usuarios = await adminSql()`SELECT 1 FROM usuario WHERE tenant_id = ${j.id}`;
    expect(usuarios).toHaveLength(1);
  });

  it("desactivar cierra las sesiones y bloquea el ingreso de sus usuarios", async () => {
    const id = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: id, cedula: "1710034065", rol: "socio" });
    const entrada = { identificador: "1710034065", password: PASSWORD_PRUEBA, recordar: false };
    await iniciarSesion(entrada);
    expect(await adminSql()`SELECT 1 FROM sesion WHERE tenant_id = ${id}`).toHaveLength(1);

    await desactivarJunta(ctx, id, true);
    expect(await adminSql()`SELECT 1 FROM sesion WHERE tenant_id = ${id}`).toHaveLength(0);
    expect(await codigo(iniciarSesion(entrada))).toBe("JUNTA_DESACTIVADA");
  });

  it("reactivar devuelve el acceso con los datos intactos", async () => {
    const id = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: id, cedula: "1710034065", rol: "socio" });
    await desactivarJunta(ctx, id, true);
    await reactivarJunta(ctx, id);
    const s = await iniciarSesion({ identificador: "1710034065", password: PASSWORD_PRUEBA, recordar: false });
    expect(s.rol).toBe("socio");
    const acciones = (await adminSql()`SELECT accion FROM audit_log`).map((a) => a.accion);
    expect(acciones).toEqual(expect.arrayContaining(["junta.desactivar", "junta.reactivar"]));
  });

  it("operar sobre una junta inexistente da error claro", async () => {
    const inexistente = "11111111-1111-1111-1111-111111111111";
    expect(await codigo(editarJunta(ctx, inexistente, base))).toBe("JUNTA_NO_ENCONTRADA");
    expect(await codigo(desactivarJunta(ctx, inexistente, true))).toBe("JUNTA_NO_ENCONTRADA");
  });
});
