import Link from "next/link";
import { z } from "zod";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, InsigniaCargo, Paginacion, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarCargos, sociosParaEmision, type FiltrosCargo } from "@/server/services/cargo-service";
import { listarConceptos } from "@/server/services/concepto-service";
import { listarSectores } from "@/server/services/configuracion-service";
import { emitirCargosAction } from "../actions";

export const metadata = { title: "Cuentas por cobrar" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const uuid = (v?: string) => (z.string().uuid().safeParse(v).success ? v : undefined);

export default async function CobrosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx } = await contextoGestion(["tesorero"]);
  const anioActual = Number(hoyEcuador().slice(0, 4));

  const anio = /^\d{4}$/.test(unico(sp.anio) ?? "") ? Number(unico(sp.anio)) : undefined;
  const estado = (["pendiente", "parcial", "pagado", "anulado"] as const).find((e) => e === unico(sp.estado));
  const filtros: FiltrosCargo = {
    anio,
    conceptoId: uuid(unico(sp.conceptoId)),
    sectorId: uuid(unico(sp.sectorId)),
    estado,
    vencido: unico(sp.vencido) === "1",
    busqueda: unico(sp.busqueda),
    pagina: Number(unico(sp.pagina)) || 1,
  };
  const [lista, conceptos, sectores, socios] = await Promise.all([
    listarCargos(ctx, filtros),
    listarConceptos(ctx, { sinMultas: false }),
    listarSectores(ctx),
    sociosParaEmision(ctx),
  ]);
  const activos = conceptos.filter((c) => c.tipo !== "multa" && c.estado === "activo");
  const hayFiltros = Boolean(anio || filtros.conceptoId || filtros.sectorId || estado || filtros.vencido || filtros.busqueda);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por cobrar</h1>
          <p className="text-sm text-slate-600">
            {lista.total === 1 ? "1 cargo" : `${lista.total} cargos`} · Saldo pendiente del filtro: <strong>{formatoUsd(lista.totalSaldo)}</strong>
          </p>
        </div>
        <Link href="/finanzas/conceptos" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-100">Conceptos de cobro</Link>
      </div>
      <MensajeExito mensaje={unico(sp.ok)} />
      <MensajeError mensaje={unico(sp.error)} />

      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer font-semibold">Emitir cargos</summary>
        <div className="mt-4">
          {activos.length === 0 ? (
            <p role="status" className="text-sm text-amber-900">Primero cree un concepto de cobro activo en «Conceptos de cobro».</p>
          ) : (
            <FormularioAccion
              action={emitirCargosAction}
              enviar="Emitir cargos"
              ancho="max-w-2xl"
              campos={[
                { nombre: "conceptoId", etiqueta: "Concepto", tipo: "select", requerido: true, opciones: activos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} (${formatoUsd(c.montoDefecto)})` })) },
                { nombre: "anio", etiqueta: "Año", tipo: "number", requerido: true, inicial: String(anioActual), modo: "numeric" },
                {
                  nombre: "alcance",
                  etiqueta: "A quién se emite",
                  tipo: "select",
                  requerido: true,
                  opciones: [
                    { valor: "todos", etiqueta: "Todos los socios activos" },
                    { valor: "sector", etiqueta: "Un sector" },
                    { valor: "socio", etiqueta: "Un socio" },
                  ],
                  inicial: "todos",
                },
                { nombre: "sectorId", etiqueta: "Sector (si eligió «Un sector»)", tipo: "select", vacio: "—", opciones: sectores.map((s) => ({ valor: s.id, etiqueta: s.nombre })) },
                { nombre: "socioId", etiqueta: "Socio (si eligió «Un socio»)", tipo: "select", vacio: "—", opciones: socios.map((s) => ({ valor: s.id, etiqueta: `${s.nombres} (${s.cedula})` })) },
                { nombre: "monto", etiqueta: "Monto (USD)", modo: "decimal", ayuda: "Déjelo vacío para usar el monto por defecto del concepto." },
                { nombre: "vence", etiqueta: "Fecha de vencimiento", tipo: "date", ayuda: "Opcional. Sin fecha, el cargo nunca figura como vencido." },
              ]}
            />
          )}
        </div>
      </details>

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Socio (nombre o cédula)</label>
          <input id="f-busqueda" name="busqueda" defaultValue={filtros.busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-anio" className="mb-1 block text-xs font-semibold text-slate-700">Año</label>
          <input id="f-anio" name="anio" type="number" inputMode="numeric" min={2000} max={2100} defaultValue={anio} className={campo} />
        </div>
        <div>
          <label htmlFor="f-concepto" className="mb-1 block text-xs font-semibold text-slate-700">Concepto</label>
          <select id="f-concepto" name="conceptoId" defaultValue={filtros.conceptoId ?? ""} className={campo}>
            <option value="">Todos</option>
            {conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-sector" className="mb-1 block text-xs font-semibold text-slate-700">Sector</label>
          <select id="f-sector" name="sectorId" defaultValue={filtros.sectorId ?? ""} className={campo}>
            <option value="">Todos</option>
            {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className="mb-1 block text-xs font-semibold text-slate-700">Estado</label>
          <select id="f-estado" name="estado" defaultValue={estado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="parcial">Con pago parcial</option>
            <option value="pagado">Pagados</option>
            <option value="anulado">Anulados</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vencido" value="1" defaultChecked={filtros.vencido} className="h-4 w-4" />
            Solo vencidos
          </label>
        </div>
        <div className="flex items-end gap-2 lg:col-span-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Filtrar</button>
          {hayFiltros ? <Link href="/finanzas/cobros" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
        </div>
      </form>

      {lista.items.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Ningún cargo coincide con el filtro" : "Aún no hay cargos emitidos"}
          descripcion={hayFiltros ? "Pruebe con otros filtros." : "Use «Emitir cargos» para cobrar una cuota a los socios."}
        />
      ) : (
        <TablaScroll etiqueta="Cuentas por cobrar">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Cuentas por cobrar de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Socio</th>
                <th scope="col" className="px-4 py-3">Concepto</th>
                <th scope="col" className="px-4 py-3">Año</th>
                <th scope="col" className="px-4 py-3 text-right">Monto</th>
                <th scope="col" className="px-4 py-3 text-right">Saldo</th>
                <th scope="col" className="px-4 py-3">Vence</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.socioNombres}</p>
                    <p className="text-xs text-slate-500">{c.socioCedula} · {c.sectorNombre}</p>
                  </td>
                  <td className="px-4 py-3">{c.concepto}</td>
                  <td className="px-4 py-3">{c.anio}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatoUsd(c.monto)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatoUsd(c.saldo)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.vence ? formatoFecha(c.vence) : "—"}</td>
                  <td className="px-4 py-3"><InsigniaCargo estado={c.estado} vencido={c.vencido} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/finanzas/cobros/${c.id}`} className="text-teal-800 underline">
                      {c.estado === "pendiente" || c.estado === "parcial" ? "Cobrar" : "Ver"}<span className="sr-only"> {c.concepto} de {c.socioNombres}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}

      <Paginacion
        ruta="/finanzas/cobros"
        pagina={lista.pagina}
        paginas={lista.paginas}
        params={{
          busqueda: filtros.busqueda,
          anio: anio ? String(anio) : undefined,
          conceptoId: filtros.conceptoId,
          sectorId: filtros.sectorId,
          estado,
          vencido: filtros.vencido ? "1" : undefined,
        }}
      />
    </div>
  );
}
