import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/result";
import { DiskFileStore, MAX_BYTES, validarArchivo } from "@/server/files/file-store";

const PDF = new TextEncoder().encode("%PDF-1.4\n% prueba\n");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const TXT = new TextEncoder().encode("texto plano");

let base: string;
let store: DiskFileStore;

beforeEach(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), "filestore-"));
  store = new DiskFileStore(base);
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
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

describe("FileStore", () => {
  it("guarda PDF, PNG y JPEG por defecto con la extensión real", async () => {
    expect(await store.guardar(PDF, "actas")).toMatch(/^actas\/[\w-]+\.pdf$/);
    expect(await store.guardar(PNG, "actas")).toMatch(/\.png$/);
    expect(await store.guardar(JPG, "actas")).toMatch(/\.jpg$/);
  });

  it("acepta subcarpetas anidadas y las crea", async () => {
    const ruta = await store.guardar(PNG, "predios/11111111-2222-3333-4444-555555555555", ["png", "jpg"], "IMAGEN_INVALIDA");
    expect(ruta).toMatch(/^predios\/11111111-2222-3333-4444-555555555555\/[\w-]+\.png$/);
    expect((await stat(path.join(base, ruta))).isFile()).toBe(true);
    expect(Buffer.from(await store.leer(ruta)).equals(Buffer.from(PNG))).toBe(true);
  });

  it("limita los tipos permitidos y usa el código de error indicado", async () => {
    expect(await codigo(store.guardar(PDF, "predios/x", ["png", "jpg"], "IMAGEN_INVALIDA"))).toBe("IMAGEN_INVALIDA");
    expect(await codigo(store.guardar(TXT, "predios/x", ["png", "jpg"], "IMAGEN_INVALIDA"))).toBe("IMAGEN_INVALIDA");
    expect(await codigo(store.guardar(TXT, "actas"))).toBe("ACTA_INVALIDA");
  });

  it("el mensaje es claro según los tipos permitidos", () => {
    expect(() => validarArchivo(PDF, ["png", "jpg"], "IMAGEN_INVALIDA", "imagen")).toThrow(/PNG o JPEG/);
    expect(() => validarArchivo(TXT)).toThrow(/PDF o imagen/);
  });

  it("rechaza archivos vacíos o de más de 5 MB", () => {
    expect(() => validarArchivo(new Uint8Array(0))).toThrow();
    const grande = new Uint8Array(MAX_BYTES + 1);
    grande.set(PDF);
    expect(() => validarArchivo(grande)).toThrow();
  });

  it("rechaza subcarpetas que intentan salir de la base", async () => {
    for (const mala of ["..", "../fuera", "a/../b", "a//b", "", "con espacio", "a\\b"]) {
      expect(await codigo(store.guardar(PDF, mala)), `subcarpeta «${mala}»`).toBe("ACTA_INVALIDA");
    }
  });

  it("no lee ni elimina fuera de la base", async () => {
    expect(await codigo(store.leer("../../etc/passwd"))).toBe("NO_AUTORIZADO");
    expect(await codigo(store.eliminar("../fuera.txt"))).toBe("NO_AUTORIZADO");
  });

  it("elimina un archivo y no falla si ya no existe", async () => {
    const ruta = await store.guardar(PDF, "actas");
    await store.eliminar(ruta);
    await expect(readFile(path.join(base, ruta))).rejects.toThrow();
    await expect(store.eliminar(ruta)).resolves.toBeUndefined();
  });
});
