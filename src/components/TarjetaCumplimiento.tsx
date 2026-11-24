import type { Cumplimiento } from "@/lib/cumplimiento";

/** Porcentaje de cumplimiento, meta de referencia y totales. El estado se dice con texto, no solo con color. */
export function TarjetaCumplimiento({ cumplimiento: c }: { cumplimiento: Cumplimiento }) {
  const pct = c.porcentaje === null ? null : String(c.porcentaje).replace(".", ",");
  return (
    <section aria-labelledby="cumplimiento-titulo" className="rounded-xl border bg-white p-5">
      <h2 id="cumplimiento-titulo" className="text-sm font-semibold text-slate-600">Cumplimiento de asistencia</h2>
      {pct === null ? (
        <p data-testid="cumplimiento-pct" className="mt-1 text-2xl font-bold text-slate-700">No aplica</p>
      ) : (
        <p data-testid="cumplimiento-pct" className="mt-1 text-3xl font-bold text-slate-900">{pct} %</p>
      )}
      <p className="text-sm text-slate-600">
        {pct === null
          ? "Aún no hay eventos con asistencia registrada."
          : c.cumpleMeta
            ? `Cumple la meta de referencia del ${c.meta} %.`
            : `Por debajo de la meta de referencia del ${c.meta} %.`}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="text-xs text-slate-600">Presentes</dt>
          <dd className="text-lg font-bold">{c.presentes}</dd>
        </div>
        <div className="rounded-lg bg-amber-50 p-2">
          <dt className="text-xs text-slate-600">Justificadas</dt>
          <dd className="text-lg font-bold">{c.justificados}</dd>
        </div>
        <div className="rounded-lg bg-red-50 p-2">
          <dt className="text-xs text-slate-600">Injustificadas</dt>
          <dd className="text-lg font-bold">{c.ausentes}</dd>
        </div>
      </dl>
    </section>
  );
}
