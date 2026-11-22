import Link from "next/link";
import { requireRole } from "@/server/auth/guard";
import { listarJuntas, listarUbicaciones } from "@/server/services/junta-service";
import { filtrosJuntaSchema, ETIQUETA_TIPO } from "@/server/validation/junta";
import { EstadoVacio, Insignia, Paginacion } from "@/components/ui";

type Params = Record<string, string | string[] | undefined>;

function unico(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export default async function JuntasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx } = await requireRole("super_admin");
  if (ctx.role !== "super_admin") return null;

  const parsed = filtrosJuntaSchema.safeParse({
    busqueda: unico(sp.busqueda),
    provincia: unico(sp.provincia),
    canton: unico(sp.canton),
    parroquia: unico(sp.parroquia),
    estado: unico(sp.estado),
    pagina: unico(sp.pagina),
  });
  const filtros = parsed.success ? parsed.data : filtrosJuntaSchema.parse({});

  const [pagina, ubic] = await Promise.all([listarJuntas(ctx, filtros), listarUbicaciones(ctx)]);
  const hayFiltros = Boolean(filtros.busqueda || filtros.provincia || filtros.canton || filtros.parroquia || filtros.estado);
  const paramsFiltro = {
    busqueda: filtros.busqueda,
    provincia: filtros.provincia,
    canton: filtros.canton,
    parroquia: filtros.parroquia,
    estado: filtros.estado,
  };

  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Listado de Organizaciones Comunitarias</h1>
          <p className="text-sm text-slate-600">
            {pagina.total === 1 ? "1 organización registrada" : `${pagina.total} organizaciones registradas`}
          </p>
        </div>
        <Link href="/juntas/nueva" className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800">
          Agregar Nueva Junta
        </Link>
      </div>

      <form method="get" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Buscar por nombre o identificador</label>
          <input id="f-busqueda" name="busqueda" defaultValue={filtros.busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-provincia" className="mb-1 block text-xs font-semibold text-slate-700">Provincia</label>
          <input id="f-provincia" name="provincia" list="l-provincias" defaultValue={filtros.provincia} className={campo} />
          <datalist id="l-provincias">{ubic.provincias.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <label htmlFor="f-canton" className="mb-1 block text-xs font-semibold text-slate-700">Cantón</label>
          <input id="f-canton" name="canton" list="l-cantones" defaultValue={filtros.canton} className={campo} />
          <datalist id="l-cantones">{ubic.cantones.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <label htmlFor="f-parroquia" className="mb-1 block text-xs font-semibold text-slate-700">Parroquia</label>
          <input id="f-parroquia" name="parroquia" list="l-parroquias" defaultValue={filtros.parroquia} className={campo} />
          <datalist id="l-parroquias">{ubic.parroquias.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <label htmlFor="f-estado" className="mb-1 block text-xs font-semibold text-slate-700">Estado</label>
          <select id="f-estado" name="estado" defaultValue={filtros.estado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="activa">Activas</option>
            <option value="desactivada">Desactivadas</option>
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Buscar
          </button>
          {hayFiltros ? (
            <Link href="/juntas" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">
              Limpiar filtros
            </Link>
          ) : null}
        </div>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Ninguna organización coincide con la búsqueda" : "Aún no hay organizaciones registradas"}
          descripcion={hayFiltros ? "Pruebe con otros filtros." : "Use «Agregar Nueva Junta» para registrar la primera."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Organizaciones comunitarias registradas</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Organización</th>
                <th scope="col" className="px-4 py-3">Tipo</th>
                <th scope="col" className="px-4 py-3">Ubicación</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagina.items.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{j.nombre}</p>
                    <p className="text-xs text-slate-500">{j.slug}</p>
                  </td>
                  <td className="px-4 py-3">{ETIQUETA_TIPO[j.tipo]}</td>
                  <td className="px-4 py-3">{j.parroquia}, {j.canton}, {j.provincia}</td>
                  <td className="px-4 py-3">
                    <Insignia tono={j.estado === "activa" ? "verde" : "gris"}>
                      {j.estado === "activa" ? "Activa" : "Desactivada"}
                    </Insignia>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/juntas/${j.id}`} className="text-teal-800 underline">
                      Ver y editar<span className="sr-only"> {j.nombre}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion ruta="/juntas" pagina={pagina.pagina} paginas={pagina.paginas} params={paramsFiltro} />
    </div>
  );
}
