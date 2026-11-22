import { beforeEach, describe, expect, it } from "vitest";
import {
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  listarUsuarios,
  obtenerUsuario,
  reactivarUsuario,
  restablecerCredencialInicial,
  TAMANO_PAGINA_USUARIOS,
} from "@/server/services/usuario-service";
import { iniciarSesion } from "@/server/services/auth-service";
import { setMailer, type Correo } from "@/server/mail/mailer";
import { filtrosUsuarioSchema } from "@/server/validation/usuario";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto, PASSWORD_PRUEBA } from "./helpers";

const CED_ADMIN = "1710034065";
const CED_1 = "0926687856";
const CED_2 = "1713175071";

let correos: Correo[] = [];
beforeEach(() => {
  correos = [];
  setMailer({ enviar: async (c) => void correos.push(c) });
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

async function escenario() {
  const a = await crearJuntaDirecta("junta-a", "Junta A");
  const b = await crearJuntaDirecta("junta-b", "Junta B");
  const adminA = await crearUsuarioDirecto({ tenantId: a, cedula: CED_ADMIN, rol: "admin_junta", correo: "admin.a@correo.com" });
  const adminB = await crearUsuarioDirecto({ tenantId: b, cedula: CED_ADMIN, rol: "admin_junta", correo: "admin.b@correo.com" });
  return {
    a,
    b,
    adminA,
    ctxA: { role: "tenant" as const, tenantId: a, userId: adminA },
    ctxB: { role: "tenant" as const, tenantId: b, userId: adminB },
  };
}

const f = (o: Record<string, unknown> = {}) => filtrosUsuarioSchema.parse(o);
const datos = (extra: Record<string, unknown> = {}) => ({
  cedula: CED_1,
  nombres: "Ana Torres",
  correo: "ana@correo.com",
  rol: "socio" as const,
  ...extra,
});

describe("crear cuentas (RF-05)", () => {
  it("crea la cuenta con credencial inicial, cambio obligatorio y auditoría", async () => {
    const { a, ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos());

    expect(r.credencialInicial.length).toBeGreaterThanOrEqual(10);
    expect(r.correoEnviado).toBe(true);
    expect(correos[0]?.para).toBe("ana@correo.com");
    expect(correos[0]?.texto).toContain("junta-a");

    const [u] = await adminSql()`SELECT tenant_id, rol, estado, debe_cambiar_password FROM usuario WHERE id = ${r.usuarioId}`;
    expect(u).toMatchObject({ tenant_id: a, rol: "socio", estado: "activo", debe_cambiar_password: true });
    const aud = await adminSql()`SELECT tenant_id, actor_id FROM audit_log WHERE accion = 'usuario.crear'`;
    expect(aud[0]).toMatchObject({ tenant_id: a, actor_id: ctxA.userId });
  });

  it("la nueva cuenta ingresa con la credencial y debe crear su contraseña", async () => {
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos({ rol: "tesorero" }));
    const s = await iniciarSesion({ junta: "junta-a", identificador: CED_1, password: r.credencialInicial, recordar: false });
    expect(s).toMatchObject({ rol: "tesorero", debeCambiarPassword: true });
  });

  it("permite cuentas sin correo (no se envía nada)", async () => {
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos({ correo: undefined }));
    expect(r.correoEnviado).toBe(false);
    expect(correos).toHaveLength(0);
    expect(r.credencialInicial).toBeTruthy();
  });

  it("si falla el correo, la cuenta se crea igualmente y se informa", async () => {
    setMailer({ enviar: async () => Promise.reject(new Error("SMTP caído")) });
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos());
    expect(r.correoEnviado).toBe(false);
    expect(await adminSql()`SELECT 1 FROM usuario WHERE id = ${r.usuarioId}`).toHaveLength(1);
  });

  it("rechaza cédula inválida", async () => {
    const { ctxA } = await escenario();
    expect(await codigo(crearUsuario(ctxA, datos({ cedula: "1234567890" })))).toBe("CEDULA_INVALIDA");
  });

  it("rechaza cédula y correo duplicados dentro de la misma junta", async () => {
    const { ctxA } = await escenario();
    await crearUsuario(ctxA, datos());
    expect(await codigo(crearUsuario(ctxA, datos({ correo: "otro@correo.com" })))).toBe("CEDULA_DUPLICADA");
    expect(await codigo(crearUsuario(ctxA, datos({ cedula: CED_2, correo: "ANA@correo.com" })))).toBe("CORREO_DUPLICADO");
  });

  it("la misma cédula y correo pueden existir en otra junta", async () => {
    const { ctxA, ctxB } = await escenario();
    await crearUsuario(ctxA, datos());
    await expect(crearUsuario(ctxB, datos())).resolves.toBeDefined();
  });

  it("no permite crear administradores ni super administradores (sin escalada de privilegios)", async () => {
    const { ctxA } = await escenario();
    for (const rol of ["admin_junta", "super_admin"]) {
      expect(await codigo(crearUsuario(ctxA, datos({ rol: rol as "socio" })))).toBe("ROL_NO_PERMITIDO");
    }
    expect(await adminSql()`SELECT 1 FROM usuario WHERE cedula = ${CED_1}`).toHaveLength(0);
  });
});

describe("editar cuentas", () => {
  it("edita datos y cambia el rol entre los permitidos, con auditoría antes y después", async () => {
    const { ctxA } = await escenario();
    const { usuarioId } = await crearUsuario(ctxA, datos());
    await editarUsuario(ctxA, usuarioId, { nombres: "Ana María Torres", telefono: "0991234567", rol: "secretario" });
    const u = await obtenerUsuario(ctxA, usuarioId);
    expect(u).toMatchObject({ nombres: "Ana María Torres", telefono: "0991234567", rol: "secretario", correo: null });
    const [aud] = await adminSql()`SELECT antes, despues FROM audit_log WHERE accion = 'usuario.editar'`;
    expect(aud?.antes.rol).toBe("socio");
    expect(aud?.despues.rol).toBe("secretario");
  });

  it("no permite editar la cédula ni asignar roles de administración", async () => {
    const { ctxA } = await escenario();
    const { usuarioId } = await crearUsuario(ctxA, datos());
    expect(await codigo(editarUsuario(ctxA, usuarioId, { nombres: "Ana Torres", rol: "admin_junta" as "socio" }))).toBe("ROL_NO_PERMITIDO");
    const [u] = await adminSql()`SELECT cedula, rol FROM usuario WHERE id = ${usuarioId}`;
    expect(u).toMatchObject({ cedula: CED_1, rol: "socio" });
  });

  it("no cambia el rol del administrador ni el propio, pero sí sus datos personales", async () => {
    const { ctxA, adminA } = await escenario();
    expect(await codigo(editarUsuario(ctxA, adminA, { nombres: "Admin A", rol: "socio" }))).toBe("ROL_NO_MODIFICABLE");
    await editarUsuario(ctxA, adminA, { nombres: "Administradora A", telefono: "0987654321" });
    expect((await obtenerUsuario(ctxA, adminA))?.nombres).toBe("Administradora A");
    expect((await obtenerUsuario(ctxA, adminA))?.rol).toBe("admin_junta");
  });

  it("rechaza un correo ya usado por otra cuenta de la junta", async () => {
    const { ctxA } = await escenario();
    await crearUsuario(ctxA, datos());
    const otra = await crearUsuario(ctxA, datos({ cedula: CED_2, correo: "otra@correo.com" }));
    expect(await codigo(editarUsuario(ctxA, otra.usuarioId, { nombres: "Otra Persona", correo: "ana@correo.com" }))).toBe("CORREO_DUPLICADO");
  });
});

describe("desactivar, reactivar y restablecer", () => {
  it("desactivar cierra las sesiones y bloquea el ingreso, conservando el historial", async () => {
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos());
    const entrada = { junta: "junta-a", identificador: CED_1, password: r.credencialInicial, recordar: false };
    await iniciarSesion(entrada);
    expect(await adminSql()`SELECT 1 FROM sesion WHERE usuario_id = ${r.usuarioId}`).toHaveLength(1);

    await desactivarUsuario(ctxA, r.usuarioId);
    expect(await adminSql()`SELECT 1 FROM sesion WHERE usuario_id = ${r.usuarioId}`).toHaveLength(0);
    expect(await codigo(iniciarSesion(entrada))).toBe("CUENTA_DESACTIVADA");
    expect(await adminSql()`SELECT 1 FROM usuario WHERE id = ${r.usuarioId}`).toHaveLength(1);
    expect(await adminSql()`SELECT 1 FROM audit_log WHERE accion = 'usuario.desactivar'`).toHaveLength(1);
  });

  it("reactivar devuelve el acceso", async () => {
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos());
    await desactivarUsuario(ctxA, r.usuarioId);
    await reactivarUsuario(ctxA, r.usuarioId);
    const s = await iniciarSesion({ junta: "junta-a", identificador: CED_1, password: r.credencialInicial, recordar: false });
    expect(s.rol).toBe("socio");
  });

  it("el administrador no puede desactivar su propia cuenta", async () => {
    const { ctxA, adminA } = await escenario();
    expect(await codigo(desactivarUsuario(ctxA, adminA))).toBe("NO_PUEDE_DESACTIVARSE_A_SI_MISMO");
    expect((await obtenerUsuario(ctxA, adminA))?.estado).toBe("activo");
  });

  it("restablecer da una nueva credencial, invalida la anterior, cierra sesiones y fuerza el cambio", async () => {
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos());
    await adminSql()`UPDATE usuario SET debe_cambiar_password = false, intentos_fallidos = 4 WHERE id = ${r.usuarioId}`;
    await iniciarSesion({ junta: "junta-a", identificador: CED_1, password: r.credencialInicial, recordar: false });

    const nueva = await restablecerCredencialInicial(ctxA, r.usuarioId);
    expect(nueva.credencialInicial).not.toBe(r.credencialInicial);
    expect(await adminSql()`SELECT 1 FROM sesion WHERE usuario_id = ${r.usuarioId}`).toHaveLength(0);
    expect(await codigo(iniciarSesion({ junta: "junta-a", identificador: CED_1, password: r.credencialInicial, recordar: false }))).toBe("CREDENCIALES_INVALIDAS");
    const s = await iniciarSesion({ junta: "junta-a", identificador: CED_1, password: nueva.credencialInicial, recordar: false });
    expect(s.debeCambiarPassword).toBe(true);
    expect(correos.at(-1)?.asunto).toContain("restablecida");
  });

  it("restablecer también desbloquea una cuenta bloqueada", async () => {
    const { ctxA } = await escenario();
    const r = await crearUsuario(ctxA, datos());
    await adminSql()`UPDATE usuario SET bloqueado_hasta = now() + interval '10 minutes' WHERE id = ${r.usuarioId}`;
    const nueva = await restablecerCredencialInicial(ctxA, r.usuarioId);
    await expect(iniciarSesion({ junta: "junta-a", identificador: CED_1, password: nueva.credencialInicial, recordar: false })).resolves.toBeDefined();
  });

  it("para su propia contraseña debe usar la recuperación", async () => {
    const { ctxA, adminA } = await escenario();
    expect(await codigo(restablecerCredencialInicial(ctxA, adminA))).toBe("DATOS_INVALIDOS");
  });
});

describe("aislamiento entre juntas", () => {
  it("el administrador de una junta no puede ver, editar, desactivar ni restablecer cuentas de otra", async () => {
    const { b, ctxA } = await escenario();
    const ajeno = await crearUsuarioDirecto({ tenantId: b, cedula: CED_1, rol: "socio", correo: "ajeno@correo.com" });

    expect(await obtenerUsuario(ctxA, ajeno)).toBeNull();
    expect(await codigo(editarUsuario(ctxA, ajeno, { nombres: "Hackeado Total" }))).toBe("USUARIO_NO_ENCONTRADO");
    expect(await codigo(desactivarUsuario(ctxA, ajeno))).toBe("USUARIO_NO_ENCONTRADO");
    expect(await codigo(reactivarUsuario(ctxA, ajeno))).toBe("USUARIO_NO_ENCONTRADO");
    expect(await codigo(restablecerCredencialInicial(ctxA, ajeno))).toBe("USUARIO_NO_ENCONTRADO");

    const [intacto] = await adminSql()`SELECT nombres, estado FROM usuario WHERE id = ${ajeno}`;
    expect(intacto).toMatchObject({ nombres: `Usuario ${CED_1}`, estado: "activo" });

    const lista = await listarUsuarios(ctxA, f());
    expect(lista.items.map((u) => u.id)).not.toContain(ajeno);
  });
});

describe("listado de cuentas", () => {
  async function sembrar(ctx: Awaited<ReturnType<typeof escenario>>["ctxA"], n: number) {
    for (let i = 0; i < n; i++) {
      await adminSql()`
        INSERT INTO usuario (tenant_id, cedula, nombres, correo, rol, estado, password_hash)
        VALUES (${ctx.tenantId}, ${`17${String(10000000 + i)}`}, ${`Socio ${String(i).padStart(3, "0")}`},
                ${`socio${i}@correo.com`}, ${i % 5 === 0 ? "tesorero" : "socio"}, ${i % 7 === 0 ? "desactivado" : "activo"}, 'x')`;
    }
  }

  it("pagina, ordena por nombre y solo lista la propia junta", async () => {
    const { ctxA } = await escenario();
    await sembrar(ctxA, 45);
    const p1 = await listarUsuarios(ctxA, f());
    expect(p1.total).toBe(46); // 45 + el administrador
    expect(p1.items).toHaveLength(TAMANO_PAGINA_USUARIOS);
    expect(p1.paginas).toBe(3);
    const nombres = p1.items.map((u) => u.nombres.toLowerCase());
    expect(nombres).toEqual([...nombres].sort());
    expect((await listarUsuarios(ctxA, f({ pagina: 3 }))).items).toHaveLength(6);
    expect((await listarUsuarios(ctxA, f({ pagina: 99 }))).pagina).toBe(3);
  });

  it("filtra por búsqueda, rol y estado", async () => {
    const { ctxA } = await escenario();
    await sembrar(ctxA, 30);
    expect((await listarUsuarios(ctxA, f({ busqueda: "Socio 017" }))).items.map((u) => u.nombres)).toEqual(["Socio 017"]);
    expect((await listarUsuarios(ctxA, f({ busqueda: "socio17@" }))).total).toBe(1);
    expect((await listarUsuarios(ctxA, f({ rol: "tesorero" }))).items.every((u) => u.rol === "tesorero")).toBe(true);
    const desact = await listarUsuarios(ctxA, f({ estado: "desactivado" }));
    expect(desact.items.every((u) => u.estado === "desactivado")).toBe(true);
    expect(desact.total).toBeGreaterThan(0);
  });

  it("trata % y _ de la búsqueda como texto literal y no falla sin resultados", async () => {
    const { ctxA } = await escenario();
    await sembrar(ctxA, 5);
    expect((await listarUsuarios(ctxA, f({ busqueda: "%" }))).total).toBe(0);
    const vacio = await listarUsuarios(ctxA, f({ busqueda: "no-existe-xyz" }));
    expect(vacio).toMatchObject({ total: 0, paginas: 1, items: [] });
  });

  it("no expone el hash de contraseña", async () => {
    const { ctxA } = await escenario();
    const lista = await listarUsuarios(ctxA, f());
    expect(JSON.stringify(lista)).not.toMatch(/passwordHash|password_hash|argon2/i);
    expect(PASSWORD_PRUEBA).toBeTruthy();
  });
});
