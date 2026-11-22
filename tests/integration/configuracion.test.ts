import { afterEach, describe, expect, it } from "vitest";
import {
  actualizarConfiguracion,
  crearSector,
  editarSector,
  eliminarSector,
  obtenerConfiguracion,
} from "@/server/services/configuracion-service";
import { AppError } from "@/lib/result";
import type { EntradaConfiguracion } from "@/server/validation/configuracion";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearUsuarioDirecto } from "./helpers";

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
  const adminA = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "admin_junta" });
  const adminB = await crearUsuarioDirecto({ tenantId: b, cedula: "0926687856", rol: "admin_junta" });
  return {
    a,
    b,
    ctxA: { role: "tenant" as const, tenantId: a, userId: adminA },
    ctxB: { role: "tenant" as const, tenantId: b, userId: adminB },
  };
}

const entrada = (extra: Partial<EntradaConfiguracion> = {}): EntradaConfiguracion => ({
  nombre: "Junta A Renombrada",
  tipo: "agua_potable",
  provincia: "Tungurahua",
  canton: "Ambato",
  parroquia: "Pilahuín",
  contactoNombre: "Rosa Pérez",
  contactoTelefono: "0991234567",
  contactoCorreo: "contacto@junta.ec",
  parametros: { multaAsamblea: 5, multaMinga: 2.5, quorumPorcentaje: 60 },
  ...extra,
});

describe("configuración de la junta (RF-02)", () => {
  it("devuelve los datos de su propia junta con parámetros por defecto", async () => {
    const { ctxA } = await escenario();
    const c = await obtenerConfiguracion(ctxA);
    expect(c.junta.slug).toBe("junta-a");
    expect(c.parametros).toEqual({ multaAsamblea: 0, multaMinga: 0, quorumPorcentaje: 50 });
    expect(c.sectores).toEqual([]);
  });

  it("actualiza datos generales, contacto y parámetros, y audita antes y después", async () => {
    const { a, ctxA } = await escenario();
    await actualizarConfiguracion(ctxA, entrada());

    const c = await obtenerConfiguracion(ctxA);
    expect(c.junta).toMatchObject({ nombre: "Junta A Renombrada", tipo: "agua_potable", parroquia: "Pilahuín" });
    expect(c.junta.contactoCorreo).toBe("contacto@junta.ec");
    expect(c.parametros).toEqual({ multaAsamblea: 5, multaMinga: 2.5, quorumPorcentaje: 60 });

    const [aud] = await adminSql()`SELECT actor_id, tenant_id, antes, despues FROM audit_log WHERE accion = 'junta.configurar'`;
    expect(aud?.tenant_id).toBe(a);
    expect(aud?.antes.nombre).toBe("Junta A");
    expect(aud?.despues.parametros.quorumPorcentaje).toBe(60);
  });

  it("no cambia el estado ni el identificador de acceso, que son de la plataforma", async () => {
    const { a, ctxA } = await escenario();
    await actualizarConfiguracion(ctxA, entrada());
    const [j] = await adminSql()`SELECT slug, estado FROM junta WHERE id = ${a}`;
    expect(j).toMatchObject({ slug: "junta-a", estado: "activa" });
  });

  it("no toca los datos de otra junta", async () => {
    const { b, ctxA } = await escenario();
    await actualizarConfiguracion(ctxA, entrada());
    const [otra] = await adminSql()`SELECT nombre, parametros FROM junta WHERE id = ${b}`;
    expect(otra?.nombre).toBe("Junta B");
    expect(otra?.parametros).toEqual({});
  });

  it("rechaza un nombre que choca con otra junta de la misma parroquia sin revelar datos", async () => {
    const { b, ctxA } = await escenario();
    await adminSql()`UPDATE junta SET nombre = 'Nombre Ocupado', parroquia = 'Pilahuín' WHERE id = ${b}`;
    expect(await codigo(actualizarConfiguracion(ctxA, entrada({ nombre: "nombre ocupado" })))).toBe("JUNTA_DUPLICADA");
  });
});

describe("sectores (RF-02)", () => {
  it("crea, lista ordenados, edita y elimina sectores con auditoría", async () => {
    const { ctxA } = await escenario();
    const norte = await crearSector(ctxA, { nombre: "Norte", descripcion: "Zona alta" });
    await crearSector(ctxA, { nombre: "centro" });
    await crearSector(ctxA, { nombre: "Alto" });
    expect((await obtenerConfiguracion(ctxA)).sectores.map((s) => s.nombre)).toEqual(["Alto", "centro", "Norte"]);

    const editado = await editarSector(ctxA, norte.id, { nombre: "Norte Alto" });
    expect(editado).toMatchObject({ nombre: "Norte Alto", descripcion: null });

    await eliminarSector(ctxA, norte.id);
    expect((await obtenerConfiguracion(ctxA)).sectores).toHaveLength(2);

    const acciones = (await adminSql()`SELECT accion FROM audit_log ORDER BY creado_en`).map((r) => r.accion);
    expect(acciones).toEqual(expect.arrayContaining(["sector.crear", "sector.editar", "sector.eliminar"]));
  });

  it("no permite nombres repetidos en la misma junta (sin distinguir mayúsculas)", async () => {
    const { ctxA } = await escenario();
    const s = await crearSector(ctxA, { nombre: "Norte" });
    expect(await codigo(crearSector(ctxA, { nombre: "NORTE" }))).toBe("SECTOR_DUPLICADO");
    const otro = await crearSector(ctxA, { nombre: "Sur" });
    expect(await codigo(editarSector(ctxA, otro.id, { nombre: "norte" }))).toBe("SECTOR_DUPLICADO");
    // editar un sector conservando su propio nombre no es un duplicado
    await expect(editarSector(ctxA, s.id, { nombre: "Norte", descripcion: "otra" })).resolves.toBeDefined();
  });

  it("dos juntas pueden tener un sector con el mismo nombre", async () => {
    const { ctxA, ctxB } = await escenario();
    await crearSector(ctxA, { nombre: "Central" });
    await expect(crearSector(ctxB, { nombre: "Central" })).resolves.toBeDefined();
  });

  it("una junta no puede ver, editar ni eliminar los sectores de otra", async () => {
    const { ctxA, ctxB } = await escenario();
    const deB = await crearSector(ctxB, { nombre: "Reservado B" });

    expect((await obtenerConfiguracion(ctxA)).sectores).toHaveLength(0);
    expect(await codigo(editarSector(ctxA, deB.id, { nombre: "Hackeado" }))).toBe("SECTOR_NO_ENCONTRADO");
    expect(await codigo(eliminarSector(ctxA, deB.id))).toBe("SECTOR_NO_ENCONTRADO");
    const [intacto] = await adminSql()`SELECT nombre FROM sector WHERE id = ${deB.id}`;
    expect(intacto?.nombre).toBe("Reservado B");
  });

  describe("sector con asociados (FR-014)", () => {
    afterEach(async () => {
      await adminSql().unsafe("DROP TABLE IF EXISTS predio_prueba");
    });

    it("no se puede eliminar un sector referenciado por socios o predios, y no se pierde nada", async () => {
      const { ctxA, a } = await escenario();
      const s = await crearSector(ctxA, { nombre: "Con predios" });
      // simula un módulo futuro cuya tabla referencia sector (ON DELETE RESTRICT por defecto)
      await adminSql().unsafe(
        "CREATE TABLE predio_prueba (id serial PRIMARY KEY, tenant_id uuid, sector_id uuid NOT NULL REFERENCES sector(id))",
      );
      await adminSql()`INSERT INTO predio_prueba (tenant_id, sector_id) VALUES (${a}, ${s.id})`;

      expect(await codigo(eliminarSector(ctxA, s.id))).toBe("SECTOR_CON_ASOCIADOS");
      expect((await obtenerConfiguracion(ctxA)).sectores).toHaveLength(1);

      // al liberar los asociados, ya se puede eliminar
      await adminSql().unsafe("DELETE FROM predio_prueba");
      await expect(eliminarSector(ctxA, s.id)).resolves.toBeUndefined();
    });
  });
});
