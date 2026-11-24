import Link from "next/link";
import { EstadoVacio, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { resumenFinanciero, type RangoFinanciero } from "@/server/services/resumen-service";
import { ETIQUETA_CATEGORIA } from "@/server/validation/finanzas";

export const metadata = { title: "Resumen financiero" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Lee el rango de la URL: por defecto, el año en curso. */
function rangoDeParametros(sp: Params): RangoFinanciero & { anioTexto: string } {
  const anioTexto = unico(sp.anio) ?? "";
  const desde = unico(sp.desde);
  const hasta = unico(sp.hasta);
  if ((desde && FECHA.test(desde)) || (hasta && FECHA.test(hasta))) {
    return { desde: desde && FECHA.test(desde) ? desde : undefined, hasta: hasta && FECHA.test(hasta) ? hasta : undefined, anioTexto: "" };
  }
  const anio = /^\d{4}$/.test(anioTexto) ? Number(anioTexto) : Number(hoyEcuador().slice(0, 4));
  return { anio, anioTexto: String(anio) };
}

function Tarjeta({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle?: string; tono?: "alerta" }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-slate-600">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${tono === "alerta" ? "text-red-700" : ""}`}>{formatoUsd(valor)}</p>
      {detalle ? <p className="mt-1 text-xs text-slate-500">{detalle}</p> : null}
    </div>
  );
}

export default async function ResumenFinancieroPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["tesorero", "admin_junta"]);
  const { anioTexto, ...rango } = rangoDeParametros(sp);
  const r = await resumenFinanciero(ctx, rango);
  const esTesorero = user.rol === "tesorero";
  const campo = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  const periodo = rango.anio
    ? `Año ${rango.anio}`
    : `${r.desde ? `Desde el ${formatoFecha(r.desde)}` : ""}${r.desde && r.hasta ? " " : ""}${r.hasta ? `hasta el ${formatoFecha(r.hasta)}` : ""}`;
  const query = new URLSearchParams(rango.anio ? { anio: String(rango.anio) } : { ...(r.desde ? { desde: r.desde } : {}), ...(r.hasta ? { hasta: r.hasta } : {}) }).toString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumen financiero</h1>
        <p className="text-sm text-slate-600">{periodo}. Los pagos y egresos anulados no suman.</p>
      </div>

      <form method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <div>
          <label htmlFor="f-anio" className="mb-1 block text-xs font-semibold text-slate-700">Año</label>
          <input id="f-anio" name="anio" type="number" inputMode="numeric" min={2000} max={2100} defaultValue={anioTexto} className={`${campo} w-28`} />
        </div>
        <p className="pb-2 text-xs text-slate-500">o un rango:</p>
        <div>
          <label htmlFor="f-desde" className="mb-1 block text-xs font-semibold text-slate-700">Desde</label>
          <input id="f-desde" name="desde" type="date" defaultValue={r.desde && !rango.anio ? r.desde : ""} className={campo} />
        </div>
        <div>
          <label htmlFor="f-hasta" className="mb-1 block text-xs font-semibold text-slate-700">Hasta</label>
          <input id="f-hasta" name="hasta" type="date" defaultValue={r.hasta && !rango.anio ? r.hasta : ""} className={campo} />
        </div>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Ver resumen</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Ingresos cobrados" valor={r.ingresos} detalle={`${r.pagos} ${r.pagos === 1 ? "pago" : "pagos"}`} />
        <Tarjeta titulo="Egresos" valor={r.egresos} />
        <Tarjeta titulo="Saldo de caja" valor={r.caja} detalle="Ingresos menos egresos" tono={r.caja.startsWith("-") ? "alerta" : undefined} />
        <Tarjeta
          titulo="Por cobrar"
          valor={r.porCobrar}
          detalle={Number(r.porCobrarVencido) > 0 ? `De ello, ${formatoUsd(r.porCobrarVencido)} vencido` : "Nada vencido"}
        />
      </div>

      <section aria-labelledby="cat-titulo" className="space-y-3">
        <h2 id="cat-titulo" className="font-bold">Egresos por categoría</h2>
        {r.egresosPorCategoria.length === 0 ? (
          <EstadoVacio titulo="Sin egresos en el período" />
        ) : (
          <TablaScroll etiqueta="Egresos por categoría">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Egresos por categoría</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Categoría</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.egresosPorCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td className="px-4 py-3">{ETIQUETA_CATEGORIA[c.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? c.categoria}</td>
                    <td className="px-4 py-3 text-right">{formatoUsd(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )}
      </section>

      <nav aria-label="Accesos del módulo financiero" className="flex flex-wrap gap-3 text-sm">
        <Link href={`/finanzas/reportes${query ? `?${query}` : ""}`} className="rounded-lg border bg-white px-4 py-2 font-semibold text-teal-800 hover:bg-slate-100">Descargar reportes</Link>
        {esTesorero ? (
          <>
            <Link href="/finanzas/cobros" className="rounded-lg border bg-white px-4 py-2 font-semibold text-teal-800 hover:bg-slate-100">Cuentas por cobrar</Link>
            <Link href="/finanzas/egresos" className="rounded-lg border bg-white px-4 py-2 font-semibold text-teal-800 hover:bg-slate-100">Egresos</Link>
          </>
        ) : null}
      </nav>
    </div>
  );
}
