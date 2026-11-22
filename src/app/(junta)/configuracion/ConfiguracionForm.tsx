"use client";

import { useActionState } from "react";
import { actualizarConfiguracionAction, type EstadoConfigForm } from "./actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";
import { ETIQUETA_TIPO, TIPOS_JUNTA } from "@/server/validation/junta";

export function ConfiguracionForm({ inicial }: { inicial: Record<string, string> }) {
  const [estado, enviar] = useActionState<EstadoConfigForm, FormData>(actualizarConfiguracionAction, {});
  const v = (c: string) => estado.valores?.[c] ?? inicial[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  return (
    <form action={enviar} className="max-w-2xl space-y-5" noValidate>
      <MensajeExito mensaje={estado.exito} />
      <MensajeError mensaje={errorGeneral} />

      <Campo nombre="nombre" etiqueta="Nombre de la junta" requerido defaultValue={v("nombre")} error={e("nombre")} />

      <div className="space-y-1">
        <label htmlFor="campo-tipo" className="block text-sm font-semibold text-slate-800">
          Tipo de organización <span aria-hidden="true">*</span>
        </label>
        <select
          id="campo-tipo"
          name="tipo"
          defaultValue={v("tipo")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm"
        >
          {TIPOS_JUNTA.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Ubicación</legend>
        <Campo nombre="provincia" etiqueta="Provincia" requerido defaultValue={v("provincia")} error={e("provincia")} />
        <Campo nombre="canton" etiqueta="Cantón" requerido defaultValue={v("canton")} error={e("canton")} />
        <Campo nombre="parroquia" etiqueta="Parroquia" requerido defaultValue={v("parroquia")} error={e("parroquia")} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Contacto (opcional)</legend>
        <Campo nombre="contactoNombre" etiqueta="Nombre" defaultValue={v("contactoNombre")} error={e("contactoNombre")} />
        <Campo nombre="contactoTelefono" etiqueta="Teléfono" defaultValue={v("contactoTelefono")} error={e("contactoTelefono")} />
        <Campo nombre="contactoCorreo" etiqueta="Correo" tipo="email" defaultValue={v("contactoCorreo")} error={e("contactoCorreo")} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Parámetros de la junta</legend>
        <Campo
          nombre="multaAsamblea"
          etiqueta="Multa por inasistencia a asamblea (USD)"
          requerido
          defaultValue={v("multaAsamblea")}
          error={e("multaAsamblea")}
        />
        <Campo
          nombre="multaMinga"
          etiqueta="Multa por inasistencia a minga (USD)"
          requerido
          defaultValue={v("multaMinga")}
          error={e("multaMinga")}
        />
        <Campo
          nombre="quorumPorcentaje"
          etiqueta="Quórum mínimo (%)"
          requerido
          defaultValue={v("quorumPorcentaje")}
          error={e("quorumPorcentaje")}
          ayuda="Porcentaje de asistencia para instalar una asamblea."
        />
      </fieldset>

      <div className="max-w-xs">
        <BotonEnviar>Guardar configuración</BotonEnviar>
      </div>
    </form>
  );
}
