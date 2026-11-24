import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EstadoVacio, Insignia } from "@/components/ui";
import { formatoFecha } from "@/lib/fechas";
import { navegacionPara } from "@/lib/navegacion";
import { AppError } from "@/lib/result";
import { contextoDe } from "@/server/auth/guard";
import { exigirSesion } from "@/server/auth/page-guard";
import { obtenerMiInformacion } from "@/server/services/mi-informacion-service";

export const metadata = { title: "Mi información" };

const num = (n: number) => String(n).replace(".", ",");

export default async function MiInformacionPage() {
  const user = await exigirSesion(["socio"]);
  const ctx = contextoDe(user);
  const info = ctx.role === "tenant" ? await obtenerMiInformacion(ctx, user) : null;

  return (
    <AppShell user={user} navegacion={navegacionPara(user.rol)}>
      <div className="max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Mi información</h1>
        {!info ? (
          <p role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {new AppError("NO_EN_PADRON").message}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 rounded-xl border bg-white p-5 text-sm">
              <dt className="text-slate-600">Nombres</dt>
              <dd>{info.ficha.nombres}</dd>
              <dt className="text-slate-600">Cédula</dt>
              <dd>{info.ficha.cedula}</dd>
              <dt className="text-slate-600">Sector</dt>
              <dd>{info.ficha.sectorNombre}</dd>
              <dt className="text-slate-600">Fecha de ingreso</dt>
              <dd>{formatoFecha(info.ficha.fechaIngreso)}</dd>
              <dt className="text-slate-600">Correo</dt>
              <dd>{info.ficha.correo ?? "No registrado"}</dd>
              <dt className="text-slate-600">Teléfono</dt>
              <dd>{info.ficha.telefono ?? "No registrado"}</dd>
              <dt className="text-slate-600">Estado</dt>
              <dd>
                <Insignia tono={info.ficha.estado === "activo" ? "verde" : "gris"}>{info.ficha.estado === "activo" ? "Activo" : "Inactivo"}</Insignia>
              </dd>
            </dl>

            <section aria-labelledby="mis-predios-titulo" className="space-y-3">
              <h2 id="mis-predios-titulo" className="font-bold">Mis predios</h2>
              {info.predios.length === 0 ? (
                <EstadoVacio titulo="Aún no tiene predios asignados" />
              ) : (
                <div role="region" aria-label="Predios del socio (desplazable)" tabIndex={0} className="relative overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Predios del socio</caption>
                    <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                      <tr>
                        <th scope="col" className="px-4 py-3">Predio</th>
                        <th scope="col" className="px-4 py-3">Sector</th>
                        <th scope="col" className="px-4 py-3">Superficie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {info.predios.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3">
                            <Link href={`/predios/${p.id}`} className="font-semibold text-teal-800 underline">{p.codigo}</Link>
                            <span className="text-slate-500"> · {p.nombre}</span>
                          </td>
                          <td className="px-4 py-3">{p.sectorNombre}</td>
                          <td className="whitespace-nowrap px-4 py-3">{num(p.superficieHa)} ha</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="text-sm">
              <Link href="/calendario" className="text-teal-800 underline">Ver el calendario de turnos de mi sector</Link>
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
