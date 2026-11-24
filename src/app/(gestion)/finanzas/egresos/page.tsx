import Link from "next/link";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, Paginacion, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarEgresos } from "@/server/services/egreso-service";
import { CATEGORIAS_EGRESO, ETIQUETA_CATEGORIA } from "@/server/validation/finanzas";
import { anularEgresoAction, registrarEgresoAction } from "../actions";

export const metadata = { title: "Egresos" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function EgresosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx } = await contextoGestion(["tesorero"]);
  const categoria = CATEGORIAS_EGRESO.find((c) => c === unico(sp.categoria));
  const desde = FECHA.test(unico(sp.desde) ?? "") ? unico(sp.desde) : undefined;
  const hasta = FECHA.test(unico(sp.hasta) ?? "") ? unico(sp.hasta) : undefined;
  const busqueda = unico(sp.busqueda);
  const lista = await listarEgresos(ctx, { categoria, desde, hasta, busqueda, pagina: Number(unico(sp.pagina)) || 1 });
  const hayFiltros = Boolean(categoria || desde || hasta || busqueda);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Egresos</h1>
        <p className="text-sm text-slate-600">
          {lista.total === 1 ? "1 egreso" : `${lista.total} egresos`} · Total vigente del filtro: <strong>{formatoUsd(lista.totalVigente)}</strong>
        </p>
      </div>
      <MensajeExito mensaje={unico(sp.ok)} />
      <MensajeError mensaje={unico(sp.error)} />

      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer font-semibold">Registrar egreso</summary>
        <div className="mt-4">
          <FormularioAccion
            action={registrarEgresoAction}
            enviar="Registrar egreso"
            campos={[
              { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, inicial: hoyEcuador(), max: hoyEcuador() },
              { nombre: "categoria", etiqueta: "Categoría", tipo: "select", requerido: true, opciones: CATEGORIAS_EGRESO.map((c) => ({ valor: c, etiqueta: ETIQUETA_CATEGORIA[c] })) },
              { nombre: "descripcion", etiqueta: "Descripción", requerido: true, placeholder: "Ej: Compra de tubería PVC" },
              { nombre: "beneficiario", etiqueta: "Beneficiario", requerido: true, placeholder: "Proveedor o persona" },
              { nombre: "monto", etiqueta: "Monto (USD)", requerido: true, modo: "decimal" },
              { nombre: "respaldo", etiqueta: "Respaldo (opcional)", tipo: "file", accept: "application/pdf,image/png,image/jpeg", ayuda: "PDF, PNG o JPEG de hasta 5 MB." },
            ]}
          />
        </div>
      </details>

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Descripción o beneficiario</label>
          <input id="f-busqueda" name="busqueda" defaultValue={busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-categoria" className="mb-1 block text-xs font-semibold text-slate-700">Categoría</label>
          <select id="f-categoria" name="categoria" defaultValue={categoria ?? ""} className={campo}>
            <option value="">Todas</option>
            {CATEGORIAS_EGRESO.map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-desde" className="mb-1 block text-xs font-semibold text-slate-700">Desde</label>
          <input id="f-desde" name="desde" type="date" defaultValue={desde} className={campo} />
        </div>
        <div>
          <label htmlFor="f-hasta" className="mb-1 block text-xs font-semibold text-slate-700">Hasta</label>
          <input id="f-hasta" name="hasta" type="date" defaultValue={hasta} className={campo} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Filtrar</button>
          {hayFiltros ? <Link href="/finanzas/egresos" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
        </div>
      </form>

      {lista.items.length === 0 ? (
        <EstadoVacio titulo={hayFiltros ? "Ningún egreso coincide con el filtro" : "Aún no hay egresos registrados"} />
      ) : (
        <TablaScroll etiqueta="Libro de egresos">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Libro de egresos de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">Categoría</th>
                <th scope="col" className="px-4 py-3">Descripción</th>
                <th scope="col" className="px-4 py-3 text-right">Monto</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.items.map((e) => (
                <tr key={e.id} className={e.anulado ? "text-slate-500" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3">{formatoFecha(e.fecha)}</td>
                  <td className="px-4 py-3">{ETIQUETA_CATEGORIA[e.categoria]}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{e.descripcion}</p>
                    <p className="text-xs text-slate-500">{e.beneficiario}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatoUsd(e.monto)}</td>
                  <td className="px-4 py-3">
                    {e.anulado ? <Insignia tono="gris">Anulado</Insignia> : <Insignia tono="verde">Vigente</Insignia>}
                    {e.anulado && e.motivoAnulacion ? <p className="mt-1 text-xs">{e.motivoAnulacion}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {e.tieneRespaldo ? (
                        <a href={`/api/egresos/${e.id}/respaldo`} target="_blank" rel="noopener" className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                          Respaldo<span className="sr-only"> de {e.descripcion}</span>
                        </a>
                      ) : null}
                      {!e.anulado ? (
                        <ConfirmarAccion
                          action={anularEgresoAction}
                          etiqueta="Anular"
                          titulo="¿Anular el egreso?"
                          mensaje={`«${e.descripcion}» por ${formatoUsd(e.monto)} dejará de sumar a los totales. Se conserva en el historial.`}
                          etiquetaConfirmar="Sí, anular"
                          campos={{ id: e.id }}
                          entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 3, maximo: 300 }}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}

      <Paginacion ruta="/finanzas/egresos" pagina={lista.pagina} paginas={lista.paginas} params={{ busqueda, categoria, desde, hasta }} />
    </div>
  );
}
