import { textoEn } from "@/lib/calendario";
import type { CalendarioSemanal } from "@/server/services/calendario-service";
import { DIAS_SEMANA, ETIQUETA_TIPO_SERVICIO } from "@/server/validation/servicio";

/** Calendario semanal (lunes a domingo) y próximos turnos. Sin JS: accesible y legible en móvil. */
export function SemanaCalendario({ calendario, titulo }: { calendario: CalendarioSemanal; titulo: string }) {
  const vacio = calendario.dias.every((d) => d.length === 0);
  return (
    <div className="space-y-6">
      <section aria-labelledby="proximos-titulo" className="space-y-2">
        <h2 id="proximos-titulo" className="font-bold">Próximos turnos</h2>
        {calendario.proximos.length === 0 ? (
          <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">No hay turnos próximos para este sector.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {calendario.proximos.map((p) => (
              <li key={p.id} className="rounded-xl border bg-white p-4">
                <p className="font-semibold">{p.servicio}</p>
                <p className="text-sm">{DIAS_SEMANA[p.dia - 1]} · {p.inicio} – {p.fin}</p>
                <p className={`text-sm font-semibold ${p.enCurso ? "text-teal-800" : "text-slate-600"}`}>{textoEn(p.enMinutos, p.enCurso)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="semana-titulo" className="space-y-2">
        <h2 id="semana-titulo" className="font-bold">{titulo}</h2>
        {vacio ? (
          <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Este sector aún no tiene turnos asignados.</p>
        ) : (
          <div role="region" aria-label="Calendario semanal de turnos (desplazable)" tabIndex={0} className="relative overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Calendario semanal de turnos</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Día</th>
                  <th scope="col" className="px-4 py-3">Turnos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calendario.dias.map((turnos, i) => (
                  <tr key={DIAS_SEMANA[i]}>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 align-top font-semibold">{DIAS_SEMANA[i]}</th>
                    <td className="px-4 py-3">
                      {turnos.length === 0 ? (
                        <span className="text-slate-500">Sin turnos</span>
                      ) : (
                        <ul className="space-y-1">
                          {turnos.map((t) => (
                            <li key={t.id}>
                              <span className="font-semibold">{t.inicio} – {t.fin}</span> · {t.servicio}{" "}
                              <span className="text-xs text-slate-500">({ETIQUETA_TIPO_SERVICIO[t.tipo as keyof typeof ETIQUETA_TIPO_SERVICIO] ?? t.tipo})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
