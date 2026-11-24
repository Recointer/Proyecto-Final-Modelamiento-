import { describe, expect, it } from "vitest";
import {
  crearSocio,
  desactivarSocio,
  editarSocio,
  listarSocios,
  obtenerSocio,
  reactivarSocio,
  TAMANO_PAGINA_SOCIOS,
} from "@/server/services/socio-service";
import { listarSectores } from "@/server/services/configuracion-service";
import { eliminarSector } from "@/server/services/configuracion-service";
import { filtrosSocioSchema } from "@/server/validation/socio";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearPredioDirecto, crearSectorDirecto, crearSocioDirecto, crearUsuarioDirecto } from "./helpers";

const CED_1 = "0926687856";
const CED_2 = "1713175071";

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
  const secA = await crearSectorDirecto(a, "Norte");
  const secA2 = await crearSectorDirecto(a, "Sur");
  const secB = await crearSectorDirecto(b, "Norte");
  const secretarioA = await crearUsuarioDirecto({ tenantId: a, cedula: "1710034065", rol: "secretario" });
  const secretarioB = await crearUsuarioDirecto({ tenantId: b, cedula: "1710034065", rol: "secretario" });
  return {
    a,
    b,
    secA,
    secA2,
    secB,
    ctxA: { role: "tenant" as const, tenantId: a, userId: secretarioA },
    ctxB: { role: "tenant" as const, tenantId: b, userId: secretarioB },
  };
}

const f = (o: Record<string, unknown> = {}) => filtrosSocioSchema.parse(o);
const datos = (sectorId: string, extra: Record<string, unknown> = {}) => ({
  cedula: CED_1,
  nombres: "Ana Torres",
  sectorId,
  fechaIngreso: "2020-05-10",
  ...extra,
});

describe("crear socios (RF-07)", () => {
  it("registra al socio como activo, normaliza datos y audita", async () => {
    const { a, secA, ctxA } = await escenario();
    const { id } = await crearSocio(ctxA, datos(secA, { cedula: "092668-7856", correo: "ANA@Correo.com", telefono: "0991234567" }));
    const s = await obtenerSocio(ctxA, id);
    expect(s).toMatchObject({
      cedula: CED_1,
      nombres: "Ana Torres",
      correo: "ana@correo.com",
      telefono: "0991234567",
      estado: "activo",
      sectorNombre: "Norte",
      fechaIngreso: "2020-05-10",
    });
    const [aud] = await adminSql()`SELECT tenant_id, actor_id, despues FROM audit_log WHERE accion = 'socio.crear'`;
    expect(aud).toMatchObject({ tenant_id: a, actor_id: ctxA.userId });
    expect(aud?.despues.cedula).toBe(CED_1);
  });

  it("rechaza cédula inválida y fecha futura", async () => {
    const { secA, ctxA } = await escenario();
    expect(await codigo(crearSocio(ctxA, datos(secA, { cedula: "1234567890" })))).toBe("CEDULA_INVALIDA");
    expect(await codigo(crearSocio(ctxA, datos(secA, { fechaIngreso: "2999-01-01" })))).toBe("FECHA_FUTURA");
    expect(await adminSql()`SELECT 1 FROM socio`).toHaveLength(0);
  });

  it("rechaza cédula y correo duplicados en la misma junta con mensajes de socio", async () => {
    const { secA, ctxA } = await escenario();
    await crearSocio(ctxA, datos(secA, { correo: "ana@correo.com" }));
    try {
      await crearSocio(ctxA, datos(secA, { correo: "otro@correo.com" }));
      expect.fail("debía rechazar la cédula duplicada");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).codigo).toBe("CEDULA_DUPLICADA");
      expect((e as AppError).campo).toBe("cedula");
      expect((e as AppError).message).toBe("Ya existe un socio con esa cédula en la junta.");
    }
    expect(await codigo(crearSocio(ctxA, datos(secA, { cedula: CED_2, correo: "ANA@correo.com" })))).toBe("CORREO_DUPLICADO");
  });

  it("la misma cédula y correo pueden existir en otra junta", async () => {
    const { secA, secB, ctxA, ctxB } = await escenario();
    await crearSocio(ctxA, datos(secA, { correo: "ana@correo.com" }));
    await expect(crearSocio(ctxB, datos(secB, { correo: "ana@correo.com" }))).resolves.toBeDefined();
  });

  it("no permite un sector de otra junta ni inexistente", async () => {
    const { secB, ctxA } = await escenario();
    expect(await codigo(crearSocio(ctxA, datos(secB)))).toBe("SECTOR_NO_ENCONTRADO");
    expect(await codigo(crearSocio(ctxA, datos("00000000-0000-4000-8000-000000000000")))).toBe("SECTOR_NO_ENCONTRADO");
  });
});

describe("editar, dar de baja y reactivar", () => {
  it("edita datos y sector, sin tocar la cédula, y audita antes y después", async () => {
    const { secA, secA2, ctxA } = await escenario();
    const { id } = await crearSocio(ctxA, datos(secA));
    await editarSocio(ctxA, id, {
      nombres: "Ana María Torres",
      sectorId: secA2,
      telefono: "0987654321",
      correo: "ana.m@correo.com",
      fechaIngreso: "2019-01-01",
    });
    const s = await obtenerSocio(ctxA, id);
    expect(s).toMatchObject({
      cedula: CED_1,
      nombres: "Ana María Torres",
      sectorNombre: "Sur",
      telefono: "0987654321",
      correo: "ana.m@correo.com",
      fechaIngreso: "2019-01-01",
    });
    const [aud] = await adminSql()`SELECT antes, despues FROM audit_log WHERE accion = 'socio.editar'`;
    expect(aud?.antes.nombres).toBe("Ana Torres");
    expect(aud?.despues.nombres).toBe("Ana María Torres");
  });

  it("rechaza un correo ya usado por otro socio, una fecha futura y un socio inexistente", async () => {
    const { secA, ctxA } = await escenario();
    await crearSocio(ctxA, datos(secA, { correo: "ana@correo.com" }));
    const otro = await crearSocio(ctxA, datos(secA, { cedula: CED_2, nombres: "Luis Pérez", correo: "luis@correo.com" }));
    const base = { nombres: "Luis Pérez", sectorId: secA, fechaIngreso: "2020-01-01" };
    expect(await codigo(editarSocio(ctxA, otro.id, { ...base, correo: "ana@correo.com" }))).toBe("CORREO_DUPLICADO");
    expect(await codigo(editarSocio(ctxA, otro.id, { ...base, fechaIngreso: "2999-01-01" }))).toBe("FECHA_FUTURA");
    expect(await codigo(editarSocio(ctxA, "00000000-0000-4000-8000-000000000000", base))).toBe("SOCIO_NO_ENCONTRADO");
  });

  it("la baja es lógica: conserva al socio y sus predios; reactivar lo devuelve", async () => {
    const { a, secA, ctxA } = await escenario();
    const { id } = await crearSocio(ctxA, datos(secA));
    await crearPredioDirecto({ tenantId: a, sectorId: secA, socioId: id });

    await desactivarSocio(ctxA, id);
    expect((await obtenerSocio(ctxA, id))?.estado).toBe("inactivo");
    expect(await adminSql()`SELECT 1 FROM predio WHERE socio_id = ${id}`).toHaveLength(1);

    await reactivarSocio(ctxA, id);
    expect((await obtenerSocio(ctxA, id))?.estado).toBe("activo");

    const acciones = (await adminSql()`SELECT accion FROM audit_log ORDER BY creado_en`).map((r) => r.accion);
    expect(acciones).toEqual(expect.arrayContaining(["socio.desactivar", "socio.reactivar"]));
  });

  it("desactivar dos veces no duplica la auditoría", async () => {
    const { secA, ctxA } = await escenario();
    const { id } = await crearSocio(ctxA, datos(secA));
    await desactivarSocio(ctxA, id);
    await desactivarSocio(ctxA, id);
    expect(await adminSql()`SELECT 1 FROM audit_log WHERE accion = 'socio.desactivar'`).toHaveLength(1);
  });
});

describe("listado, búsqueda y filtros", () => {
  async function sembrar(tenantId: string, sectorId: string, n: number, sectorId2?: string) {
    await adminSql()`
      INSERT INTO socio (tenant_id, cedula, nombres, sector_id, estado, fecha_ingreso)
      SELECT ${tenantId}, '17' || lpad(g::text, 8, '0'), 'Socio ' || lpad(g::text, 4, '0'),
             CASE WHEN g % 2 = 0 THEN ${sectorId}::uuid ELSE ${sectorId2 ?? sectorId}::uuid END,
             CASE WHEN g % 7 = 0 THEN 'inactivo'::estado_socio ELSE 'activo'::estado_socio END, '2020-01-01'
      FROM generate_series(1, ${n}) g`;
  }

  it("pagina, ordena por nombre y reporta el total", async () => {
    const { a, secA, ctxA } = await escenario();
    await sembrar(a, secA, 45);
    const p1 = await listarSocios(ctxA, f());
    expect(p1.total).toBe(45);
    expect(p1.items).toHaveLength(TAMANO_PAGINA_SOCIOS);
    expect(p1.paginas).toBe(3);
    const nombres = p1.items.map((s) => s.nombres);
    expect(nombres).toEqual([...nombres].sort());
    expect((await listarSocios(ctxA, f({ pagina: 3 }))).items).toHaveLength(5);
    expect((await listarSocios(ctxA, f({ pagina: 99 }))).pagina).toBe(3);
  });

  it("busca por nombre o cédula y filtra por sector y estado", async () => {
    const { a, secA, secA2, ctxA } = await escenario();
    await sembrar(a, secA, 30, secA2);
    expect((await listarSocios(ctxA, f({ busqueda: "socio 0017" }))).items.map((s) => s.nombres)).toEqual(["Socio 0017"]);
    expect((await listarSocios(ctxA, f({ busqueda: "1700000017" }))).total).toBe(1);

    const porSector = await listarSocios(ctxA, f({ sectorId: secA }));
    expect(porSector.items.every((s) => s.sectorId === secA)).toBe(true);
    expect(porSector.total).toBe(15);

    const inactivos = await listarSocios(ctxA, f({ estado: "inactivo" }));
    expect(inactivos.items.every((s) => s.estado === "inactivo")).toBe(true);
    expect(inactivos.total).toBe(4); // g = 7, 14, 21, 28
  });

  it("trata % y _ como texto literal y no falla sin resultados", async () => {
    const { a, secA, ctxA } = await escenario();
    await sembrar(a, secA, 5);
    expect((await listarSocios(ctxA, f({ busqueda: "%" }))).total).toBe(0);
    expect((await listarSocios(ctxA, f({ busqueda: "Socio_0001" }))).total).toBe(0);
    expect(await listarSocios(ctxA, f({ busqueda: "no-existe-xyz" }))).toMatchObject({ total: 0, paginas: 1, items: [] });
  });

  it("responde en menos de 2 segundos con 1.000 socios (SC-004)", async () => {
    const { a, secA, secA2, ctxA } = await escenario();
    await sembrar(a, secA, 1000, secA2);
    await adminSql().unsafe("ANALYZE socio");
    const inicio = performance.now();
    const lista = await listarSocios(ctxA, f());
    const busqueda = await listarSocios(ctxA, f({ busqueda: "Socio 05", estado: "activo", sectorId: secA }));
    const ms = performance.now() - inicio;
    expect(lista.total).toBe(1000);
    expect(busqueda.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
  });
});

describe("aislamiento y sectores", () => {
  it("una junta no ve, edita ni da de baja a los socios de otra", async () => {
    const { b, secA, secB, ctxA } = await escenario();
    const ajeno = await crearSocioDirecto({ tenantId: b, sectorId: secB, cedula: CED_1, nombres: "Socio Ajeno" });
    expect(await obtenerSocio(ctxA, ajeno)).toBeNull();
    expect(await codigo(editarSocio(ctxA, ajeno, { nombres: "Hackeado Total", sectorId: secA, fechaIngreso: "2020-01-01" }))).toBe(
      "SOCIO_NO_ENCONTRADO",
    );
    expect(await codigo(desactivarSocio(ctxA, ajeno))).toBe("SOCIO_NO_ENCONTRADO");
    expect((await listarSocios(ctxA, f())).items.map((s) => s.id)).not.toContain(ajeno);
    const [intacto] = await adminSql()`SELECT nombres, estado FROM socio WHERE id = ${ajeno}`;
    expect(intacto).toMatchObject({ nombres: "Socio Ajeno", estado: "activo" });
  });

  it("un sector con socios no se puede eliminar", async () => {
    const { secA, ctxA } = await escenario();
    await crearSocio(ctxA, datos(secA));
    expect(await codigo(eliminarSector(ctxA, secA))).toBe("SECTOR_CON_ASOCIADOS");
  });

  it("listarSectores devuelve los sectores de la junta ordenados", async () => {
    const { ctxA } = await escenario();
    expect((await listarSectores(ctxA)).map((s) => s.nombre)).toEqual(["Norte", "Sur"]);
  });
});
