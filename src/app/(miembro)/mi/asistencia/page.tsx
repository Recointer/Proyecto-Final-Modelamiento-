import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TarjetaCumplimiento } from "@/components/TarjetaCumplimiento";
import { EstadoVacio, Insignia } from "@/components/ui";
import { formatoFecha } from "@/lib/fechas";
import { navegacionPara } from "@/lib/navegacion";
import { AppError } from "@/lib/result";
import { contextoDe } from "@/server/auth/guard";
import { exigirSesion } from "@/server/auth/page-guard";
import { obtenerMiHistorial } from "@/server/services/mi-informacion-service";
import { ETIQUETA_TIPO_EVENTO, TIPOS_EVENTO } from "@/server/validation/evento";

export const metadata = { title: "Mi asistencia" };

const ESTADO = {
  presente: { texto: "Presente", tono: "verde" },
  ausente: { texto: "Ausente", tono: "rojo" },
  justificado: { texto: "Justificado", tono: "ambar" },
} as const;

export default async function MiAsistenciaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const sp = await searchParams;
  const user = await exigirSesion(["socio"]);
  const ctx = contextoDe(user);
  const tipo = TIPOS_EVENTO.find((t) => t === sp.tipo);
  const historial = ctx.role === "tenant" ? await obtenerMiHistorial(ctx, user, { tipo }) : null;

  return (
    <AppShell user={user} navegacion={navegacionPara(user.rol)}>
      <div className="max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Mi asistencia</h1>
        {!historial ? (
          <p role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {new AppError("NO_EN_PADRON").message}
          </p>
        ) : (
          <>
            <TarjetaCumplimiento cumplimiento={historial.cumplimiento} />

            <div className="flex flex-wrap items-end justify-between gap-3">
              <form method="get" role="search" className="flex items-end gap-3">
                <div>
                  <label htmlFor="f-tipo" className="mb-1 block text-xs font-semibold text-slate-700">Tipo de evento</label>
                  <select id="f-tipo" name="tipo" defaultValue={tipo ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Todos</option>
                    {TIPOS_EVENTO.map((t) => (
                      <option key={t} value={t}>{ETIQUETA_TIPO_EVENTO[t]}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Filtrar</button>
                {tipo ? <Link href="/mi/asistencia" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
              </form>
              <a href="/api/mi/asistencia.pdf" download className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
                Descargar historial en PDF
              </a>
            </div>

            {historial.items.length === 0 ? (
              <EstadoVacio
                titulo={tipo ? "No hay eventos de ese tipo en su historial" : "Aún no tiene eventos en su historial"}
                descripcion="Aquí aparecerán las asambleas y mingas con asistencia registrada desde su ingreso."
              />
            ) : (
              <div role="region" aria-label="Historial de asistencia (desplazable)" tabIndex={0} className="relative overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Historial de asistencia</caption>
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">Fecha</th>
                      <th scope="col" className="px-4 py-3">Evento</th>
                      <th scope="col" className="px-4 py-3">Asistencia</th>
                      <th scope="col" className="px-4 py-3">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historial.items.map((i) => (
                      <tr key={i.eventoId}>
                        <td className="whitespace-nowrap px-4 py-3">{formatoFecha(i.fecha)}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{i.titulo}</p>
                          <p className="text-xs text-slate-500">{ETIQUETA_TIPO_EVENTO[i.tipo]} · {i.lugar}</p>
                        </td>
                        <td className="px-4 py-3"><Insignia tono={ESTADO[i.estado].tono}>{ESTADO[i.estado].texto}</Insignia></td>
                        <td className="px-4 py-3">{i.motivo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
