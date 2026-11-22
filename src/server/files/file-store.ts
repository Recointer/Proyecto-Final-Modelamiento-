import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { AppError } from "@/lib/result";

export const MAX_BYTES = 5 * 1024 * 1024;

export interface FileStore {
  guardar(contenido: Uint8Array, subcarpeta: string): Promise<string>;
  leer(ruta: string): Promise<Uint8Array>;
}

type TipoArchivo = { ext: string; mime: string };

/** Detecta el tipo real por firma (no por la extensión declarada): PDF, PNG o JPEG. */
export function detectarTipo(b: Uint8Array): TipoArchivo | null {
  const empieza = (...bytes: number[]) => bytes.every((v, i) => b[i] === v);
  if (empieza(0x25, 0x50, 0x44, 0x46)) return { ext: "pdf", mime: "application/pdf" };
  if (empieza(0x89, 0x50, 0x4e, 0x47)) return { ext: "png", mime: "image/png" };
  if (empieza(0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg" };
  return null;
}

/** Valida tipo y tamaño; lanza ACTA_INVALIDA si no cumple. */
export function validarArchivo(contenido: Uint8Array): TipoArchivo {
  if (contenido.byteLength === 0 || contenido.byteLength > MAX_BYTES) {
    throw new AppError("ACTA_INVALIDA", "El archivo debe pesar entre 1 byte y 5 MB.");
  }
  const tipo = detectarTipo(contenido);
  if (!tipo) throw new AppError("ACTA_INVALIDA", "Solo se permiten archivos PDF o imagen.");
  return tipo;
}

export class DiskFileStore implements FileStore {
  constructor(private readonly base: string) {}

  async guardar(contenido: Uint8Array, subcarpeta: string): Promise<string> {
    const tipo = validarArchivo(contenido);
    if (!/^[a-z0-9_-]+$/i.test(subcarpeta)) throw new AppError("ACTA_INVALIDA");
    const relativa = `${subcarpeta}/${randomUUID()}.${tipo.ext}`;
    const destino = path.join(this.base, relativa);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
    return relativa;
  }

  async leer(ruta: string): Promise<Uint8Array> {
    const destino = path.resolve(this.base, ruta);
    if (!destino.startsWith(path.resolve(this.base) + path.sep)) throw new AppError("NO_AUTORIZADO");
    return readFile(destino);
  }
}

export function fileStore(): FileStore {
  return new DiskFileStore(process.env.FILE_STORE_DIR ?? "./storage");
}
