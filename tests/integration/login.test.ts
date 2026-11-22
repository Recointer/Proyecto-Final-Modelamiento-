import { describe, expect, it } from "vitest";
import { iniciarSesion } from "@/server/services/auth-service";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto, PASSWORD_PRUEBA } from "./helpers";

const CED_A = "1710034065";
const CED_B = "0926687856";

async function codigoDeError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "SIN_ERROR";
}

const entrada = (identificador: string, password = PASSWORD_PRUEBA, junta?: string) => ({
  identificador,
  password,
  junta,
  recordar: false,
});

describe("iniciarSesion", () => {
  it("permite ingresar con cédula o con correo", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_A, rol: "admin_junta", correo: "Ana@Correo.com" });

    const porCedula = await iniciarSesion(entrada(CED_A));
    expect(porCedula.rol).toBe("admin_junta");
    expect(porCedula.token.length).toBeGreaterThan(20);

    const porCorreo = await iniciarSesion(entrada("ana@correo.com"));
    expect(porCorreo.rol).toBe("admin_junta");
  });

  it("el super administrador ingresa sin identificador de junta", async () => {
    await crearUsuarioDirecto({ tenantId: null, cedula: CED_A, rol: "super_admin", correo: "root@plataforma.ec" });
    const s = await iniciarSesion(entrada("root@plataforma.ec"));
    expect(s.rol).toBe("super_admin");
  });

  it("responde con error genérico si la contraseña o el usuario son incorrectos", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_A, rol: "socio" });
    expect(await codigoDeError(iniciarSesion(entrada(CED_A, "otraClave999")))).toBe("CREDENCIALES_INVALIDAS");
    expect(await codigoDeError(iniciarSesion(entrada(CED_B)))).toBe("CREDENCIALES_INVALIDAS");
  });

  it("rechaza cuentas desactivadas y juntas desactivadas", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_A, rol: "socio", estado: "desactivado" });
    expect(await codigoDeError(iniciarSesion(entrada(CED_A)))).toBe("CUENTA_DESACTIVADA");

    const j2 = await crearJuntaDirecta("san-pedro");
    await crearUsuarioDirecto({ tenantId: j2, cedula: CED_B, rol: "socio" });
    await adminSql()`UPDATE junta SET estado = 'desactivada' WHERE id = ${j2}`;
    expect(await codigoDeError(iniciarSesion(entrada(CED_B)))).toBe("JUNTA_DESACTIVADA");
  });

  it("rechaza si el identificador de junta no corresponde a la cuenta", async () => {
    const a = await crearJuntaDirecta("junta-a");
    await crearJuntaDirecta("junta-b");
    await crearUsuarioDirecto({ tenantId: a, cedula: CED_A, rol: "socio" });
    expect(await codigoDeError(iniciarSesion(entrada(CED_A, PASSWORD_PRUEBA, "junta-b")))).toBe("CREDENCIALES_INVALIDAS");
    expect((await iniciarSesion(entrada(CED_A, PASSWORD_PRUEBA, "junta-a"))).rol).toBe("socio");
  });

  it("pide elegir junta si la misma cédula existe en dos juntas con la misma contraseña", async () => {
    const a = await crearJuntaDirecta("junta-a");
    const b = await crearJuntaDirecta("junta-b");
    await crearUsuarioDirecto({ tenantId: a, cedula: CED_A, rol: "socio" });
    await crearUsuarioDirecto({ tenantId: b, cedula: CED_A, rol: "socio" });
    try {
      await iniciarSesion(entrada(CED_A));
      expect.fail("debía pedir elegir junta");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).codigo).toBe("ELEGIR_JUNTA");
      expect((e as unknown as { juntas: unknown[] }).juntas).toHaveLength(2);
    }
  });

  it("bloquea la cuenta tras 5 intentos fallidos aunque luego la clave sea correcta", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_A, rol: "socio" });
    for (let i = 0; i < 5; i++) {
      await codigoDeError(iniciarSesion(entrada(CED_A, "incorrecta123")));
    }
    expect(await codigoDeError(iniciarSesion(entrada(CED_A)))).toBe("CUENTA_BLOQUEADA");
  });

  it("indica si debe cambiar la contraseña inicial", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_A, rol: "socio", debeCambiar: true });
    const s = await iniciarSesion(entrada(CED_A));
    expect(s.debeCambiarPassword).toBe(true);
  });

  it("la sesión dura más con 'mantener sesión activa'", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_A, rol: "socio" });
    const corta = await iniciarSesion(entrada(CED_A));
    const larga = await iniciarSesion({ ...entrada(CED_A), recordar: true });
    expect(larga.expiraEn.getTime()).toBeGreaterThan(corta.expiraEn.getTime() + 24 * 3600_000);
  });
});
