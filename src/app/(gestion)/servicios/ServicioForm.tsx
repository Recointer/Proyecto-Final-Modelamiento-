"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearServicioAction, editarServicioAction, type EstadoServicioForm } from "./actions";
import { BotonEnviar, Campo, MensajeError } from "@/components/forms";
import { ETIQUETA_TIPO_SERVICIO, TIPOS_SERVICIO } from "@/server/validation/servicio";

export function ServicioForm({ modo, id, inicial }: { modo: "crear" | "editar"; id?: string; inicial?: Record<string, string> }) {
  const [estado, enviar] = useActionState<EstadoServicioForm, FormData>(modo === "crear" ? crearServicioAction : editarServicioAction, {});
  const v = (c: string) => estado.valores?.[c] ?? inicial?.[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  return (
    <form action={enviar} className="max-w-xl space-y-4" noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <MensajeError mensaje={errorGeneral} />
      <Campo nombre="nombre" etiqueta="Nombre del servicio" requerido defaultValue={v("nombre")} error={e("nombre")} placeholder="Ej: Riego canal norte" />
      <div className="space-y-1">
        <label htmlFor="servicio-tipo" className="block text-sm font-semibold text-slate-800">
          Tipo <span aria-hidden="true">*</span>
        </label>
        <select
          key={v("tipo")}
          id="servicio-tipo"
          name="tipo"
          defaultValue={v("tipo")}
          aria-invalid={e("tipo") ? true : undefined}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm"
        >
          <option value="">Seleccione el tipo…</option>
          {TIPOS_SERVICIO.map((t) => (
            <option key={t} value={t}>{ETIQUETA_TIPO_SERVICIO[t]}</option>
          ))}
        </select>
        {e("tipo") ? <p role="alert" className="text-sm text-red-700">{e("tipo")}</p> : null}
      </div>
      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{modo === "crear" ? "Guardar servicio" : "Guardar cambios"}</BotonEnviar>
        <Link href={id ? `/servicios/${id}` : "/servicios"} className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">Cancelar</Link>
      </div>
    </form>
  );
}
