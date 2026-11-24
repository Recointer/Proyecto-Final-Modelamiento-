"use client";

import { useMemo, useState, useTransition } from "react";
import { resumirAsistencia, type EstadoAsistenciaValor } from "@/lib/quorum";
import type { ItemAsistencia } from "@/server/services/asistencia-service";
import { ETIQUETA_ASISTENCIA, ESTADOS_ASISTENCIA } from "@/server/validation/asistencia";
import { Insignia } from "@/components/ui";
import { guardarAsistenciaAction } from "../../actions";

type Fila = { estado: EstadoAsistenciaValor; motivo: string };

const TONO = { presente: "verde", ausente: "rojo", justificado: "ambar" } as const;

export function ListaAsistencia({
  eventoId,
  items,
  quorumPorcentaje,
  soloLectura,
}: {
  eventoId: string;
  items: ItemAsistencia[];
  quorumPorcentaje: number;
  /** true para el Administrador, el Tesorero/a o cuando el evento no admite cambios. */
  soloLectura: boolean;
}) {
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(items.map((i) => [i.socioId, { estado: i.estado, motivo: i.motivo }])),
  );
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [sinMotivo, setSinMotivo] = useState<Set<string>>(new Set());
  const [guardando, iniciar] = useTransition();

  const resumen = useMemo(
    () => resumirAsistencia(items.map((i) => filas[i.socioId]?.estado ?? "ausente"), quorumPorcentaje),
    [items, filas, quorumPorcentaje],
  );

  const termino = busqueda.trim().toLowerCase();
  const visibles = items.filter((i) => !termino || i.nombres.toLowerCase().includes(termino) || i.cedula.includes(termino));

  function cambiar(socioId: string, cambio: Partial<Fila>) {
    setFilas((f) => ({ ...f, [socioId]: { ...(f[socioId] as Fila), ...cambio } }));
    setMensaje(null);
    if (cambio.motivo !== undefined || cambio.estado !== undefined) {
      setSinMotivo((s) => {
        const n = new Set(s);
        n.delete(socioId);
        return n;
      });
    }
  }

  function marcarTodosPresentes() {
    setFilas((f) => {
      const n = { ...f };
      for (const i of visibles) n[i.socioId] = { estado: "presente", motivo: "" };
      return n;
    });
    setMensaje(null);
    setSinMotivo(new Set());
  }

  function guardar() {
    const faltantes = items.filter((i) => filas[i.socioId]?.estado === "justificado" && !filas[i.socioId]?.motivo.trim());
    if (faltantes.length > 0) {
      setSinMotivo(new Set(faltantes.map((i) => i.socioId)));
      setMensaje({ tipo: "error", texto: "Indique el motivo de cada justificación antes de guardar." });
      return;
    }
    iniciar(async () => {
      const r = await guardarAsistenciaAction(
        eventoId,
        items.map((i) => {
          const f = filas[i.socioId] as Fila;
          return { socioId: i.socioId, estado: f.estado, motivo: f.estado === "justificado" ? f.motivo.trim() : undefined };
        }),
      );
      setMensaje(
        r.ok
          ? { tipo: "ok", texto: `Asistencia guardada: ${r.data.presentes} presentes de ${r.data.total} socios.` }
          : { tipo: "error", texto: r.error.mensaje },
      );
    });
  }

  const porcentajeTexto = resumen.porcentaje === null ? "—" : `${String(resumen.porcentaje).replace(".", ",")} %`;

  return (
    <div className="space-y-4">
      <section aria-label="Resumen de asistencia" className="space-y-3 rounded-xl border bg-white p-4">
        <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2">
            <dt className="text-xs text-slate-600">Total</dt>
            <dd data-testid="total" className="text-2xl font-bold tabular-nums">{resumen.total}</dd>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2">
            <dt className="text-xs text-emerald-800">Presentes</dt>
            <dd data-testid="presentes" className="text-2xl font-bold tabular-nums text-emerald-800">{resumen.presentes}</dd>
          </div>
          <div className="rounded-lg bg-red-50 p-2">
            <dt className="text-xs text-red-800">Ausentes</dt>
            <dd data-testid="ausentes" className="text-2xl font-bold tabular-nums text-red-800">{resumen.ausentes}</dd>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <dt className="text-xs text-amber-800">Justificados</dt>
            <dd data-testid="justificados" className="text-2xl font-bold tabular-nums text-amber-800">{resumen.justificados}</dd>
          </div>
        </dl>

        <div>
          <div
            role="progressbar"
            aria-label="Porcentaje de asistencia"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={resumen.porcentaje ?? 0}
            className="relative h-3 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className={`h-full ${resumen.alcanzaQuorum ? "bg-emerald-600" : "bg-amber-500"}`}
              style={{ width: `${resumen.porcentaje ?? 0}%` }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${quorumPorcentaje}%` }} aria-hidden="true" />
          </div>
          <p role="status" data-testid="quorum" className="mt-2 text-sm">
            <strong>{porcentajeTexto}</strong> de asistencia · quórum mínimo {quorumPorcentaje} % ·{" "}
            <span className={resumen.alcanzaQuorum ? "font-semibold text-emerald-800" : "font-semibold text-amber-800"}>
              {resumen.total === 0 ? "sin socios" : resumen.alcanzaQuorum ? "quórum alcanzado" : "quórum no alcanzado"}
            </span>
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="busqueda-asistencia" className="mb-1 block text-xs font-semibold text-slate-700">
            Buscar por nombre o cédula
          </label>
          <input
            id="busqueda-asistencia"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        {!soloLectura ? (
          <button
            type="button"
            onClick={marcarTodosPresentes}
            className="rounded-lg border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
          >
            Marcar todos presentes{termino ? " (los visibles)" : ""}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-600">
          No hay socios activos para este evento. Registre socios en la nómina primero.
        </p>
      ) : visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-600">
          Ningún socio coincide con la búsqueda.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-white">
          {visibles.map((i) => {
            const f = filas[i.socioId] as Fila;
            return (
              <li key={i.socioId} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {i.nombres}
                      {i.inactivo ? <span className="ml-2"><Insignia tono="gris">Baja</Insignia></span> : null}
                    </p>
                    <p className="text-xs text-slate-600">{i.cedula} · {i.sectorNombre}</p>
                  </div>
                  {soloLectura ? (
                    <Insignia tono={TONO[f.estado]}>{ETIQUETA_ASISTENCIA[f.estado]}</Insignia>
                  ) : (
                    <fieldset className="flex overflow-hidden rounded-lg border">
                      <legend className="sr-only">Asistencia de {i.nombres}</legend>
                      {ESTADOS_ASISTENCIA.map((e) => (
                        <label key={e} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`asis-${i.socioId}`}
                            value={e}
                            checked={f.estado === e}
                            onChange={() => cambiar(i.socioId, { estado: e })}
                            className="peer sr-only"
                          />
                          <span
                            className={`block px-3 py-1.5 text-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-sky-500 ${
                              f.estado === e
                                ? e === "presente"
                                  ? "bg-emerald-700 font-semibold text-white"
                                  : e === "ausente"
                                    ? "bg-red-700 font-semibold text-white"
                                    : "bg-amber-700 font-semibold text-white"
                                : "bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {ETIQUETA_ASISTENCIA[e]}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>

                {f.estado === "justificado" ? (
                  soloLectura ? (
                    <p className="text-sm text-slate-700">Motivo: {f.motivo || "—"}</p>
                  ) : (
                    <div>
                      <label htmlFor={`motivo-${i.socioId}`} className="mb-1 block text-xs font-semibold text-slate-700">
                        Motivo de la justificación de {i.nombres} <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`motivo-${i.socioId}`}
                        value={f.motivo}
                        maxLength={300}
                        onChange={(e) => cambiar(i.socioId, { motivo: e.target.value })}
                        aria-invalid={sinMotivo.has(i.socioId) ? true : undefined}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      {sinMotivo.has(i.socioId) ? (
                        <p role="alert" className="mt-1 text-sm text-red-700">Indique el motivo.</p>
                      ) : null}
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {mensaje ? (
        <div
          role={mensaje.tipo === "ok" ? "status" : "alert"}
          className={`rounded-lg border p-3 text-sm ${
            mensaje.tipo === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {mensaje.texto}
        </div>
      ) : null}

      {!soloLectura && items.length > 0 ? (
        <div className="sticky bottom-0 -mx-4 border-t bg-white/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60 md:w-auto"
          >
            {guardando ? "Guardando…" : "Guardar asistencia"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
