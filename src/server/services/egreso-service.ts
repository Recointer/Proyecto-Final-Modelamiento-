import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@/lib/result";
import { withTenant, type DbContext } from "../db/context";
import { egreso } from "../db/schema";
import { detectarTipo, fileStore, validarArchivo } from "../files/file-store";
import type { EntradaEgreso } from "../validation/finanzas";
import { auditar } from "./audit";
import { TAMANO_PAGINA } from "./cargo-service";

type CtxTenant = Extract<DbContext, { role: "tenant" }>;

export interface FiltrosEgreso {
  categoria?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  pagina?: number;
}

export interface FilaEgreso {
  id: string;
  fecha: string;
  categoria: "compras" | "trabajos" | "honorarios" | "tasas" | "otros";
  descripcion: string;
  beneficiario: string;
  monto: string;
  tieneRespaldo: boolean;
  anulado: boolean;
  motivoAnulacion: string | null;
}

export interface ListadoEgresos {
  items: FilaEgreso[];
  total: number;
  /** Suma de los egresos vigentes (no anulados) de todo el filtro. */
  totalVigente: string;
  pagina: number;
  paginas: number;
}

const CATEGORIAS = ["compras", "trabajos", "honorarios", "tasas", "otros"] as const;

function condiciones(ctx: CtxTenant, f: FiltrosEgreso): SQL | undefined {
  const b = f.busqueda?.trim();
  const categoria = CATEGORIAS.find((c) => c === f.categoria);
  return and(
    eq(egreso.tenantId, ctx.tenantId),
    categoria ? eq(egreso.categoria, categoria) : undefined,
    f.desde ? gte(egreso.fecha, f.desde) : undefined,
    f.hasta ? lte(egreso.fecha, f.hasta) : undefined,
    b
      ? or(
          ilike(egreso.descripcion, `%${b.replace(/[%_\\]/g, "\\$&")}%`),
          ilike(egreso.beneficiario, `%${b.replace(/[%_\\]/g, "\\$&")}%`),
        )
      : undefined,
  );
}

const columnas = {
  id: egreso.id,
  fecha: egreso.fecha,
  categoria: egreso.categoria,
  descripcion: egreso.descripcion,
  beneficiario: egreso.beneficiario,
  monto: egreso.monto,
  tieneRespaldo: sql<boolean>`${egreso.respaldoRuta} is not null`,
  anulado: sql<boolean>`${egreso.anuladoEn} is not null`,
  motivoAnulacion: egreso.motivoAnulacion,
};

export async function listarEgresos(ctx: CtxTenant, f: FiltrosEgreso = {}): Promise<ListadoEgresos> {
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1));
  return withTenant(ctx, async (tx) => {
    const where = condiciones(ctx, f);
    const [t] = await tx
      .select({
        n: sql<number>`count(*)::int`,
        suma: sql<string>`coalesce(sum(${egreso.monto}) filter (where ${egreso.anuladoEn} is null), 0)::numeric(12,2)::text`,
      })
      .from(egreso)
      .where(where);
    const items = await tx
      .select(columnas)
      .from(egreso)
      .where(where)
      .orderBy(desc(egreso.fecha), desc(egreso.creadoEn))
      .limit(TAMANO_PAGINA)
      .offset((pagina - 1) * TAMANO_PAGINA);
    const total = t?.n ?? 0;
    return { items, total, totalVigente: t?.suma ?? "0.00", pagina, paginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA)) };
  });
}

export async function egresosParaReporte(ctx: CtxTenant, f: FiltrosEgreso): Promise<FilaEgreso[]> {
  return withTenant(ctx, (tx) => tx.select(columnas).from(egreso).where(condiciones(ctx, f)).orderBy(egreso.fecha, egreso.creadoEn));
}

export async function registrarEgreso(ctx: CtxTenant, e: EntradaEgreso, respaldo: Uint8Array | null): Promise<{ id: string }> {
  let ruta: string | null = null;
  if (respaldo) {
    validarArchivo(respaldo, ["pdf", "png", "jpg"], "RESPALDO_INVALIDO", "respaldo");
    ruta = await fileStore().guardar(respaldo, `egresos/${ctx.tenantId}`, ["pdf", "png", "jpg"], "RESPALDO_INVALIDO");
  }
  try {
    return await withTenant(ctx, async (tx) => {
      const [c] = await tx
        .insert(egreso)
        .values({
          tenantId: ctx.tenantId,
          fecha: e.fecha,
          categoria: e.categoria,
          descripcion: e.descripcion,
          beneficiario: e.beneficiario,
          monto: e.monto,
          respaldoRuta: ruta,
          creadoPor: ctx.userId,
        })
        .returning({ id: egreso.id });
      await auditar(tx, {
        actorId: ctx.userId,
        tenantId: ctx.tenantId,
        accion: "egreso.registrar",
        entidad: "egreso",
        entidadId: c!.id,
        despues: { ...e, conRespaldo: ruta !== null },
      });
      return { id: c!.id };
    });
  } catch (err) {
    if (ruta) await fileStore().eliminar(ruta);
    throw err;
  }
}

export async function anularEgreso(ctx: CtxTenant, id: string, motivo: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const [x] = await tx
      .select()
      .from(egreso)
      .where(and(eq(egreso.id, id), eq(egreso.tenantId, ctx.tenantId)))
      .for("update")
      .limit(1);
    if (!x) throw new AppError("EGRESO_NO_ENCONTRADO");
    if (x.anuladoEn) throw new AppError("EGRESO_ANULADO");
    await tx
      .update(egreso)
      .set({ anuladoEn: new Date(), anuladoPor: ctx.userId, motivoAnulacion: motivo })
      .where(and(eq(egreso.id, id), eq(egreso.tenantId, ctx.tenantId)));
    await auditar(tx, {
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      accion: "egreso.anular",
      entidad: "egreso",
      entidadId: id,
      antes: { monto: x.monto, categoria: x.categoria, fecha: x.fecha },
      despues: { motivo },
    });
  });
}

export async function obtenerRespaldo(ctx: CtxTenant, id: string): Promise<{ datos: Uint8Array; mime: string } | null> {
  const ruta = await withTenant(ctx, async (tx) => {
    const [f] = await tx
      .select({ ruta: egreso.respaldoRuta })
      .from(egreso)
      .where(and(eq(egreso.id, id), eq(egreso.tenantId, ctx.tenantId)))
      .limit(1);
    return f?.ruta ?? null;
  });
  if (!ruta) return null;
  try {
    const datos = await fileStore().leer(ruta);
    return { datos, mime: detectarTipo(datos)?.mime ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
