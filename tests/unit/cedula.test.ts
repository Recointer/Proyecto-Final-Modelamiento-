import { describe, expect, it } from "vitest";
import { normalizarCedula, validarCedula } from "@/server/validation/cedula";

describe("validarCedula", () => {
  it("acepta cédulas válidas", () => {
    expect(validarCedula("1710034065")).toBe(true);
    expect(validarCedula("0926687856")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(validarCedula("1710034066")).toBe(false);
  });

  it("rechaza longitud incorrecta o caracteres no numéricos", () => {
    expect(validarCedula("171003406")).toBe(false);
    expect(validarCedula("17100340655")).toBe(false);
    expect(validarCedula("17100340ab")).toBe(false);
    expect(validarCedula("")).toBe(false);
  });

  it("rechaza provincia inexistente", () => {
    expect(validarCedula("2510034065")).toBe(false);
    expect(validarCedula("0010034065")).toBe(false);
  });

  it("rechaza tercer dígito mayor o igual a 6", () => {
    expect(validarCedula("1760034065")).toBe(false);
  });

  it("normaliza espacios y guiones", () => {
    expect(normalizarCedula("171003-4065 ")).toBe("1710034065");
  });
});
