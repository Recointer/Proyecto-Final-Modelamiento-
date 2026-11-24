import { afterEach, describe, expect, it } from "vitest";
import { sql as sqlTag } from "drizzle-orm";
import { withTenant } from "@/server/db/context";
import { anularConvocatoria, emitirConvocatoria, listarConvocatorias } from "@/server/services/convocatoria-service";
import { anularDocumento, archivarDocumento, fijarPublicacion, listarDocumentos, obtenerArchivoDocumento } from "@/server/services/documento-service";
import {
  anularComunicacion,
  fijarPublicacionComunicacion,
  listarComunicaciones,
  obtenerAdjuntoComunicacion,
  registrarComunicacion,
} from "@/server/services/comunicacion-service";
import { mailer, setMailer, type Correo, type Mailer } from "@/server/mail/mailer";
import { adminSql } from "./setup";
import { crearEventoDirecto } from "./helpers";
import { ARCHIVO_INVALIDO, ARCHIVO_PDF, ARCHIVO_PNG, codigo, escenarioComunicaciones } from "./helpers-comunicaciones";

const original = mailer();
afterEach(() => setMailer(original));

const conv = (extra: Record<string, unknown> = {}) => ({
  tipo: "asamblea" as const,
  titulo: "Asamblea ordinaria",
  fecha: "2030-03-10",
  hora: "18:00",
  lugar: "Casa comunal",
  ...extra,
});
const doc = (extra: Record<string, unknown> = {}) => ({ tipo: "acta_asamblea" as const, titulo: "Acta de marzo", fecha: "2026-03-10", ...extra });
const com = (extra: Record<string, unknown> = {}) => ({
  institucion: "GAD Parroquial",
  asunto: "Oficio de socialización",
  fechaRecepcion: "2026-02-01",
  resumen: "Invitan a una reunión técnica.",
  ...extra,
});

describe("convocatorias (RF-25, RF-26, RF-31)", () => {
  it("emite, lista para el personal y para el Socio, y rechaza fechas pasadas", async () => {
    const e = await escenarioComunicaciones();
    const r = await emitirConvocatoria(e.ctxSec, conv({ ordenDia: "1. Informe\n2. Varios" }));
    expect(r).toMatchObject({ notificados: 0, fallidos: 0 });
    const [c] = await listarConvocatorias(e.ctxAna, { soloVisibles: true });
    expect(c).toMatchObject({ titulo: "Asamblea ordinaria", hora: "18:00", estado: "vigente", pasada: false, ordenDia: "1. Informe\n2. Varios" });
    expect(await codigo(emitirConvocatoria(e.ctxSec, conv({ fecha: "2020-01-01" })))).toBe("FECHA_PASADA");
    // hoy con hora pasada se rechaza; con hora futura se acepta
    const ahora = new Date("2030-03-10T15:00:00Z"); // 10:00 en Ecuador
    expect(await codigo(emitirConvocatoria(e.ctxSec, conv({ hora: "09:00" }), ahora))).toBe("FECHA_PASADA");
    expect((await emitirConvocatoria(e.ctxSec, conv({ hora: "11:00" }), ahora)).id).toBeTruthy();
  });

  it("avisa por correo solo a socios activos con correo y un fallo no impide publicar", async () => {
    const e = await escenarioComunicaciones();
    const enviados: Correo[] = [];
    const falso: Mailer = {
      async enviar(c) {
        if (c.para === "beto@correo.com") throw new Error("SMTP caído");
        enviados.push(c);
      },
    };
    setMailer(falso);
    const r = await emitirConvocatoria(e.ctxSec, conv({ avisar: "on" }));
    expect(r).toMatchObject({ notificados: 1, fallidos: 1 });
    expect(enviados.map((c) => c.para)).toEqual(["ana@correo.com"]);
    expect(enviados[0]!.texto).toContain("Casa comunal");
    expect(enviados[0]!.texto).toContain("10/03/2030");
    const [c] = await listarConvocatorias(e.ctxSec);
    expect(c).toMatchObject({ estado: "vigente", notificados: 1 });
  });

  it("vincula un evento propio vigente y rechaza uno anulado o de otra junta", async () => {
    const e = await escenarioComunicaciones();
    const ev = await crearEventoDirecto({ tenantId: e.a, creadoPor: e.sec, titulo: "Asamblea de marzo", fecha: "2030-03-10" });
    const anulado = await crearEventoDirecto({ tenantId: e.a, creadoPor: e.sec, estado: "anulado" });
    const ajeno = await crearEventoDirecto({ tenantId: e.b, creadoPor: e.secB });
    await emitirConvocatoria(e.ctxSec, conv({ eventoId: ev }));
    expect((await listarConvocatorias(e.ctxSec))[0]).toMatchObject({ eventoId: ev, eventoTitulo: "Asamblea de marzo" });
    expect(await codigo(emitirConvocatoria(e.ctxSec, conv({ eventoId: anulado })))).toBe("EVENTO_NO_VALIDO");
    expect(await codigo(emitirConvocatoria(e.ctxSec, conv({ eventoId: ajeno })))).toBe("EVENTO_NO_VALIDO");
  });

  it("anular la oculta al Socio, la conserva para la secretaría y no se anula dos veces", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await emitirConvocatoria(e.ctxSec, conv());
    await anularConvocatoria(e.ctxSec, id, "Fecha equivocada");
    expect(await listarConvocatorias(e.ctxAna, { soloVisibles: true })).toEqual([]);
    expect((await listarConvocatorias(e.ctxSec))[0]).toMatchObject({ estado: "anulado", motivoAnulacion: "Fecha equivocada" });
    expect(await codigo(anularConvocatoria(e.ctxSec, id, "otra vez"))).toBe("CONVOCATORIA_ANULADA");
    // las convocatorias no se editan desde la aplicación
    await expect(withTenant(e.ctxSec, (tx) => tx.execute(sqlTag`UPDATE convocatoria SET titulo = 'Otro'`))).rejects.toThrow();
  });

  it("aísla las convocatorias entre juntas", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await emitirConvocatoria(e.ctxSec, conv());
    expect(await listarConvocatorias(e.ctxSecB)).toEqual([]);
    expect(await codigo(anularConvocatoria(e.ctxSecB, id, "intento ajeno"))).toBe("CONVOCATORIA_NO_ENCONTRADA");
  });
});

describe("actas y resoluciones (RF-27, RF-28, RF-31)", () => {
  it("archiva sin publicar, publica y retira; el Socio solo ve y descarga lo publicado", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await archivarDocumento(e.ctxSec, doc(), ARCHIVO_PDF);
    expect((await listarDocumentos(e.ctxSec)).items[0]).toMatchObject({ titulo: "Acta de marzo", publicado: false });
    expect((await listarDocumentos(e.ctxAna, { soloVisibles: true })).total).toBe(0);
    expect(await obtenerArchivoDocumento(e.ctxAna, id, { soloVisibles: true })).toBeNull();
    expect((await obtenerArchivoDocumento(e.ctxSec, id))!.mime).toBe("application/pdf");

    await fijarPublicacion(e.ctxSec, id, true);
    expect((await listarDocumentos(e.ctxAna, { soloVisibles: true })).total).toBe(1);
    const archivo = await obtenerArchivoDocumento(e.ctxAna, id, { soloVisibles: true });
    expect(archivo).toMatchObject({ mime: "application/pdf", extension: "pdf" });

    await fijarPublicacion(e.ctxSec, id, false);
    expect(await obtenerArchivoDocumento(e.ctxAna, id, { soloVisibles: true })).toBeNull();
    expect((await listarDocumentos(e.ctxSec)).total).toBe(1);
  });

  it("archiva ya publicado, valida el archivo y filtra por tipo, año y texto", async () => {
    const e = await escenarioComunicaciones();
    await archivarDocumento(e.ctxSec, doc({ publicar: "on" }), ARCHIVO_PNG);
    await archivarDocumento(e.ctxSec, doc({ tipo: "resolucion", titulo: "Resolución de cuotas", fecha: "2025-12-01", descripcion: "Fija las cuotas" }), ARCHIVO_PDF);
    expect(await codigo(archivarDocumento(e.ctxSec, doc(), ARCHIVO_INVALIDO))).toBe("DOCUMENTO_INVALIDO");
    expect(await codigo(archivarDocumento(e.ctxSec, doc(), null))).toBe("DOCUMENTO_INVALIDO");
    expect((await listarDocumentos(e.ctxSec)).total).toBe(2);
    expect((await listarDocumentos(e.ctxSec, { tipo: "resolucion" })).items.map((d) => d.titulo)).toEqual(["Resolución de cuotas"]);
    expect((await listarDocumentos(e.ctxSec, { anio: 2025 })).total).toBe(1);
    expect((await listarDocumentos(e.ctxSec, { busqueda: "cuotas" })).total).toBe(1);
    expect((await listarDocumentos(e.ctxAna, { soloVisibles: true })).items.map((d) => d.titulo)).toEqual(["Acta de marzo"]);
  });

  it("anular lo oculta del Socio aunque estuviera publicado y no se puede volver a publicar", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await archivarDocumento(e.ctxSec, doc({ publicar: "on" }), ARCHIVO_PDF);
    await anularDocumento(e.ctxSec, id, "Documento equivocado");
    expect(await obtenerArchivoDocumento(e.ctxAna, id, { soloVisibles: true })).toBeNull();
    expect((await listarDocumentos(e.ctxSec)).items[0]).toMatchObject({ estado: "anulado", publicado: false, motivoAnulacion: "Documento equivocado" });
    expect(await codigo(fijarPublicacion(e.ctxSec, id, true))).toBe("DOCUMENTO_ANULADO");
    expect(await codigo(anularDocumento(e.ctxSec, id, "otra vez"))).toBe("DOCUMENTO_ANULADO");
  });

  it("aísla los documentos entre juntas y registra la auditoría", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await archivarDocumento(e.ctxSec, doc({ publicar: "on" }), ARCHIVO_PDF);
    expect(await obtenerArchivoDocumento(e.ctxSecB, id)).toBeNull();
    expect((await listarDocumentos(e.ctxSecB)).total).toBe(0);
    expect(await codigo(fijarPublicacion(e.ctxSecB, id, false))).toBe("DOCUMENTO_NO_ENCONTRADO");
    const acciones = (await adminSql()`SELECT accion FROM audit_log WHERE entidad = 'documento'`).map((f) => f.accion);
    expect(acciones).toEqual(["documento.archivar"]);
  });
});

describe("comunicaciones recibidas (RF-29, RF-30, RF-31)", () => {
  it("registra con adjunto, busca, publica como comunicado y anula", async () => {
    const e = await escenarioComunicaciones();
    const { id } = await registrarComunicacion(e.ctxSec, com({ referencia: "Of-123" }), ARCHIVO_PDF);
    await registrarComunicacion(e.ctxSec, com({ institucion: "Ministerio del Ambiente", asunto: "Permiso de captación", fechaRecepcion: "2025-11-05" }), null);
    expect((await listarComunicaciones(e.ctxSec)).total).toBe(2);
    expect((await listarComunicaciones(e.ctxSec, { busqueda: "ambiente" })).total).toBe(1);
    expect((await listarComunicaciones(e.ctxSec, { busqueda: "of-123" })).total).toBe(1);
    expect((await listarComunicaciones(e.ctxSec, { anio: 2025 })).items[0]!.asunto).toBe("Permiso de captación");
    expect((await obtenerAdjuntoComunicacion(e.ctxSec, id))!.mime).toBe("application/pdf");

    expect((await listarComunicaciones(e.ctxAna, { soloVisibles: true })).total).toBe(0);
    expect(await obtenerAdjuntoComunicacion(e.ctxAna, id, { soloVisibles: true })).toBeNull();
    await fijarPublicacionComunicacion(e.ctxSec, id, true);
    expect((await listarComunicaciones(e.ctxAna, { soloVisibles: true })).items.map((c) => c.asunto)).toEqual(["Oficio de socialización"]);
    expect(await obtenerAdjuntoComunicacion(e.ctxAna, id, { soloVisibles: true })).not.toBeNull();

    await anularComunicacion(e.ctxSec, id, "Registrada por error");
    expect((await listarComunicaciones(e.ctxAna, { soloVisibles: true })).total).toBe(0);
    expect(await obtenerAdjuntoComunicacion(e.ctxAna, id, { soloVisibles: true })).toBeNull();
    expect(await codigo(fijarPublicacionComunicacion(e.ctxSec, id, true))).toBe("COMUNICACION_ANULADA");
  });

  it("rechaza adjuntos no permitidos y aísla entre juntas", async () => {
    const e = await escenarioComunicaciones();
    expect(await codigo(registrarComunicacion(e.ctxSec, com(), ARCHIVO_INVALIDO))).toBe("ADJUNTO_INVALIDO");
    expect((await listarComunicaciones(e.ctxSec)).total).toBe(0);
    const { id } = await registrarComunicacion(e.ctxSec, com(), ARCHIVO_PNG);
    expect(await obtenerAdjuntoComunicacion(e.ctxSecB, id)).toBeNull();
    expect((await listarComunicaciones(e.ctxSecB)).total).toBe(0);
    expect(await codigo(anularComunicacion(e.ctxSecB, id, "intento ajeno"))).toBe("COMUNICACION_NO_ENCONTRADA");
  });
});
