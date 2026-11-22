import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, descripcionSegura, ejecutar } from "@/lib/result";

afterEach(() => vi.restoreAllMocks());

describe("ejecutar", () => {
  it("convierte AppError en un resultado con su código y mensaje", async () => {
    const r = await ejecutar(async () => {
      throw new AppError("CEDULA_INVALIDA", undefined, "cedula");
    });
    expect(r).toEqual({
      ok: false,
      error: { codigo: "CEDULA_INVALIDA", mensaje: "La cédula no es válida.", campo: "cedula" },
    });
  });

  it("devuelve ok con los datos", async () => {
    expect(await ejecutar(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("oculta los errores internos al usuario y NO registra su mensaje (puede traer parámetros SQL)", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const errorBd = Object.assign(
      new Error('Failed query: insert into "usuario" ... params: 1710034065,$argon2id$v=19$secreto-hash'),
      { name: "DrizzleQueryError", cause: { code: "23505" } },
    );
    const r = await ejecutar(async () => {
      throw errorBd;
    });
    expect(r).toMatchObject({ ok: false, error: { codigo: "ERROR_INTERNO" } });
    expect(JSON.stringify(r)).not.toContain("argon2id");

    const registrado = espia.mock.calls.flat().join(" ");
    expect(registrado).not.toContain("argon2id");
    expect(registrado).not.toContain("1710034065");
    expect(registrado).toContain("DrizzleQueryError");
    expect(registrado).toContain("23505");
  });
});

describe("descripcionSegura", () => {
  it("usa solo el nombre del error y el código, nunca el mensaje", () => {
    expect(descripcionSegura(new TypeError("dato sensible"))).toBe("TypeError");
    expect(descripcionSegura(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("Error (código ECONNRESET)");
    expect(descripcionSegura("texto")).toBe("string");
  });
});
