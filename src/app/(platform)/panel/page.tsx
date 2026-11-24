import Link from "next/link";
import { contextoSuperAdmin } from "@/server/auth/page-guard";
import { obtenerPanel } from "@/server/services/panel-service";
import { mesDe, parseMes } from "@/lib/fechas";
import { Calendario } from "@/components/Calendario";
import { EstadoVacio, Insignia } from "@/components/ui";

export const metadata = { title: "Panel de control" };

function Tarjeta({
  titulo,
  valor,
  detalle,
  testId,
}: {
  titulo: string;
  valor: number;
  detalle?: string;
  testId: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-600">{titulo}</p>
      <p data-testid={testId} className="text-4xl font-bold tabular-nums">
        {valor}
      </p>
      {detalle ? <p className="mt-1 text-xs text-slate-600">{detalle}</p> : null}
    </div>
  );
}

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const sp = await searchParams;
  const ctx = await contextoSuperAdmin();

  const ahora = new Date();
  const actual = mesDe(ahora);
  const pedido = parseMes(Array.isArray(sp.mes) ? sp.mes[0] : sp.mes);
  const mes = pedido ?? actual;
  const esActual = mes.anio === actual.anio && mes.mes === actual.mes;

  const panel = await obtenerPanel(ctx, { mes, ahora });
  const hoy = esActual ? Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Guayaquil" }).format(ahora)) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel de Control Territorial</h1>
          <p className="text-sm text-slate-600">Resumen general de la plataforma (solo cifras agregadas).</p>
        </div>
        <a
          href="/api/reportes/plataforma.csv"
          download
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Descargar reporte
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tarjeta
          testId="total-juntas"
          titulo="Total de juntas"
          valor={panel.totalJuntas}
          detalle={`${panel.juntasActivas} activas · ${panel.juntasDesactivadas} desactivadas`}
        />
        <Tarjeta
          testId="total-eventos"
          titulo="Total de eventos"
          valor={panel.totalEventos}
          detalle={panel.totalEventos === 0 ? "Se mostrarán cuando las juntas registren asambleas y mingas." : undefined}
        />
        <Tarjeta
          testId="total-pagos"
          titulo="Pagos registrados"
          valor={panel.totalPagos}
          detalle={panel.totalPagos === 0 ? "Se mostrarán cuando las juntas cobren a sus socios." : undefined}
        />
        <Tarjeta
          testId="nuevas-mes"
          titulo="Juntas nuevas este mes"
          valor={panel.nuevasEsteMes}
          detalle={`${panel.nuevasMesAnterior} el mes anterior`}
        />
        <Tarjeta
          testId="sin-admin"
          titulo="Activas sin administrador"
          valor={panel.juntasSinAdministrador}
          detalle={panel.juntasSinAdministrador > 0 ? "Asigne un administrador para habilitarlas." : "Todas tienen administrador."}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="recientes" className="rounded-xl border bg-white p-4">
          <h2 id="recientes" className="mb-3 font-bold">Juntas registradas recientemente</h2>
          {panel.recientes.length === 0 ? (
            <EstadoVacio titulo="Aún no hay juntas" descripcion="Registre la primera desde «Juntas y tenencias»." />
          ) : (
            <ul className="divide-y">
              {panel.recientes.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <Link href={`/juntas/${j.id}`} className="font-semibold text-teal-800 underline">
                      {j.nombre}
                    </Link>
                    <p className="text-xs text-slate-600">
                      {j.provincia} · {j.creadaEn.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}
                    </p>
                  </div>
                  <Insignia tono={j.estado === "activa" ? "verde" : "gris"}>
                    {j.estado === "activa" ? "Activa" : "Desactivada"}
                  </Insignia>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Calendario mes={mes} hoy={hoy} eventos={panel.eventosDelMes} ruta="/panel" />
      </div>
    </div>
  );
}
