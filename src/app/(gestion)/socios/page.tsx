import Link from "next/link";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarSocios } from "@/server/services/socio-service";
import { listarSectores } from "@/server/services/configuracion-service";
import { filtrosSocioSchema } from "@/server/validation/socio";
import { EstadoVacio, Insignia, Paginacion } from "@/components/ui";

export const metadata = { title: "Nómina de socios" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function SociosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero"]);
  const puedeEditar = user.rol === "secretario";

  const parsed = filtrosSocioSchema.safeParse({
    busqueda: unico(sp.busqueda),
    sectorId: unico(sp.sectorId),
    estado: unico(sp.estado),
    pagina: unico(sp.pagina),
  });
  const filtros = parsed.success ? parsed.data : filtrosSocioSchema.parse({});
  const [pagina, sectores] = await Promise.all([listarSocios(ctx, filtros), listarSectores(ctx)]);
  const hayFiltros = Boolean(filtros.busqueda || filtros.sectorId || filtros.estado);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Nómina de socios</h1>
          <p className="text-sm text-slate-600">{pagina.total === 1 ? "1 socio" : `${pagina.total} socios`} en la junta</p>
        </div>
        {puedeEditar ? (
          <Link href="/socios/nuevo" className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800">
            Nuevo socio
          </Link>
        ) : null}
      </div>

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Buscar por nombre o cédula</label>
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
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Buscar
          </button>
          {hayFiltros ? (
            <Link href="/socios" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link>
          ) : null}
        </div>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Ningún socio coincide con la búsqueda" : "Aún no hay socios registrados"}
          descripcion={hayFiltros ? "Pruebe con otros filtros." : puedeEditar ? "Use «Nuevo socio» para registrar el primero." : undefined}
        />
      ) : (
        <div className="relative overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Nómina de socios de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Nombre</th>
                <th scope="col" className="px-4 py-3">Cédula</th>
                <th scope="col" className="px-4 py-3">Sector</th>
                <th scope="col" className="px-4 py-3">Ingreso</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagina.items.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.nombres}</p>
                    <p className="text-xs text-slate-500">{s.correo ?? "Sin correo"}</p>
                  </td>
                  <td className="px-4 py-3">{s.cedula}</td>
                  <td className="px-4 py-3">{s.sectorNombre}</td>
                  <td className="px-4 py-3">{s.fechaIngreso.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3">
                    <Insignia tono={s.estado === "activo" ? "verde" : "gris"}>{s.estado === "activo" ? "Activo" : "Inactivo"}</Insignia>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/socios/${s.id}`} className="text-teal-800 underline">
                      {puedeEditar ? "Ver y editar" : "Ver ficha"}<span className="sr-only"> {s.nombres}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion
        ruta="/socios"
        pagina={pagina.pagina}
        paginas={pagina.paginas}
        params={{ busqueda: filtros.busqueda, sectorId: filtros.sectorId, estado: filtros.estado }}
      />
    </div>
  );
}
