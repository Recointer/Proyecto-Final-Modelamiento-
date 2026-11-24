"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearTurnoAction, editarTurnoAction, type EstadoServicioForm } from "./actions";
import { BotonEnviar, Campo, MensajeError } from "@/components/forms";
import { DIAS_SEMANA } from "@/server/validation/servicio";

export function TurnoForm({
  servicioId,
  sectores,
  turnoId,
  inicial,
}: {
  servicioId: string;
  sectores: { id: string; nombre: string }[];
  turnoId?: string;
  inicial?: Record<string, string>;
}) {
  const [estado, enviar] = useActionState<EstadoServicioForm, FormData>(turnoId ? editarTurnoAction : crearTurnoAction, {});
  const v = (c: string) => estado.valores?.[c] ?? inicial?.[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;
  const sel = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm";
  const sufijo = turnoId ?? "nuevo";

  return (
    <form action={enviar} className="space-y-3" noValidate aria-label={turnoId ? "Editar turno" : "Agregar turno"}>
      <input type="hidden" name="servicioId" value={servicioId} />
      {turnoId ? <input type="hidden" name="turnoId" value={turnoId} /> : null}
      <MensajeError mensaje={errorGeneral} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor={`t-sector-${sufijo}`} className="block text-sm font-semibold text-slate-800">Sector *</label>
          <select key={v("sectorId")} id={`t-sector-${sufijo}`} name="sectorId" defaultValue={v("sectorId")} aria-invalid={e("sectorId") ? true : undefined} className={sel}>
            <option value="">Seleccione…</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          {e("sectorId") ? <p role="alert" className="text-sm text-red-700">{e("sectorId")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor={`t-dia-${sufijo}`} className="block text-sm font-semibold text-slate-800">Día *</label>
          <select key={v("diaSemana")} id={`t-dia-${sufijo}`} name="diaSemana" defaultValue={v("diaSemana")} aria-invalid={e("diaSemana") ? true : undefined} className={sel}>
            <option value="">Seleccione…</option>
            {DIAS_SEMANA.map((d, i) => (
              <option key={d} value={String(i + 1)}>{d}</option>
            ))}
          </select>
          {e("diaSemana") ? <p role="alert" className="text-sm text-red-700">{e("diaSemana")}</p> : null}
        </div>
        <Campo nombre="horaInicio" etiqueta="Hora de inicio" tipo="time" requerido defaultValue={v("horaInicio")} error={e("horaInicio")} />
        <Campo nombre="horaFin" etiqueta="Hora de fin" tipo="time" requerido defaultValue={v("horaFin")} error={e("horaFin")} />
      </div>
      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{turnoId ? "Guardar turno" : "Agregar turno"}</BotonEnviar>
        {turnoId ? <Link href={`/servicios/${servicioId}`} className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">Cancelar</Link> : null}
      </div>
    </form>
  );
}
