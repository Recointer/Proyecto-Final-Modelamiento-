import Link from "next/link";
import { contextoAdminJunta } from "@/server/auth/page-guard";
import { listarUsuarios } from "@/server/services/usuario-service";
import { ETIQUETA_ROL, filtrosUsuarioSchema, ROLES_GESTIONABLES } from "@/server/validation/usuario";
import { EstadoVacio, Insignia, Paginacion } from "@/components/ui";

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const ctx = await contextoAdminJunta();

  const parsed = filtrosUsuarioSchema.safeParse({
    busqueda: unico(sp.busqueda),
    rol: unico(sp.rol),
    estado: unico(sp.estado),
    pagina: unico(sp.pagina),
  });
  const filtros = parsed.success ? parsed.data : filtrosUsuarioSchema.parse({});
  const pagina = await listarUsuarios(ctx, filtros);
  const hayFiltros = Boolean(filtros.busqueda || filtros.rol || filtros.estado);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cuentas de usuario</h1>
          <p className="text-sm text-slate-600">
            {pagina.total === 1 ? "1 cuenta" : `${pagina.total} cuentas`} en su junta
          </p>
        </div>
        <Link href="/usuarios/nuevo" className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800">
          Nueva cuenta
        </Link>
      </div>

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Buscar por nombre, cédula o correo</label>
          <input id="f-busqueda" name="busqueda" defaultValue={filtros.busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-rol" className="mb-1 block text-xs font-semibold text-slate-700">Rol</label>
          <select id="f-rol" name="rol" defaultValue={filtros.rol ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="admin_junta">{ETIQUETA_ROL.admin_junta}</option>
            {ROLES_GESTIONABLES.map((r) => (
              <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className="mb-1 block text-xs font-semibold text-slate-700">Estado</label>
          <select id="f-estado" name="estado" defaultValue={filtros.estado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="activo">Activas</option>
            <option value="desactivado">Desactivadas</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Buscar
          </button>
          {hayFiltros ? (
            <Link href="/usuarios" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Ninguna cuenta coincide con la búsqueda" : "Aún no hay cuentas"}
          descripcion={hayFiltros ? "Pruebe con otros filtros." : "Use «Nueva cuenta» para crear la primera."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Cuentas de usuario de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Nombre</th>
                <th scope="col" className="px-4 py-3">Cédula</th>
                <th scope="col" className="px-4 py-3">Rol</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagina.items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {u.nombres}
                      {u.id === ctx.userId ? <span className="ml-2 text-xs font-normal text-slate-600">(usted)</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">{u.correo ?? "Sin correo"}</p>
                  </td>
                  <td className="px-4 py-3">{u.cedula}</td>
                  <td className="px-4 py-3">{ETIQUETA_ROL[u.rol]}</td>
                  <td className="px-4 py-3">
                    <Insignia tono={u.estado === "activo" ? "verde" : "gris"}>
                      {u.estado === "activo" ? "Activa" : "Desactivada"}
                    </Insignia>
                    {u.debeCambiarPassword ? <span className="ml-2"><Insignia tono="ambar">Pendiente de primer ingreso</Insignia></span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/usuarios/${u.id}`} className="text-teal-800 underline">
                      Ver y editar<span className="sr-only"> {u.nombres}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion
        ruta="/usuarios"
        pagina={pagina.pagina}
        paginas={pagina.paginas}
        params={{ busqueda: filtros.busqueda, rol: filtros.rol, estado: filtros.estado }}
      />
    </div>
  );
}
