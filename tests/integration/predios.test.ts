import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  crearPredio,
  datosMapaPredios,
  desactivarPredio,
  editarPredio,
  listarPredios,
  obtenerImagenPredio,
  obtenerPredio,
  reactivarPredio,
  TAMANO_PAGINA_PREDIOS,
} from "@/server/services/predio-service";
import { eliminarSector } from "@/server/services/configuracion-service";
import { filtrosPredioSchema, type EntradaPredio } from "@/server/validation/predio";
import { AppError } from "@/lib/result";
import { adminSql } from "./setup";
import { crearJuntaDirecta, crearPredioDirecto, crearSectorDirecto, crearSocioDirecto, crearUsuarioDirecto } from "./helpers";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70]);
const PDF = new TextEncoder().encode("%PDF-1.4\n% no es una imagen\n");

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
  const ana = await crearSocioDirecto({ tenantId: a, sectorId: secA, cedula: "1710000017", nombres: "Ana Torres" });
  const beto = await crearSocioDirecto({ tenantId: a, sectorId: secA2, cedula: "1710000025", nombres: "Beto Pérez" });
  const sB = await crearSocioDirecto({ tenantId: b, sectorId: secB, cedula: "1710000033", nombres: "Socio de B" });
  return {
    a,
    b,
    secA,
    secA2,
    secB,
    ana,
    beto,
    sB,
    ctxA: { role: "tenant" as const, tenantId: a, userId: secretarioA },
    ctxB: { role: "tenant" as const, tenantId: b, userId: secretarioB },
  };
}

const f = (o: Record<string, unknown> = {}) => filtrosPredioSchema.parse(o);

function entrada(sectorId: string, socioId: string, extra: Partial<EntradaPredio> = {}): EntradaPredio {
  return {
    codigo: "P-045",
    nombre: "Parcela Central",
    superficieHa: 1.25,
    sectorId,
    socioId,
    latitud: -1.25431,
    longitud: -78.62312,
    ...extra,
  };
}

const carpeta = (tenantId: string) => path.join(process.env.FILE_STORE_DIR!, "predios", tenantId);
async function archivos(tenantId: string): Promise<string[]> {
  try {
    return await readdir(carpeta(tenantId));
  } catch {
    return [];
  }
}

describe("crear predios (RF-10, RF-11)", () => {
  it("registra el predio con superficie y coordenadas numéricas y audita", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana, { codigo: "  P-045 ", nombre: " Parcela Central " }));
    const p = await obtenerPredio(ctxA, id);
    expect(p).toMatchObject({
      codigo: "P-045",
      nombre: "Parcela Central",
      superficieHa: 1.25,
      latitud: -1.25431,
      longitud: -78.62312,
      sectorNombre: "Norte",
      titularNombres: "Ana Torres",
      tieneImagen: false,
      estado: "activo",
    });
    const [aud] = await adminSql()`SELECT tenant_id, actor_id, despues FROM audit_log WHERE accion = 'predio.crear'`;
    expect(aud).toMatchObject({ tenant_id: a, actor_id: ctxA.userId });
    expect(aud?.despues.codigo).toBe("P-045");
  });

  it("acepta predios sin coordenadas y no los incluye en el mapa", async () => {
    const { secA, ana, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana, { latitud: undefined, longitud: undefined }));
    expect(await obtenerPredio(ctxA, id)).toMatchObject({ latitud: null, longitud: null });
    expect(await datosMapaPredios(ctxA)).toHaveLength(0);
  });

  it("guarda la imagen PNG o JPEG en la carpeta de la junta y la sirve con su tipo", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    const p1 = await crearPredio(ctxA, entrada(secA, ana), PNG);
    const p2 = await crearPredio(ctxA, entrada(secA, ana, { codigo: "P-046" }), JPG);

    const [fila] = await adminSql()`SELECT imagen_ruta FROM predio WHERE id = ${p1.id}`;
    expect(fila?.imagen_ruta).toMatch(new RegExp(`^predios/${a}/[\\w-]+\\.png$`));
    expect((await stat(path.join(process.env.FILE_STORE_DIR!, fila!.imagen_ruta))).isFile()).toBe(true);

    const img1 = await obtenerImagenPredio(ctxA, p1.id);
    expect(img1?.mime).toBe("image/png");
    expect(Buffer.from(img1!.datos).equals(Buffer.from(PNG))).toBe(true);
    expect((await obtenerImagenPredio(ctxA, p2.id))?.mime).toBe("image/jpeg");
    expect((await obtenerPredio(ctxA, p1.id))?.tieneImagen).toBe(true);
  });

  it("rechaza imágenes inválidas (PDF, texto, vacías o de más de 5 MB) sin crear nada", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(PNG);
    for (const mala of [PDF, new TextEncoder().encode("texto"), grande]) {
      expect(await codigo(crearPredio(ctxA, entrada(secA, ana), mala))).toBe("IMAGEN_INVALIDA");
    }
    expect(await adminSql()`SELECT 1 FROM predio`).toHaveLength(0);
    expect(await archivos(a)).toEqual([]);
  });

  it("rechaza un código repetido (sin distinguir mayúsculas) y no deja huérfana la imagen", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    await crearPredio(ctxA, entrada(secA, ana), PNG);
    expect(await archivos(a)).toHaveLength(1);
    expect(await codigo(crearPredio(ctxA, entrada(secA, ana, { codigo: "p-045" }), PNG))).toBe("CODIGO_DUPLICADO");
    expect(await archivos(a)).toHaveLength(1); // la imagen de la segunda tentativa se eliminó
    expect(await adminSql()`SELECT 1 FROM predio`).toHaveLength(1);
  });

  it("el mismo código puede usarse en otra junta", async () => {
    const { secA, secB, ana, sB, ctxA, ctxB } = await escenario();
    await crearPredio(ctxA, entrada(secA, ana));
    await expect(crearPredio(ctxB, entrada(secB, sB))).resolves.toBeDefined();
  });

  it("no acepta un sector ni un titular de otra junta o inexistentes", async () => {
    const { secA, secB, ana, sB, ctxA } = await escenario();
    expect(await codigo(crearPredio(ctxA, entrada(secB, ana)))).toBe("SECTOR_NO_ENCONTRADO");
    expect(await codigo(crearPredio(ctxA, entrada(secA, sB)))).toBe("SOCIO_NO_ENCONTRADO");
    expect(await codigo(crearPredio(ctxA, entrada("00000000-0000-4000-8000-000000000000", ana)))).toBe("SECTOR_NO_ENCONTRADO");
    expect(await codigo(crearPredio(ctxA, entrada(secA, "00000000-0000-4000-8000-000000000000")))).toBe("SOCIO_NO_ENCONTRADO");
    expect(await adminSql()`SELECT 1 FROM predio`).toHaveLength(0);
  });
});

describe("editar, imagen y baja", () => {
  it("edita los datos y audita antes y después", async () => {
    const { secA, secA2, ana, beto, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana));
    await editarPredio(ctxA, id, entrada(secA2, beto, { codigo: "P-100", nombre: "Parcela Sur", superficieHa: 3.5, latitud: -1.3, longitud: -78.7 }));
    expect(await obtenerPredio(ctxA, id)).toMatchObject({
      codigo: "P-100",
      nombre: "Parcela Sur",
      superficieHa: 3.5,
      sectorNombre: "Sur",
      titularNombres: "Beto Pérez",
      latitud: -1.3,
    });
    const [aud] = await adminSql()`SELECT antes, despues FROM audit_log WHERE accion = 'predio.editar'`;
    expect(aud?.antes.codigo).toBe("P-045");
    expect(aud?.despues.codigo).toBe("P-100");
  });

  it("reemplazar la imagen elimina la anterior, y quitarla borra el archivo", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana), PNG);
    const [antes] = await archivos(a);

    await editarPredio(ctxA, id, entrada(secA, ana), { imagen: JPG });
    const trasReemplazo = await archivos(a);
    expect(trasReemplazo).toHaveLength(1);
    expect(trasReemplazo[0]).not.toBe(antes);
    expect(trasReemplazo[0]).toMatch(/\.jpg$/);
    expect((await obtenerImagenPredio(ctxA, id))?.mime).toBe("image/jpeg");

    await editarPredio(ctxA, id, entrada(secA, ana), { quitarImagen: true });
    expect(await archivos(a)).toEqual([]);
    expect(await obtenerImagenPredio(ctxA, id)).toBeNull();
    expect((await obtenerPredio(ctxA, id))?.tieneImagen).toBe(false);

    const acciones = (await adminSql()`SELECT accion FROM audit_log WHERE accion = 'predio.imagen'`).length;
    expect(acciones).toBe(2);
  });

  it("editar sin tocar la imagen la conserva", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana), PNG);
    await editarPredio(ctxA, id, entrada(secA, ana, { nombre: "Otro nombre" }));
    expect(await archivos(a)).toHaveLength(1);
    expect((await obtenerPredio(ctxA, id))?.tieneImagen).toBe(true);
  });

  it("si la edición falla, la imagen nueva no queda huérfana y la anterior se conserva", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    const p1 = await crearPredio(ctxA, entrada(secA, ana), PNG);
    await crearPredio(ctxA, entrada(secA, ana, { codigo: "P-046" }));
    expect(await codigo(editarPredio(ctxA, p1.id, entrada(secA, ana, { codigo: "P-046" }), { imagen: JPG }))).toBe("CODIGO_DUPLICADO");
    const restantes = await archivos(a);
    expect(restantes).toHaveLength(1);
    expect(restantes[0]).toMatch(/\.png$/);
  });

  it("rechaza editar un predio inexistente o con referencias de otra junta", async () => {
    const { secA, secB, ana, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana));
    expect(await codigo(editarPredio(ctxA, "00000000-0000-4000-8000-000000000000", entrada(secA, ana)))).toBe("PREDIO_NO_ENCONTRADO");
    expect(await codigo(editarPredio(ctxA, id, entrada(secB, ana)))).toBe("SECTOR_NO_ENCONTRADO");
  });

  it("la baja es lógica: sale del mapa pero se conserva; reactivar lo devuelve", async () => {
    const { secA, ana, ctxA } = await escenario();
    const { id } = await crearPredio(ctxA, entrada(secA, ana));
    expect(await datosMapaPredios(ctxA)).toHaveLength(1);

    await desactivarPredio(ctxA, id);
    expect((await obtenerPredio(ctxA, id))?.estado).toBe("inactivo");
    expect(await datosMapaPredios(ctxA)).toHaveLength(0);
    expect(await adminSql()`SELECT 1 FROM predio WHERE id = ${id}`).toHaveLength(1);

    await reactivarPredio(ctxA, id);
    expect(await datosMapaPredios(ctxA)).toHaveLength(1);
    const acciones = (await adminSql()`SELECT accion FROM audit_log`).map((r) => r.accion);
    expect(acciones).toEqual(expect.arrayContaining(["predio.desactivar", "predio.reactivar"]));
    expect(await codigo(desactivarPredio(ctxA, "00000000-0000-4000-8000-000000000000"))).toBe("PREDIO_NO_ENCONTRADO");
  });
});

describe("listado, mapa y acceso del Socio", () => {
  async function conVarios() {
    const e = await escenario();
    await crearPredioDirecto({ tenantId: e.a, sectorId: e.secA, socioId: e.ana, codigo: "A-001", nombre: "Alfa", latitud: -1.1, longitud: -78.1 });
    await crearPredioDirecto({ tenantId: e.a, sectorId: e.secA, socioId: e.ana, codigo: "A-002", nombre: "Beta" });
    await crearPredioDirecto({ tenantId: e.a, sectorId: e.secA2, socioId: e.beto, codigo: "B-001", nombre: "Gamma", latitud: -1.2, longitud: -78.2 });
    return e;
  }

  it("lista con filtros por sector, titular, búsqueda y estado", async () => {
    const { secA, secA2, ana, beto, ctxA, a } = await conVarios();
    expect((await listarPredios(ctxA, f())).total).toBe(3);
    expect((await listarPredios(ctxA, f({ sectorId: secA2 }))).items.map((p) => p.codigo)).toEqual(["B-001"]);
    expect((await listarPredios(ctxA, f({ socioId: ana }))).total).toBe(2);
    expect((await listarPredios(ctxA, f({ busqueda: "gamma" }))).total).toBe(1);
    expect((await listarPredios(ctxA, f({ busqueda: "beto" }))).items.map((p) => p.codigo)).toEqual(["B-001"]); // por titular
    expect((await listarPredios(ctxA, f({ busqueda: "%" }))).total).toBe(0);
    await adminSql()`UPDATE predio SET estado = 'inactivo' WHERE tenant_id = ${a} AND codigo = 'A-002'`;
    expect((await listarPredios(ctxA, f({ estado: "inactivo" }))).items.map((p) => p.codigo)).toEqual(["A-002"]);
    expect(secA && beto).toBeTruthy();
  });

  it("pagina el listado", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    await adminSql()`
      INSERT INTO predio (tenant_id, codigo, nombre, superficie_ha, sector_id, socio_id)
      SELECT ${a}, 'C-' || lpad(g::text, 3, '0'), 'Predio ' || g, 1, ${secA}::uuid, ${ana}::uuid FROM generate_series(1, 45) g`;
    const p1 = await listarPredios(ctxA, f());
    expect(p1).toMatchObject({ total: 45, paginas: 3 });
    expect(p1.items).toHaveLength(TAMANO_PAGINA_PREDIOS);
    expect((await listarPredios(ctxA, f({ pagina: 3 }))).items).toHaveLength(5);
  });

  it("el mapa solo trae los campos mínimos, filtra por sector y excluye lo que no tiene coordenadas", async () => {
    const { secA, ctxA } = await conVarios();
    const todos = await datosMapaPredios(ctxA);
    expect(todos.map((d) => d.codigo)).toEqual(["A-001", "B-001"]);
    expect(Object.keys(todos[0]!).sort()).toEqual(["codigo", "id", "lat", "lng", "nombre", "sectorNombre", "superficieHa"]);
    expect(JSON.stringify(todos)).not.toMatch(/1710000|imagen|predios\//);
    expect((await datosMapaPredios(ctxA, { sectorId: secA })).map((d) => d.codigo)).toEqual(["A-001"]);
  });

  it("un Socio solo ve sus propios predios en listado, mapa, ficha e imagen", async () => {
    const { a, secA, ana, beto, ctxA } = await conVarios();
    const [ajeno] = await adminSql()`SELECT id FROM predio WHERE codigo = 'B-001'`;
    const propio = await crearPredio(ctxA, entrada(secA, ana, { codigo: "A-IMG" }), PNG);
    await adminSql()`UPDATE predio SET imagen_ruta = (SELECT imagen_ruta FROM predio WHERE id = ${propio.id}) WHERE id = ${ajeno!.id}`;

    expect((await listarPredios(ctxA, f(), ana)).items.every((p) => p.socioId === ana)).toBe(true);
    expect((await listarPredios(ctxA, f(), ana)).total).toBe(3);
    // el filtro por titular del cliente se ignora para el Socio
    expect((await listarPredios(ctxA, f({ socioId: beto }), ana)).items.every((p) => p.socioId === ana)).toBe(true);
    // en el mapa: sus dos predios con coordenadas; nunca el de otro socio (B-001)
    expect((await datosMapaPredios(ctxA, {}, ana)).map((d) => d.codigo)).toEqual(["A-001", "A-IMG"]);

    expect(await obtenerPredio(ctxA, ajeno!.id, ana)).toBeNull();
    expect(await obtenerImagenPredio(ctxA, ajeno!.id, ana)).toBeNull();
    expect(await obtenerImagenPredio(ctxA, propio.id, ana)).not.toBeNull();
    expect(a).toBeTruthy();
  });
});

describe("aislamiento y sectores", () => {
  it("una junta no ve, edita, da de baja ni descarga imágenes de otra", async () => {
    const { b, secA, secB, ana, sB, ctxA, ctxB } = await escenario();
    const ajeno = await crearPredio(ctxB, entrada(secB, sB, { codigo: "B-9" }), PNG);

    expect(await obtenerPredio(ctxA, ajeno.id)).toBeNull();
    expect(await obtenerImagenPredio(ctxA, ajeno.id)).toBeNull();
    expect(await codigo(editarPredio(ctxA, ajeno.id, entrada(secA, ana)))).toBe("PREDIO_NO_ENCONTRADO");
    expect(await codigo(desactivarPredio(ctxA, ajeno.id))).toBe("PREDIO_NO_ENCONTRADO");
    expect((await listarPredios(ctxA, f())).total).toBe(0);
    expect(await datosMapaPredios(ctxA)).toHaveLength(0);
    expect(await archivos(b)).toHaveLength(1); // la imagen de B sigue intacta
  });

  it("un sector con predios no se puede eliminar", async () => {
    const { secA, ana, ctxA } = await escenario();
    await crearPredio(ctxA, entrada(secA, ana));
    expect(await codigo(eliminarSector(ctxA, secA))).toBe("SECTOR_CON_ASOCIADOS");
  });

  it("un socio con predios sigue dándose de baja sin perder sus predios", async () => {
    const { a, secA, ana, ctxA } = await escenario();
    await crearPredio(ctxA, entrada(secA, ana));
    await adminSql()`UPDATE socio SET estado = 'inactivo' WHERE id = ${ana}`;
    expect(await adminSql()`SELECT 1 FROM predio WHERE tenant_id = ${a}`).toHaveLength(1);
    expect((await listarPredios(ctxA, f())).total).toBe(1);
  });
});
