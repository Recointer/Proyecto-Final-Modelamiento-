import { describe, expect, it } from "vitest";
import { sql as sqlTag } from "drizzle-orm";
import { withTenant } from "@/server/db/context";
import { abrirHilo, iniciarHilo, listarHilos, responder, sociosConCuenta, totalNoLeidos } from "@/server/services/mensajeria-service";
import { adminSql } from "./setup";
import { codigo, escenarioComunicaciones } from "./helpers-comunicaciones";

describe("mensajería Socio–Administrador (RF-32, RF-33)", () => {
  it("el Socio escribe, el Administrador lo ve sin leer, abre, responde y el Socio ve la respuesta sin leer", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await iniciarHilo(e.ctxAna, "socio", { asunto: "Riego del sábado", texto: "¿A qué hora abren la compuerta?" });

    expect(await totalNoLeidos(e.ctxAdm, "admin_junta")).toBe(1);
    expect(await totalNoLeidos(e.ctxAna, "socio")).toBe(0);
    expect(await listarHilos(e.ctxAdm, "admin_junta")).toMatchObject([{ id, asunto: "Riego del sábado", socioNombres: "Usuario 0926687856", noLeidos: 1 }]);

    const abierto = await abrirHilo(e.ctxAdm, "admin_junta", id);
    expect(abierto.mensajes).toMatchObject([{ texto: "¿A qué hora abren la compuerta?", deAdministracion: false }]);
    expect(await totalNoLeidos(e.ctxAdm, "admin_junta")).toBe(0);

    await responder(e.ctxAdm, "admin_junta", { hiloId: id, texto: "A las 6:00." });
    expect(await totalNoLeidos(e.ctxAna, "socio")).toBe(1);
    expect((await listarHilos(e.ctxAna, "socio"))[0]).toMatchObject({ noLeidos: 1 });
    const visto = await abrirHilo(e.ctxAna, "socio", id);
    expect(visto.mensajes.map((m) => [m.deAdministracion, m.texto])).toEqual([
      [false, "¿A qué hora abren la compuerta?"],
      [true, "A las 6:00."],
    ]);
    expect(await totalNoLeidos(e.ctxAna, "socio")).toBe(0);
    // abrir la propia conversación no marca como leídos los mensajes propios de la otra parte
    expect(await totalNoLeidos(e.ctxAdm, "admin_junta")).toBe(0);
  });

  it("el Administrador inicia una conversación con un socio con cuenta activa", async () => {
    const e = await escenarioComunicaciones();
    expect((await sociosConCuenta(e.ctxAdm)).map((s) => s.id).sort()).toEqual([e.uAna, e.uBeto].sort());
    const { id } = await iniciarHilo(e.ctxAdm, "admin_junta", { asunto: "Cuota pendiente", texto: "Le recordamos su cuota.", usuarioId: e.uBeto });
    expect(await totalNoLeidos(e.ctxBeto, "socio")).toBe(1);
    expect((await abrirHilo(e.ctxBeto, "socio", id)).mensajes[0]).toMatchObject({ deAdministracion: true });
    // destinatarios no válidos: el propio administrador, una cuenta de otra junta o inexistente
    for (const usuarioId of [e.adm, e.secB, "no-es-un-uuid", undefined]) {
      expect(await codigo(iniciarHilo(e.ctxAdm, "admin_junta", { asunto: "Prueba", texto: "Hola", usuarioId }))).toBe("DESTINATARIO_NO_VALIDO");
    }
    await adminSql()`UPDATE usuario SET estado = 'desactivado' WHERE id = ${e.uBeto}`;
    expect(await codigo(iniciarHilo(e.ctxAdm, "admin_junta", { asunto: "Prueba", texto: "Hola", usuarioId: e.uBeto }))).toBe("DESTINATARIO_NO_VALIDO");
    expect((await sociosConCuenta(e.ctxAdm)).map((s) => s.id)).toEqual([e.uAna]);
  });

  it("otro Socio, otra junta o un rol ajeno no acceden a una conversación", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await iniciarHilo(e.ctxAna, "socio", { asunto: "Asunto privado", texto: "Texto privado" });
    expect(await listarHilos(e.ctxBeto, "socio")).toEqual([]);
    expect(await codigo(abrirHilo(e.ctxBeto, "socio", id))).toBe("HILO_NO_ENCONTRADO");
    expect(await codigo(responder(e.ctxBeto, "socio", { hiloId: id, texto: "Intruso" }))).toBe("HILO_NO_ENCONTRADO");
    expect(await listarHilos(e.ctxAdmB, "admin_junta")).toEqual([]);
    expect(await codigo(abrirHilo(e.ctxAdmB, "admin_junta", id))).toBe("HILO_NO_ENCONTRADO");
    expect(await totalNoLeidos(e.ctxBeto, "socio")).toBe(0);
    // el administrador de otra junta tampoco puede iniciar con un socio de la junta A
    expect(await codigo(iniciarHilo(e.ctxAdmB, "admin_junta", { asunto: "Intento", texto: "Hola", usuarioId: e.uAna }))).toBe("DESTINATARIO_NO_VALIDO");
  });

  it("la bandeja se ordena por la última actividad y cada parte ve sus no leídos", async () => {
    const e = await escenarioComunicaciones();
    const a = await iniciarHilo(e.ctxAna, "socio", { asunto: "Primera consulta", texto: "Uno" });
    const b = await iniciarHilo(e.ctxBeto, "socio", { asunto: "Segunda consulta", texto: "Dos" });
    expect((await listarHilos(e.ctxAdm, "admin_junta")).map((h) => h.id)).toEqual([b.id, a.id]);
    await responder(e.ctxAna, "socio", { hiloId: a.id, texto: "Otro mensaje" });
    const bandeja = await listarHilos(e.ctxAdm, "admin_junta");
    expect(bandeja.map((h) => [h.id, h.noLeidos])).toEqual([[a.id, 2], [b.id, 1]]);
    expect(await totalNoLeidos(e.ctxAdm, "admin_junta")).toBe(3);
  });

  it("los mensajes no se editan ni se borran (solo cambia la fecha de lectura) y el texto se valida", async () => {
    const e = await escenarioComunicaciones();
    await iniciarHilo(e.ctxAna, "socio", { asunto: "Consulta", texto: "Mensaje original" });
    await expect(withTenant(e.ctxAna, (tx) => tx.execute(sqlTag`UPDATE mensaje SET texto = 'Editado'`))).rejects.toThrow();
    await expect(withTenant(e.ctxAna, (tx) => tx.execute(sqlTag`DELETE FROM mensaje`))).rejects.toThrow();
    await expect(withTenant(e.ctxAna, (tx) => tx.execute(sqlTag`DELETE FROM hilo`))).rejects.toThrow();
    await expect(iniciarHilo(e.ctxAna, "socio", { asunto: "Vacío", texto: "" })).rejects.toThrow();
    await expect(iniciarHilo(e.ctxAna, "socio", { asunto: "Largo", texto: "a".repeat(2001) })).rejects.toThrow();
    const filas = await adminSql()`SELECT texto FROM mensaje`;
    expect(filas.map((f) => f.texto)).toEqual(["Mensaje original"]);
    const acciones = (await adminSql()`SELECT accion FROM audit_log WHERE entidad = 'hilo'`).map((f) => f.accion);
    expect(acciones).toEqual(["hilo.iniciar"]);
  });
});
