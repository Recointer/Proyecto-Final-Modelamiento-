"use client";

import { useActionState } from "react";
import { crearSectorAction, type EstadoConfigForm } from "./actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";

export function NuevoSectorForm() {
  const [estado, enviar] = useActionState<EstadoConfigForm, FormData>(crearSectorAction, {});
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;
  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <div className="sm:col-span-3">
        <MensajeExito mensaje={estado.exito} />
        <MensajeError mensaje={errorGeneral} />
      </div>
      <Campo nombre="nombre" etiqueta="Nombre del nuevo sector" requerido defaultValue={estado.valores?.nombre} error={estado.errores?.nombre} />
      <Campo nombre="descripcion" etiqueta="Descripción (opcional)" defaultValue={estado.valores?.descripcion} error={estado.errores?.descripcion} />
      <div className="sm:w-40">
        <BotonEnviar>Agregar sector</BotonEnviar>
      </div>
    </form>
  );
}
