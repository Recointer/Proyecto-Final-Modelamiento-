import { hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { TITULO_REPORTE, TIPOS_REPORTE } from "@/server/services/reporte-service";

export const metadata = { title: "Reportes financieros" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const DESCRIPCION: Record<(typeof TIPOS_REPORTE)[number], string> = {
  ingresos: "Pagos cobrados en el período, con socio, concepto y forma de pago.",
  egresos: "Egresos vigentes del período por categoría y beneficiario.",
  "por-cobrar": "Cargos con saldo pendiente, con lo vencido destacado. Filtra por año.",
  caja: "Ingresos, egresos, saldo de caja y total por cobrar.",
};

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await contextoGestion(["tesorero", "admin_junta"]);
  const desde = FECHA.test(unico(sp.desde) ?? "") ? unico(sp.desde) : undefined;
  const hasta = FECHA.test(unico(sp.hasta) ?? "") ? unico(sp.hasta) : undefined;
  const anioTexto = unico(sp.anio) ?? "";
  const anio = desde || hasta ? undefined : /^\d{4}$/.test(anioTexto) ? anioTexto : hoyEcuador().slice(0, 4);
  const campo = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  const enlace = (tipo: string, formato: "pdf" | "csv") => {
    const q = new URLSearchParams({ formato });
    if (anio) q.set("anio", anio);
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    return `/api/finanzas/reportes/${tipo}?${q.toString()}`;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes financieros</h1>
        <p className="text-sm text-slate-600">Elija el período y descargue cada reporte en PDF o en hoja de cálculo (CSV).</p>
      </div>

      <form method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <div>
          <label htmlFor="f-anio" className="mb-1 block text-xs font-semibold text-slate-700">Año</label>
          <input id="f-anio" name="anio" type="number" inputMode="numeric" min={2000} max={2100} defaultValue={anio ?? ""} className={`${campo} w-28`} />
        </div>
        <p className="pb-2 text-xs text-slate-500">o un rango:</p>
        <div>
          <label htmlFor="f-desde" className="mb-1 block text-xs font-semibold text-slate-700">Desde</label>
          <input id="f-desde" name="desde" type="date" defaultValue={desde} className={campo} />
        </div>
        <div>
          <label htmlFor="f-hasta" className="mb-1 block text-xs font-semibold text-slate-700">Hasta</label>
          <input id="f-hasta" name="hasta" type="date" defaultValue={hasta} className={campo} />
        </div>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Aplicar período</button>
      </form>

      <ul className="grid gap-4 sm:grid-cols-2">
        {TIPOS_REPORTE.map((t) => (
          <li key={t} className="space-y-3 rounded-xl border bg-white p-5">
            <h2 className="font-bold">{TITULO_REPORTE[t]}</h2>
            <p className="text-sm text-slate-600">{DESCRIPCION[t]}</p>
            <div className="flex gap-2">
              <a href={enlace(t, "pdf")} download className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                PDF<span className="sr-only"> de {TITULO_REPORTE[t]}</span>
              </a>
              <a href={enlace(t, "csv")} download className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                CSV<span className="sr-only"> de {TITULO_REPORTE[t]}</span>
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
