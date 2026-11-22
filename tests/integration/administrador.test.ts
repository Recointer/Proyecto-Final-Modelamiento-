import { beforeEach, describe, expect, it } from "vitest";
import {
  asignarAdministrador,
  cambiarAdministrador,
  obtenerAdministradorActual,
} from "@/server/services/administrador-service";
import { iniciarSesion } from "@/server/services/auth-service";
import { setMailer, type Correo } from "@/server/mail/mailer";
import { AppError } from "@/lib/result";
import type { EntradaCambiarAdministrador } from "@/server/validation/administrador";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto } from "./helpers";

const CED_ADMIN = "1710034065";
const CED_NUEVO = "0926687856";
const CED_SOCIO = "1713175071";

const PDF = new TextEncoder().encode("%PDF-1.4\n% acta de prueba\n");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

let ctx: { role: "super_admin"; userId: string };
let correos: Correo[] = [];

beforeEach(async () => {
  correos = [];
  setMailer({ enviar: async (c) => void correos.push(c) });
  const id = await crearUsuarioDirecto({ tenantId: null, cedula: "1710034065", rol: "super_admin", correo: "root@plataforma.ec" });
  ctx = { role: "super_admin", userId: id };
});

async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "SIN_ERROR";
}

const datos = (juntaId: string, extra: Partial<EntradaCambiarAdministrador> = {}) => ({
  juntaId,
  cedula: CED_ADMIN,
  nombres: "María Fernanda Quishpe",
  correo: "maria@correo.com",
  acta: PDF,
  ...extra,
});

describe("asignar administrador (RF-04)", () => {
  it("crea el administrador con credencial inicial, designación vigente y auditoría", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const r = await asignarAdministrador(ctx, datos(j));

    expect(r.credencialInicial.length).toBeGreaterThanOrEqual(10);
    expect(r.correoEnviado).toBe(true);
    expect(correos[0]?.para).toBe("maria@correo.com");
    expect(correos[0]?.texto).toContain("san-antonio");

    const [u] = await adminSql()`SELECT rol, debe_cambiar_password, tenant_id FROM usuario WHERE id = ${r.usuarioId}`;
    expect(u).toMatchObject({ rol: "admin_junta", debe_cambiar_password: true, tenant_id: j });

    const des = await adminSql()`SELECT vigente, acta_ruta, designado_por FROM designacion_administrador WHERE junta_id = ${j}`;
    expect(des).toHaveLength(1);
    expect(des[0]).toMatchObject({ vigente: true, designado_por: ctx.userId });
    expect(des[0]?.acta_ruta).toMatch(/^actas\/.+\.pdf$/);

    const aud = await adminSql()`SELECT accion, tenant_id FROM audit_log WHERE accion = 'admin.asignar'`;
    expect(aud).toHaveLength(1);
    expect(aud[0]?.tenant_id).toBe(j);
  });

  it("el nuevo administrador puede ingresar y debe cambiar su contraseña", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const r = await asignarAdministrador(ctx, datos(j));
    const s = await iniciarSesion({ junta: "san-antonio", identificador: CED_ADMIN, password: r.credencialInicial, recordar: false });
    expect(s.rol).toBe("admin_junta");
    expect(s.debeCambiarPassword).toBe(true);
  });

  it("acepta imágenes como acta", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await expect(asignarAdministrador(ctx, datos(j, { acta: PNG }))).resolves.toBeDefined();
  });

  it("rechaza cédula inválida, correo inválido y nombres vacíos", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    expect(await codigo(asignarAdministrador(ctx, datos(j, { cedula: "1710034066" })))).toBe("CEDULA_INVALIDA");
    expect(await codigo(asignarAdministrador(ctx, datos(j, { correo: "no-es-correo" })))).toBe("DATOS_INVALIDOS");
    expect(await codigo(asignarAdministrador(ctx, datos(j, { nombres: " " })))).toBe("DATOS_INVALIDOS");
    expect(await adminSql()`SELECT 1 FROM usuario WHERE tenant_id = ${j}`).toHaveLength(0);
  });

  it("rechaza actas que no son PDF/imagen, vacías o de más de 5 MB", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    const texto = new TextEncoder().encode("esto es texto plano");
    expect(await codigo(asignarAdministrador(ctx, datos(j, { acta: texto })))).toBe("ACTA_INVALIDA");
    expect(await codigo(asignarAdministrador(ctx, datos(j, { acta: new Uint8Array(0) })))).toBe("ACTA_INVALIDA");
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(PDF);
    expect(await codigo(asignarAdministrador(ctx, datos(j, { acta: grande })))).toBe("ACTA_INVALIDA");
  });

  it("rechaza una segunda asignación si la junta ya tiene administrador", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await asignarAdministrador(ctx, datos(j));
    expect(await codigo(asignarAdministrador(ctx, datos(j, { cedula: CED_NUEVO, correo: "otro@correo.com" })))).toBe(
      "JUNTA_YA_TIENE_ADMIN",
    );
  });

  it("rechaza una junta inexistente", async () => {
    expect(await codigo(asignarAdministrador(ctx, datos("11111111-1111-1111-1111-111111111111")))).toBe("JUNTA_NO_ENCONTRADA");
  });

  it("rechaza una cédula que ya tiene cuenta en esa junta (sin revelar datos del socio)", async () => {
    const j = await crearJuntaDirecta("san-antonio");
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_SOCIO, rol: "socio", correo: "socio@correo.com" });
    expect(await codigo(asignarAdministrador(ctx, datos(j, { cedula: CED_SOCIO })))).toBe("CEDULA_DUPLICADA");
    // la operación no dejó rastros
    expect(await adminSql()`SELECT 1 FROM designacion_administrador WHERE junta_id = ${j}`).toHaveLength(0);
  });

  it("la misma cédula puede ser administrador en dos juntas distintas", async () => {
    const a = await crearJuntaDirecta("junta-a");
    const b = await crearJuntaDirecta("junta-b");
    await asignarAdministrador(ctx, datos(a));
    await expect(asignarAdministrador(ctx, datos(b))).resolves.toBeDefined();
  });

  it("si falla el envío del correo, la designación se conserva y se informa", async () => {
    setMailer({ enviar: async () => Promise.reject(new Error("SMTP caído")) });
    const j = await crearJuntaDirecta("san-antonio");
    const r = await asignarAdministrador(ctx, datos(j));
    expect(r.correoEnviado).toBe(false);
    expect(r.credencialInicial).toBeTruthy();
    expect(await adminSql()`SELECT 1 FROM usuario WHERE tenant_id = ${j} AND rol = 'admin_junta'`).toHaveLength(1);
  });
});

describe("cambiar administrador (RF-04)", () => {
  async function juntaConAdmin() {
    const j = await crearJuntaDirecta("san-antonio");
    const r = await asignarAdministrador(ctx, datos(j));
    return { j, anteriorId: r.usuarioId, credencialAnterior: r.credencialInicial };
  }

  const nuevo = (juntaId: string, extra: Partial<EntradaCambiarAdministrador> = {}): EntradaCambiarAdministrador => ({
    ...datos(juntaId),
    cedula: CED_NUEVO,
    nombres: "Luis Alberto Tapia",
    correo: "luis@correo.com",
    motivo: "Renuncia del administrador",
    ...extra,
  });

  it("el anterior pasa a socio, pierde sus sesiones y el nuevo queda como administrador", async () => {
    const { j, anteriorId, credencialAnterior } = await juntaConAdmin();
    await iniciarSesion({ junta: "san-antonio", identificador: CED_ADMIN, password: credencialAnterior, recordar: false });
    expect(await adminSql()`SELECT 1 FROM sesion WHERE usuario_id = ${anteriorId}`).toHaveLength(1);

    const r = await cambiarAdministrador(ctx, nuevo(j));

    const [anterior] = await adminSql()`SELECT rol, estado FROM usuario WHERE id = ${anteriorId}`;
    expect(anterior).toMatchObject({ rol: "socio", estado: "activo" });
    expect(await adminSql()`SELECT 1 FROM sesion WHERE usuario_id = ${anteriorId}`).toHaveLength(0);

    const [actual] = await adminSql()`SELECT rol FROM usuario WHERE id = ${r.usuarioId}`;
    expect(actual?.rol).toBe("admin_junta");

    const admins = await adminSql()`SELECT 1 FROM usuario WHERE tenant_id = ${j} AND rol = 'admin_junta' AND estado = 'activo'`;
    expect(admins).toHaveLength(1);
  });

  it("deja una sola designación vigente y conserva el historial con el motivo", async () => {
    const { j } = await juntaConAdmin();
    await cambiarAdministrador(ctx, nuevo(j));
    const des = await adminSql()`SELECT vigente, motivo FROM designacion_administrador WHERE junta_id = ${j} ORDER BY creada_en`;
    expect(des).toHaveLength(2);
    expect(des[0]?.vigente).toBe(false);
    expect(des[1]).toMatchObject({ vigente: true, motivo: "Renuncia del administrador" });
  });

  it("registra quién, cuándo y por qué en la auditoría", async () => {
    const { j, anteriorId } = await juntaConAdmin();
    await cambiarAdministrador(ctx, nuevo(j));
    const [a] = await adminSql()`SELECT actor_id, antes, despues, creado_en, tenant_id FROM audit_log WHERE accion = 'admin.cambiar'`;
    expect(a?.actor_id).toBe(ctx.userId);
    expect(a?.tenant_id).toBe(j);
    expect(a?.antes.administradorId).toBe(anteriorId);
    expect(a?.despues.motivo).toBe("Renuncia del administrador");
    expect(a?.creado_en).toBeInstanceOf(Date);
  });

  it("el anterior administrador sigue pudiendo ingresar, ahora como socio", async () => {
    const { j, credencialAnterior } = await juntaConAdmin();
    await cambiarAdministrador(ctx, nuevo(j));
    const s = await iniciarSesion({
      junta: "san-antonio",
      identificador: CED_ADMIN,
      password: credencialAnterior,
      recordar: false,
    });
    expect(s.rol).toBe("socio");
  });

  it("exige motivo", async () => {
    const { j } = await juntaConAdmin();
    expect(await codigo(cambiarAdministrador(ctx, nuevo(j, { motivo: "  " })))).toBe("MOTIVO_REQUERIDO");
    expect(await codigo(cambiarAdministrador(ctx, nuevo(j, { motivo: "abc" })))).toBe("MOTIVO_REQUERIDO");
  });

  it("valida cédula y acta del nuevo administrador y no cambia nada si falla", async () => {
    const { j, anteriorId } = await juntaConAdmin();
    expect(await codigo(cambiarAdministrador(ctx, nuevo(j, { cedula: "1234567890" })))).toBe("CEDULA_INVALIDA");
    expect(await codigo(cambiarAdministrador(ctx, nuevo(j, { acta: new TextEncoder().encode("texto") })))).toBe("ACTA_INVALIDA");
    const [u] = await adminSql()`SELECT rol FROM usuario WHERE id = ${anteriorId}`;
    expect(u?.rol).toBe("admin_junta");
  });

  it("revierte todo si el nuevo administrador no se puede crear (cédula ya en uso en la junta)", async () => {
    const { j, anteriorId } = await juntaConAdmin();
    await crearUsuarioDirecto({ tenantId: j, cedula: CED_NUEVO, rol: "socio", correo: "otro@correo.com" });
    expect(await codigo(cambiarAdministrador(ctx, nuevo(j)))).toBe("CEDULA_DUPLICADA");
    const [u] = await adminSql()`SELECT rol FROM usuario WHERE id = ${anteriorId}`;
    expect(u?.rol).toBe("admin_junta"); // el anterior sigue siendo administrador
    expect(await adminSql()`SELECT 1 FROM designacion_administrador WHERE junta_id = ${j} AND vigente`).toHaveLength(1);
  });

  it("pide usar «asignar» si la junta no tiene administrador", async () => {
    const j = await crearJuntaDirecta("sin-admin");
    expect(await codigo(cambiarAdministrador(ctx, nuevo(j)))).toBe("JUNTA_SIN_ADMIN");
  });

  it("obtenerAdministradorActual devuelve al vigente", async () => {
    const { j } = await juntaConAdmin();
    expect((await obtenerAdministradorActual(ctx, j))?.cedula).toBe(CED_ADMIN);
    await cambiarAdministrador(ctx, nuevo(j));
    expect((await obtenerAdministradorActual(ctx, j))?.cedula).toBe(CED_NUEVO);
    expect(await obtenerAdministradorActual(ctx, await crearJuntaDirecta("vacia"))).toBeNull();
  });
});
