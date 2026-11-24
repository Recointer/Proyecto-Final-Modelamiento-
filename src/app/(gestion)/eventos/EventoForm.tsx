"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearEventoAction, editarEventoAction, type EstadoEventoForm } from "./actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";
import { ETIQUETA_TIPO_EVENTO, TIPOS_EVENTO } from "@/server/validation/evento";

export function EventoForm({
  modo,
  id,
  inicial,
}: {
  modo: "crear" | "editar";
  id?: string;
  inicial?: Record<string, string>;
}) {
  const [estado, enviar] = useActionState<EstadoEventoForm, FormData>(
    modo === "crear" ? crearEventoAction : editarEventoAction,
    {},
  );
  const v = (c: string) => estado.valores?.[c] ?? inicial?.[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  return (
    <form action={enviar} className="max-w-xl space-y-4" noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <MensajeExito mensaje={estado.exito} />
      <MensajeError mensaje={errorGeneral} />

      <div className="space-y-1">
        <label htmlFor="evento-tipo" className="block text-sm font-semibold text-slate-800">
          Tipo de evento <span aria-hidden="true">*</span>
        </label>
        <select
          key={v("tipo")}
          id="evento-tipo"
          name="tipo"
          defaultValue={v("tipo") || "asamblea"}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm"
        >
          {TIPOS_EVENTO.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_EVENTO[t]}
            </option>
          ))}
        </select>
        {e("tipo") ? <p role="alert" className="text-sm text-red-700">{e("tipo")}</p> : null}
      </div>

      <Campo nombre="titulo" etiqueta="Título" requerido defaultValue={v("titulo")} error={e("titulo")} placeholder="Ej: Asamblea General Ordinaria #3" />
      <Campo nombre="fecha" etiqueta="Fecha" tipo="date" requerido defaultValue={v("fecha")} error={e("fecha")} />
      <Campo nombre="lugar" etiqueta="Lugar" requerido defaultValue={v("lugar")} error={e("lugar")} placeholder="Ej: Casa comunal central" />

      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{modo === "crear" ? "Guardar evento" : "Guardar cambios"}</BotonEnviar>
        <Link href="/eventos" className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
