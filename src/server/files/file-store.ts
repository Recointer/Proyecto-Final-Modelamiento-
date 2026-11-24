import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { AppError } from "@/lib/result";

export const MAX_BYTES = 5 * 1024 * 1024;

export type ExtensionArchivo = "pdf" | "png" | "jpg";

export interface FileStore {
  /**
   * Guarda el archivo en una subcarpeta (admite varios niveles, p. ej. `predios/<tenant_id>`) y devuelve
   * su ruta relativa. `permitidos` limita los tipos aceptados (por defecto PDF, PNG y JPEG).
   */
  guardar(
    contenido: Uint8Array,
    subcarpeta: string,
    permitidos?: readonly ExtensionArchivo[],
    codigoError?: string,
  ): Promise<string>;
  leer(ruta: string): Promise<Uint8Array>;
  /** Elimina un archivo; no falla si no existe. */
  eliminar(ruta: string): Promise<void>;
}

type TipoArchivo = { ext: ExtensionArchivo; mime: string };

const TODOS: readonly ExtensionArchivo[] = ["pdf", "png", "jpg"];

/** Detecta el tipo real por firma (no por la extensión declarada): PDF, PNG o JPEG. */
export function detectarTipo(b: Uint8Array): TipoArchivo | null {
  const empieza = (...bytes: number[]) => bytes.every((v, i) => b[i] === v);
  if (empieza(0x25, 0x50, 0x44, 0x46)) return { ext: "pdf", mime: "application/pdf" };
  if (empieza(0x89, 0x50, 0x4e, 0x47)) return { ext: "png", mime: "image/png" };
  if (empieza(0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg" };
  return null;
}

/** Valida tipo y tamaño; lanza el código indicado (por defecto ACTA_INVALIDA) si no cumple. */
export function validarArchivo(
  contenido: Uint8Array,
  permitidos: readonly ExtensionArchivo[] = TODOS,
  codigoError = "ACTA_INVALIDA",
  campo = "acta",
): TipoArchivo {
  if (contenido.byteLength === 0 || contenido.byteLength > MAX_BYTES) {
    throw new AppError(codigoError, "El archivo debe pesar entre 1 byte y 5 MB.", campo);
  }
  const tipo = detectarTipo(contenido);
  if (!tipo || !permitidos.includes(tipo.ext)) {
    const soloImagenes = !permitidos.includes("pdf");
    throw new AppError(
      codigoError,
      soloImagenes ? "Solo se permiten imágenes PNG o JPEG." : "Solo se permiten archivos PDF o imagen.",
      campo,
    );
  }
  return tipo;
}

function validarSubcarpeta(subcarpeta: string): void {
  const segmentos = subcarpeta.split("/");
  if (segmentos.some((s) => !/^[a-z0-9_-]+$/i.test(s))) throw new AppError("ACTA_INVALIDA");
}

export class DiskFileStore implements FileStore {
  constructor(private readonly base: string) {}

  private resolver(ruta: string): string {
    const raiz = path.resolve(this.base);
    const destino = path.resolve(raiz, ruta);
    if (!destino.startsWith(raiz + path.sep)) throw new AppError("NO_AUTORIZADO");
    return destino;
  }

  async guardar(
    contenido: Uint8Array,
    subcarpeta: string,
    permitidos: readonly ExtensionArchivo[] = TODOS,
    codigoError = "ACTA_INVALIDA",
  ): Promise<string> {
    const campo = codigoError === "IMAGEN_INVALIDA" ? "imagen" : "acta";
    const tipo = validarArchivo(contenido, permitidos, codigoError, campo);
    validarSubcarpeta(subcarpeta);
    const relativa = `${subcarpeta}/${randomUUID()}.${tipo.ext}`;
    const destino = this.resolver(relativa);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
    return relativa;
  }

  async leer(ruta: string): Promise<Uint8Array> {
    return readFile(this.resolver(ruta));
  }

  async eliminar(ruta: string): Promise<void> {
    await rm(this.resolver(ruta), { force: true });
  }
}

export function fileStore(): FileStore {
  return new DiskFileStore(process.env.FILE_STORE_DIR ?? "./storage");
}
