import { beforeEach, describe, expect, it } from "vitest";
import { setMailer, type Correo } from "@/server/mail/mailer";
import {
  cambiarPasswordInicial,
  restablecerPassword,
  solicitarRecuperacion,
} from "@/server/services/password-service";
import { iniciarSesion } from "@/server/services/auth-service";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto, PASSWORD_PRUEBA } from "./helpers";

const CED = "1710034065";
let enviados: Correo[] = [];

beforeEach(() => {
  enviados = [];
  setMailer({ enviar: async (c) => void enviados.push(c) });
});

function tokenDelCorreo(c: Correo): string {
  const m = /token=([\w-]+)/.exec(c.texto);
  if (!m?.[1]) throw new Error("sin token");
  return m[1];
}

describe("recuperación de contraseña", () => {
  it("envía un enlace y permite restablecer una sola vez", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const id = await crearUsuarioDirecto({ tenantId: j, cedula: CED, rol: "socio", correo: "ana@correo.com" });

    await solicitarRecuperacion("ana@correo.com");
    expect(enviados).toHaveLength(1);
    const token = tokenDelCorreo(enviados[0]!);

    await restablecerPassword(token, "NuevaClave2026");
    const s = await iniciarSesion({ identificador: CED, password: "NuevaClave2026", recordar: false });
    expect(s.rol).toBe("socio");

    await expect(restablecerPassword(token, "OtraClave2026x")).rejects.toMatchObject({ codigo: "TOKEN_INVALIDO" });
    const [fila] = await adminSql()`SELECT usado_en FROM token_recuperacion WHERE usuario_id = ${id}`;
    expect(fila?.usado_en).not.toBeNull();
  });

  it("responde igual (sin enviar nada) si la cuenta no existe", async () => {
    await expect(solicitarRecuperacion("nadie@correo.com")).resolves.toBeUndefined();
    expect(enviados).toHaveLength(0);
  });

  it("no envía correo a cuentas desactivadas", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED, rol: "socio", correo: "ana@correo.com", estado: "desactivado" });
    await solicitarRecuperacion("ana@correo.com");
    expect(enviados).toHaveLength(0);
  });

  it("rechaza tokens vencidos y contraseñas débiles", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const id = await crearUsuarioDirecto({ tenantId: j, cedula: CED, rol: "socio", correo: "ana@correo.com" });
    await solicitarRecuperacion("ana@correo.com");
    const token = tokenDelCorreo(enviados[0]!);

    await expect(restablecerPassword(token, "corta")).rejects.toMatchObject({ codigo: "PASSWORD_DEBIL" });

    await adminSql()`UPDATE token_recuperacion SET expira_en = now() - interval '1 minute' WHERE usuario_id = ${id}`;
    await expect(restablecerPassword(token, "NuevaClave2026")).rejects.toBeInstanceOf(AppError);
  });

  it("restablecer cierra las sesiones activas y desbloquea la cuenta", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const id = await crearUsuarioDirecto({ tenantId: j, cedula: CED, rol: "socio", correo: "ana@correo.com" });
    await iniciarSesion({ identificador: CED, password: PASSWORD_PRUEBA, recordar: false });
    await adminSql()`UPDATE usuario SET intentos_fallidos = 3 WHERE id = ${id}`;
    await solicitarRecuperacion("ana@correo.com");
    await restablecerPassword(tokenDelCorreo(enviados[0]!), "NuevaClave2026");

    const sesiones = await adminSql()`SELECT 1 FROM sesion WHERE usuario_id = ${id}`;
    expect(sesiones).toHaveLength(0);
    const [u] = await adminSql()`SELECT intentos_fallidos FROM usuario WHERE id = ${id}`;
    expect(u?.intentos_fallidos).toBe(0);
  });

  it("cambia la contraseña inicial y quita la marca de cambio obligatorio", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const id = await crearUsuarioDirecto({ tenantId: j, cedula: CED, rol: "socio", debeCambiar: true });
    await cambiarPasswordInicial(id, "ClavePropia2026");
    const s = await iniciarSesion({ identificador: CED, password: "ClavePropia2026", recordar: false });
    expect(s.debeCambiarPassword).toBe(false);
  });
});
