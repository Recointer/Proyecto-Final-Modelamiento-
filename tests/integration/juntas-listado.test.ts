import { describe, expect, it } from "vitest";
import { listarJuntas, listarUbicaciones, TAMANO_PAGINA } from "@/server/services/junta-service";
import { filtrosJuntaSchema } from "@/server/validation/junta";
import { adminSql } from "./setup";

const ctx = { role: "super_admin" as const, userId: "00000000-0000-0000-0000-000000000001" };
const f = (o: Record<string, unknown> = {}) => filtrosJuntaSchema.parse(o);

async function sembrar(n: number) {
  const sql = adminSql();
  const provincias = ["Pichincha", "Tungurahua", "Azuay", "Imbabura", "Cotopaxi"];
  await sql.unsafe(`
    INSERT INTO junta (slug, nombre, tipo, provincia, canton, parroquia)
    SELECT 'junta-' || g,
           'Junta ' || g,
           'riego',
           (ARRAY['${provincias.join("','")}'])[1 + g % 5],
           'Canton ' || (g % 10),
           'Parroquia ' || g
    FROM generate_series(1, ${n}) AS g`);
}

describe("listado de juntas", () => {
  it("pagina los resultados y reporta el total", async () => {
    await sembrar(45);
    const p1 = await listarJuntas(ctx, f());
    expect(p1.total).toBe(45);
    expect(p1.items).toHaveLength(TAMANO_PAGINA);
    expect(p1.paginas).toBe(3);
    const p3 = await listarJuntas(ctx, f({ pagina: 3 }));
    expect(p3.items).toHaveLength(5);
  });

  it("busca por nombre o identificador sin distinguir mayúsculas", async () => {
    await sembrar(30);
    const r = await listarJuntas(ctx, f({ busqueda: "JUNTA 17" }));
    expect(r.items.map((j) => j.nombre)).toEqual(["Junta 17"]);
    const porSlug = await listarJuntas(ctx, f({ busqueda: "junta-2" }));
    expect(porSlug.total).toBeGreaterThan(1);
  });

  it("trata % y _ de la búsqueda como texto literal", async () => {
    await sembrar(10);
    expect((await listarJuntas(ctx, f({ busqueda: "%" }))).total).toBe(0);
    expect((await listarJuntas(ctx, f({ busqueda: "Junta_1" }))).total).toBe(0);
  });

  it("filtra por provincia, cantón y parroquia", async () => {
    await sembrar(50);
    const porProvincia = await listarJuntas(ctx, f({ provincia: "pichincha" }));
    expect(porProvincia.items.every((j) => j.provincia === "Pichincha")).toBe(true);
    expect(porProvincia.total).toBe(10);

    const combinado = await listarJuntas(ctx, f({ provincia: "Pichincha", canton: "Canton 0" }));
    expect(combinado.items.every((j) => j.provincia === "Pichincha" && j.canton === "Canton 0")).toBe(true);

    const porParroquia = await listarJuntas(ctx, f({ parroquia: "Parroquia 7" }));
    expect(porParroquia.total).toBe(1);
  });

  it("filtra por estado", async () => {
    await sembrar(10);
    await adminSql()`UPDATE junta SET estado = 'desactivada' WHERE slug IN ('junta-1', 'junta-2')`;
    expect((await listarJuntas(ctx, f({ estado: "desactivada" }))).total).toBe(2);
    expect((await listarJuntas(ctx, f({ estado: "activa" }))).total).toBe(8);
  });

  it("devuelve vacío sin error cuando nada coincide", async () => {
    await sembrar(5);
    const r = await listarJuntas(ctx, f({ busqueda: "no-existe-xyz" }));
    expect(r.items).toHaveLength(0);
    expect(r.total).toBe(0);
    expect(r.paginas).toBe(1);
  });

  it("una página fuera de rango se ajusta a la última", async () => {
    await sembrar(25);
    const r = await listarJuntas(ctx, f({ pagina: 99 }));
    expect(r.pagina).toBe(2);
    expect(r.items).toHaveLength(5);
  });

  it("lista ubicaciones distintas para los filtros", async () => {
    await sembrar(20);
    const u = await listarUbicaciones(ctx);
    expect(u.provincias).toHaveLength(5);
    expect(u.cantones).toHaveLength(10);
  });

  it("responde en menos de 2 segundos con 500 juntas (SC-006)", async () => {
    await sembrar(500);
    await adminSql().unsafe("ANALYZE junta");
    const inicio = performance.now();
    const r = await listarJuntas(ctx, f({ busqueda: "junta 4", provincia: "Azuay" }));
    const lista = await listarJuntas(ctx, f());
    const ms = performance.now() - inicio;
    expect(lista.total).toBe(500);
    expect(r.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
  });
});
