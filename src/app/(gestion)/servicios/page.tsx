import Link from "next/link";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarServicios } from "@/server/services/servicio-service";
import { ETIQUETA_TIPO_SERVICIO } from "@/server/validation/servicio";
import { EstadoVacio, Insignia } from "@/components/ui";

export const metadata = { title: "Servicios y turnos" };

export default async function ServiciosPage() {
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero"]);
  const puedeEditar = user.rol === "secretario";
  const servicios = await listarServicios(ctx);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Servicios y turnos</h1>
          <p className="text-sm text-slate-600">{servicios.length === 1 ? "1 servicio" : `${servicios.length} servicios`}</p>
        </div>
        {puedeEditar ? (
          <Link href="/servicios/nuevo" className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800">
            Nuevo servicio
          </Link>
        ) : null}
      </div>
      {servicios.length === 0 ? (
        <EstadoVacio titulo="Aún no hay servicios registrados" descripcion={puedeEditar ? "Use «Nuevo servicio» para registrar el primero." : undefined} />
      ) : (
        <div role="region" aria-label="Servicios de la junta (desplazable)" tabIndex={0} className="relative overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Servicios de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Servicio</th>
                <th scope="col" className="px-4 py-3">Tipo</th>
                <th scope="col" className="px-4 py-3">Turnos</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {servicios.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-semibold">{s.nombre}</td>
                  <td className="px-4 py-3">{ETIQUETA_TIPO_SERVICIO[s.tipo]}</td>
                  <td className="px-4 py-3">{s.turnos}</td>
                  <td className="px-4 py-3">
                    <Insignia tono={s.estado === "activo" ? "verde" : "gris"}>{s.estado === "activo" ? "Activo" : "Inactivo"}</Insignia>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/servicios/${s.id}`} className="text-teal-800 underline">
                      {puedeEditar ? "Ver y editar" : "Ver turnos"}<span className="sr-only"> {s.nombre}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
