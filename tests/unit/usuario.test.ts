import { describe, expect, it } from "vitest";
import { crearUsuarioSchema, editarUsuarioSchema, filtrosUsuarioSchema } from "@/server/validation/usuario";

const base = { cedula: "1710034065", nombres: "Ana Torres", rol: "socio" };

describe("crearUsuarioSchema", () => {
  it("acepta una cuenta mínima y normaliza la cédula", () => {
    const r = crearUsuarioSchema.parse({ ...base, cedula: "171003-4065 " });
    expect(r.cedula).toBe("1710034065");
    expect(r.correo).toBeUndefined();
    expect(r.telefono).toBeUndefined();
  });

  it("rechaza cédulas inválidas", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, cedula: "1710034066" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ ...base, cedula: "abc" }).success).toBe(false);
  });

  it("solo permite los roles gestionables: nunca admin_junta ni super_admin", () => {
    for (const rol of ["secretario", "tesorero", "socio"]) {
      expect(crearUsuarioSchema.safeParse({ ...base, rol }).success, rol).toBe(true);
    }
    for (const rol of ["admin_junta", "super_admin", "root", ""]) {
      expect(crearUsuarioSchema.safeParse({ ...base, rol }).success, rol).toBe(false);
    }
  });

  it("valida y normaliza el correo y trata vacío como ausente", () => {
    expect(crearUsuarioSchema.parse({ ...base, correo: " ANA@Correo.COM " }).correo).toBe("ana@correo.com");
    expect(crearUsuarioSchema.parse({ ...base, correo: "  " }).correo).toBeUndefined();
    expect(crearUsuarioSchema.safeParse({ ...base, correo: "no-es-correo" }).success).toBe(false);
  });

  it("valida el teléfono", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, telefono: "0991234567" }).success).toBe(true);
    expect(crearUsuarioSchema.safeParse({ ...base, telefono: "+593 99 123 4567" }).success).toBe(true);
    expect(crearUsuarioSchema.safeParse({ ...base, telefono: "llamar" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ ...base, telefono: "123" }).success).toBe(false);
  });

  it("exige nombres completos", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, nombres: "Al" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ ...base, nombres: " " }).success).toBe(false);
  });
});

describe("editarUsuarioSchema", () => {
  it("el rol es opcional pero, si viene, debe ser gestionable", () => {
    expect(editarUsuarioSchema.safeParse({ nombres: "Ana Torres" }).success).toBe(true);
    expect(editarUsuarioSchema.safeParse({ nombres: "Ana Torres", rol: "tesorero" }).success).toBe(true);
    expect(editarUsuarioSchema.safeParse({ nombres: "Ana Torres", rol: "admin_junta" }).success).toBe(false);
  });
});

describe("filtrosUsuarioSchema", () => {
  it("usa la página 1 por defecto y rechaza valores no válidos", () => {
    expect(filtrosUsuarioSchema.parse({}).pagina).toBe(1);
    expect(filtrosUsuarioSchema.safeParse({ pagina: "0" }).success).toBe(false);
    expect(filtrosUsuarioSchema.safeParse({ rol: "super_admin" }).success).toBe(false);
    expect(filtrosUsuarioSchema.safeParse({ estado: "borrado" }).success).toBe(false);
    expect(filtrosUsuarioSchema.parse({ rol: "socio", estado: "activo", pagina: "3" })).toMatchObject({
      rol: "socio",
      estado: "activo",
      pagina: 3,
    });
  });
});
