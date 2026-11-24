import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EstadoVacio, InsigniaCargo, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { navegacionPara } from "@/lib/navegacion";
import { AppError } from "@/lib/result";
import { contextoDe } from "@/server/auth/guard";
import { exigirSesion } from "@/server/auth/page-guard";
import { obtenerMiEstadoCuenta } from "@/server/services/estado-cuenta-service";

export const metadata = { title: "Mi estado de cuenta" };

export default async function MiEstadoCuentaPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const sp = await searchParams;
  const user = await exigirSesion(["socio"]);
  const ctx = contextoDe(user);
  const anio = /^\d{4}$/.test(sp.anio ?? "") ? Number(sp.anio) : undefined;
  const estado = ctx.role === "tenant" ? await obtenerMiEstadoCuenta(ctx, user, { anio }) : null;

  return (
    <AppShell user={user} navegacion={navegacionPara(user.rol)}>
      <div className="max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Mi estado de cuenta</h1>
        {!estado ? (
          <p role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {new AppError("NO_EN_PADRON").message}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-white p-5 text-sm">
              <div>
                <dt className="text-slate-600">Saldo pendiente</dt>
                <dd className="text-2xl font-bold" data-testid="total-pendiente">{formatoUsd(estado.totalPendiente)}</dd>
              </div>
              <div>
                <dt className="text-slate-600">De ello, vencido</dt>
                <dd className={`text-2xl font-bold ${Number(estado.totalVencido) > 0 ? "text-red-700" : ""}`}>{formatoUsd(estado.totalVencido)}</dd>
              </div>
            </dl>

            {estado.anios.length > 0 ? (
              <nav aria-label="Filtrar por año" className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-600">Año:</span>
                <Link href="/mi/estado-de-cuenta" aria-current={!anio ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 ${!anio ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>Todos</Link>
                {estado.anios.map((a) => (
                  <Link key={a} href={`/mi/estado-de-cuenta?anio=${a}`} aria-current={anio === a ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 ${anio === a ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{a}</Link>
                ))}
              </nav>
            ) : null}

            {estado.cargos.length === 0 ? (
              <EstadoVacio titulo="No tiene cargos registrados" descripcion="Aquí aparecerán sus cuotas, servicios y multas." />
            ) : (
              <TablaScroll etiqueta="Estado de cuenta">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Cargos y pagos del socio</caption>
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">Concepto</th>
                      <th scope="col" className="px-4 py-3">Año</th>
                      <th scope="col" className="px-4 py-3 text-right">Monto</th>
                      <th scope="col" className="px-4 py-3 text-right">Pagado</th>
                      <th scope="col" className="px-4 py-3 text-right">Saldo</th>
                      <th scope="col" className="px-4 py-3">Vence</th>
                      <th scope="col" className="px-4 py-3">Estado</th>
                      <th scope="col" className="px-4 py-3">Comprobantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {estado.cargos.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{c.concepto}</p>
                          {c.esMulta ? <p className="text-xs text-slate-500">Multa por inasistencia</p> : null}
                        </td>
                        <td className="px-4 py-3">{c.anio}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatoUsd(c.monto)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatoUsd(c.pagado)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatoUsd(c.saldo)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{c.vence ? formatoFecha(c.vence) : "—"}</td>
                        <td className="px-4 py-3"><InsigniaCargo estado={c.estado} vencido={c.vencido} /></td>
                        <td className="px-4 py-3">
                          {c.pagos.length === 0 ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            <ul className="space-y-1">
                              {c.pagos.map((p) => (
                                <li key={p.id}>
                                  <a href={`/api/mi/comprobantes/${p.id}`} download className="text-teal-800 underline">
                                    N.º {String(p.numero).padStart(6, "0")}<span className="sr-only"> de {c.concepto}</span>
                                  </a>{" "}
                                  <span className="text-xs text-slate-500">{formatoFecha(p.fecha)} · {formatoUsd(p.monto)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaScroll>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
