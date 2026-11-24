import Link from "next/link";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarEventos } from "@/server/services/evento-service";
import { ETIQUETA_TIPO_EVENTO, filtrosEventoSchema, TIPOS_EVENTO } from "@/server/validation/evento";
import { esFechaFutura, formatoFecha } from "@/lib/fechas";
import { EstadoVacio, Insignia, Paginacion } from "@/components/ui";

export const metadata = { title: "Eventos y asistencia" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function EventosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero"]);
  const puedeEditar = user.rol === "secretario";

  const parsed = filtrosEventoSchema.safeParse({
    tipo: unico(sp.tipo),
    estado: unico(sp.estado),
    desde: unico(sp.desde),
    hasta: unico(sp.hasta),
    pagina: unico(sp.pagina),
  });
  const filtros = parsed.success ? parsed.data : filtrosEventoSchema.parse({});
  const pagina = await listarEventos(ctx, filtros);
  const hayFiltros = Boolean(filtros.tipo || filtros.estado || filtros.desde || filtros.hasta);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Eventos y asistencia</h1>
          <p className="text-sm text-slate-600">{pagina.total === 1 ? "1 evento" : `${pagina.total} eventos`}</p>
        </div>
        {puedeEditar ? (
          <Link href="/eventos/nuevo" className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800">
            Nuevo evento
          </Link>
        ) : null}
      </div>

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="f-tipo" className="mb-1 block text-xs font-semibold text-slate-700">Tipo</label>
          <select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ""} className={campo}>
            <option value="">Todos</option>
            {TIPOS_EVENTO.map((t) => (
              <option key={t} value={t}>{ETIQUETA_TIPO_EVENTO[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className="mb-1 block text-xs font-semibold text-slate-700">Estado</label>
          <select id="f-estado" name="estado" defaultValue={filtros.estado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="activo">Vigentes</option>
            <option value="anulado">Anulados</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-desde" className="mb-1 block text-xs font-semibold text-slate-700">Desde</label>
          <input id="f-desde" name="desde" type="date" defaultValue={filtros.desde} className={campo} />
        </div>
        <div>
          <label htmlFor="f-hasta" className="mb-1 block text-xs font-semibold text-slate-700">Hasta</label>
          <input id="f-hasta" name="hasta" type="date" defaultValue={filtros.hasta} className={campo} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Buscar
          </button>
          {hayFiltros ? <Link href="/eventos" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
        </div>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Ningún evento coincide con la búsqueda" : "Aún no hay eventos registrados"}
          descripcion={hayFiltros ? "Pruebe con otros filtros." : puedeEditar ? "Use «Nuevo evento» para registrar la primera asamblea o minga." : undefined}
        />
      ) : (
        <div className="relative overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Eventos de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">Evento</th>
                <th scope="col" className="px-4 py-3">Lugar</th>
                <th scope="col" className="px-4 py-3">Asistencia</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagina.items.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatoFecha(e.fecha)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{e.titulo}</p>
                    <p className="text-xs text-slate-500">{ETIQUETA_TIPO_EVENTO[e.tipo]}</p>
                  </td>
                  <td className="px-4 py-3">{e.lugar}</td>
                  <td className="px-4 py-3">
                    {e.estado === "anulado" ? (
                      <Insignia tono="gris">Anulado</Insignia>
                    ) : e.asistenciaRegistrada ? (
                      <Insignia tono="verde">{`${e.presentes} de ${e.registrados} presentes`}</Insignia>
                    ) : esFechaFutura(e.fecha) ? (
                      <Insignia tono="ambar">Programado</Insignia>
                    ) : (
                      <Insignia tono="ambar">Sin registrar</Insignia>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/eventos/${e.id}`} className="text-teal-800 underline">
                      Ver detalle<span className="sr-only"> de {e.titulo}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion
        ruta="/eventos"
        pagina={pagina.pagina}
        paginas={pagina.paginas}
        params={{ tipo: filtros.tipo, estado: filtros.estado, desde: filtros.desde, hasta: filtros.hasta }}
      />
    </div>
  );
}
