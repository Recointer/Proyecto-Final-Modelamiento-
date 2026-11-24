import { AppError } from "@/lib/result";
import { crearJuntaDirecta, crearSectorDirecto, crearSocioDirecto, crearUsuarioDirecto } from "./helpers";

export async function codigo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "SIN_ERROR";
}

/** Dos juntas; la A con Secretario/a, Administrador, dos socios con cuenta y un socio sin cuenta. */
export async function escenarioComunicaciones() {
  const a = await crearJuntaDirecta("junta-a", "Junta A");
  const b = await crearJuntaDirecta("junta-b", "Junta B");
  const sector = await crearSectorDirecto(a, "Norte");
  const sectorB = await crearSectorDirecto(b, "Norte");
  const sec = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "secretario" });
  const adm = await crearUsuarioDirecto({ tenantId: a, cedula: "1713175071", rol: "admin_junta" });
  const uAna = await crearUsuarioDirecto({ tenantId: a, cedula: "0926687856", rol: "socio" });
  const uBeto = await crearUsuarioDirecto({ tenantId: a, cedula: "0102030405", rol: "socio" });
  const secB = await crearUsuarioDirecto({ tenantId: b, cedula: "1710034065", rol: "secretario" });
  const admB = await crearUsuarioDirecto({ tenantId: b, cedula: "1713175071", rol: "admin_junta" });
  await crearSocioDirecto({ tenantId: a, sectorId: sector, cedula: "0926687856", nombres: "Ana Torres", correo: "ana@correo.com" });
  await crearSocioDirecto({ tenantId: a, sectorId: sector, cedula: "0102030405", nombres: "Beto Pérez", correo: "beto@correo.com" });
  await crearSocioDirecto({ tenantId: a, sectorId: sector, cedula: "1710034065", nombres: "Sin Correo" });
  await crearSocioDirecto({ tenantId: a, sectorId: sector, cedula: "1713175071", nombres: "Inactivo", correo: "baja@correo.com", estado: "inactivo" });
  await crearSocioDirecto({ tenantId: b, sectorId: sectorB, cedula: "0926687856", nombres: "Socio de B", correo: "b@correo.com" });
  const ctx = (tenantId: string, userId: string) => ({ role: "tenant" as const, tenantId, userId });
  return {
    a,
    b,
    sec,
    adm,
    uAna,
    uBeto,
    secB,
    admB,
    ctxSec: ctx(a, sec),
    ctxAdm: ctx(a, adm),
    ctxAna: ctx(a, uAna),
    ctxBeto: ctx(a, uBeto),
    ctxSecB: ctx(b, secB),
    ctxAdmB: ctx(b, admB),
  };
}

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 10, 37, 37, 69, 79, 70]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
export const ARCHIVO_PDF = PDF;
export const ARCHIVO_PNG = PNG;
export const ARCHIVO_INVALIDO = new Uint8Array([1, 2, 3, 4, 5]);
