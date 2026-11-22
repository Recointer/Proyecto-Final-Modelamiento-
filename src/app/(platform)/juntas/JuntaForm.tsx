"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoJuntaForm } from "./actions";
import { BotonEnviar, Campo, MensajeError } from "@/components/forms";
import { ETIQUETA_TIPO, TIPOS_JUNTA } from "@/server/validation/junta";

export function JuntaForm({
  accion,
  inicial,
  idJunta,
}: {
  accion: (prev: EstadoJuntaForm, fd: FormData) => Promise<EstadoJuntaForm>;
  inicial: Record<string, string>;
  idJunta?: string;
}) {
  const [estado, enviar] = useActionState<EstadoJuntaForm, FormData>(accion, {});
  const v = (c: string) => estado.valores?.[c] ?? inicial[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  return (
    <form action={enviar} className="max-w-2xl space-y-5" noValidate>
      {idJunta ? <input type="hidden" name="id" value={idJunta} /> : null}
      <MensajeError mensaje={errorGeneral} />

      <Campo nombre="nombre" etiqueta="Nombre de la junta" requerido defaultValue={v("nombre")} error={e("nombre")} />

      <div className="space-y-1">
        <label htmlFor="campo-tipo" className="block text-sm font-semibold text-slate-800">
          Tipo de organización <span aria-hidden="true">*</span>
        </label>
        <select
          id="campo-tipo"
          name="tipo"
          required
          defaultValue={v("tipo") || "riego"}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm"
        >
          {TIPOS_JUNTA.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>
        {e("tipo") ? <p role="alert" className="text-sm text-red-700">{e("tipo")}</p> : null}
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Ubicación</legend>
        <Campo nombre="provincia" etiqueta="Provincia" requerido defaultValue={v("provincia")} error={e("provincia")} />
        <Campo nombre="canton" etiqueta="Cantón" requerido defaultValue={v("canton")} error={e("canton")} />
        <Campo nombre="parroquia" etiqueta="Parroquia" requerido defaultValue={v("parroquia")} error={e("parroquia")} />
      </fieldset>

      {!idJunta ? (
        <Campo
          nombre="slug"
          etiqueta="Identificador de acceso (opcional)"
          placeholder="ej: san-antonio"
          defaultValue={v("slug")}
          error={e("slug")}
          ayuda="Lo usan los socios para entrar a su junta. Si se deja vacío se genera desde el nombre."
        />
      ) : null}

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Contacto (opcional)</legend>
        <Campo nombre="contactoNombre" etiqueta="Nombre" defaultValue={v("contactoNombre")} error={e("contactoNombre")} />
        <Campo nombre="contactoTelefono" etiqueta="Teléfono" defaultValue={v("contactoTelefono")} error={e("contactoTelefono")} />
        <Campo
          nombre="contactoCorreo"
          etiqueta="Correo"
          tipo="email"
          defaultValue={v("contactoCorreo")}
          error={e("contactoCorreo")}
        />
      </fieldset>

      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{idJunta ? "Guardar cambios" : "Registrar junta"}</BotonEnviar>
        <Link href="/juntas" className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
