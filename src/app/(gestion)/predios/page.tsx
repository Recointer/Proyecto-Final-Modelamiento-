import Link from "next/link";
import { AppError } from "@/lib/result";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarSectores } from "@/server/services/configuracion-service";
import { datosMapaPredios, listarPredios } from "@/server/services/predio-service";
import { socioDeSesion } from "@/server/services/socio-sesion";
import { filtrosPredioSchema } from "@/server/validation/predio";
import { MapaPredios } from "@/components/MapaPredios";
import { EstadoVacio, Insignia, Paginacion } from "@/components/ui";

export const metadata = { title: "Predios y mapa" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const num = (n: number) => String(n).replace(".", ",");

export default async function PrediosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero", "socio"]);
  const esSocio = user.rol === "socio";
  const puedeEditar = user.rol === "secretario";

  // El Socio solo ve lo suyo: su id se deriva de la sesión, nunca de la URL
  let acotado: string | undefined;
  if (esSocio) {
    const socio = await socioDeSesion(ctx, user);
    if (!socio) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Mis predios</h1>
          <p role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {new AppError("NO_EN_PADRON").message}
          </p>
        </div>
      );
    }
    acotado = socio.id;
  }

  const parsed = filtrosPredioSchema.safeParse({
    sectorId: unico(sp.sectorId),
    busqueda: unico(sp.busqueda),
    estado: unico(sp.estado),
    pagina: unico(sp.pagina),
  });
  const filtros = parsed.success ? parsed.data : filtrosPredioSchema.parse({});

  const [pagina, puntos, sectores] = await Promise.all([
    listarPredios(ctx, filtros, acotado),
    datosMapaPredios(ctx, { sectorId: filtros.sectorId }, acotado),
    listarSectores(ctx),
  ]);
  const hayFiltros = Boolean(filtros.sectorId || filtros.busqueda || filtros.estado);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{esSocio ? "Mis predios" : "Predios y recursos"}</h1>
          <p className="text-sm text-slate-600">{pagina.total === 1 ? "1 predio" : `${pagina.total} predios`}</p>
        </div>
        {puedeEditar ? (
          <Link href="/predios/nuevo" className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800">
            Nuevo predio
          </Link>
        ) : null}
      </div>

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">
            {esSocio ? "Buscar por código o nombre" : "Buscar por código, nombre o titular"}
          </label>
          <input id="f-busqueda" name="busqueda" defaultValue={filtros.busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-sector" className="mb-1 block text-xs font-semibold text-slate-700">Sector</label>
          <select id="f-sector" name="sectorId" defaultValue={filtros.sectorId ?? ""} className={campo}>
            <option value="">Todos</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className="mb-1 block text-xs font-semibold text-slate-700">Estado</label>
          <select id="f-estado" name="estado" defaultValue={filtros.estado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Filtrar</button>
          {hayFiltros ? <Link href="/predios" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
        </div>
      </form>

      <MapaPredios puntos={puntos} />

      <section aria-labelledby="lista-titulo" className="space-y-3">
        <h2 id="lista-titulo" className="font-bold">Listado de predios</h2>
        {pagina.items.length === 0 ? (
          <EstadoVacio
            titulo={hayFiltros ? "Ningún predio coincide con los filtros" : esSocio ? "Aún no tiene predios asignados" : "Aún no hay predios registrados"}
            descripcion={hayFiltros ? "Pruebe con otros filtros." : puedeEditar ? "Use «Nuevo predio» para registrar el primero." : undefined}
          />
        ) : (
          <div className="relative overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Predios de la junta</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Predio</th>
                  {!esSocio ? <th scope="col" className="px-4 py-3">Titular</th> : null}
                  <th scope="col" className="px-4 py-3">Sector</th>
                  <th scope="col" className="px-4 py-3">Superficie</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagina.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{p.codigo}</p>
                      <p className="text-xs text-slate-500">{p.nombre}</p>
                    </td>
                    {!esSocio ? <td className="px-4 py-3">{p.titularNombres}</td> : null}
                    <td className="px-4 py-3">{p.sectorNombre}</td>
                    <td className="whitespace-nowrap px-4 py-3">{num(p.superficieHa)} ha</td>
                    <td className="px-4 py-3">
                      <Insignia tono={p.estado === "activo" ? "verde" : "gris"}>{p.estado === "activo" ? "Activo" : "Inactivo"}</Insignia>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/predios/${p.id}`} className="text-teal-800 underline">
                        {puedeEditar ? "Ver y editar" : "Ver ficha"}<span className="sr-only"> {p.codigo}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta="/predios"
          pagina={pagina.pagina}
          paginas={pagina.paginas}
          params={{ busqueda: filtros.busqueda, sectorId: filtros.sectorId, estado: filtros.estado }}
        />
      </section>
    </div>
  );
}
