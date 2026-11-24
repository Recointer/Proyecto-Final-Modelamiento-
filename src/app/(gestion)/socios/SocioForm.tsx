"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearSocioAction, editarSocioAction, type EstadoSocioForm } from "./actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";

export function SocioForm({
  modo,
  sectores,
  hoy,
  id,
  cedula,
  inicial,
}: {
  modo: "crear" | "editar";
  sectores: { id: string; nombre: string }[];
  /** Fecha de hoy (AAAA-MM-DD, hora de Ecuador): tope del campo de fecha de ingreso. */
  hoy: string;
  id?: string;
  cedula?: string;
  inicial?: Record<string, string>;
}) {
  const [estado, enviar] = useActionState<EstadoSocioForm, FormData>(
    modo === "crear" ? crearSocioAction : editarSocioAction,
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

      {modo === "crear" ? (
        <Campo nombre="cedula" etiqueta="Cédula / identificación" requerido defaultValue={v("cedula")} error={e("cedula")} ayuda="10 dígitos." />
      ) : (
        <p className="text-sm">
          <span className="font-semibold">Cédula:</span> {cedula} <span className="text-slate-600">(no se puede modificar)</span>
        </p>
      )}

      <Campo nombre="nombres" etiqueta="Nombres completos" requerido defaultValue={v("nombres")} error={e("nombres")} />

      <div className="space-y-1">
        <label htmlFor="socio-sector" className="block text-sm font-semibold text-slate-800">
          Sector / zona asignada <span aria-hidden="true">*</span>
        </label>
        <select
          key={v("sectorId")} // remonta el select al recibir el valor devuelto por el servidor (defaultValue no se reaplica)
          id="socio-sector"
          name="sectorId"
          defaultValue={v("sectorId")}
          aria-invalid={e("sectorId") ? true : undefined}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm"
        >
          <option value="">Seleccione un sector…</option>
          {sectores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        {e("sectorId") ? (
          <p role="alert" className="text-sm text-red-700">
            {e("sectorId")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="telefono" etiqueta="Teléfono (opcional)" defaultValue={v("telefono")} error={e("telefono")} />
        <Campo nombre="correo" etiqueta="Correo electrónico (opcional)" tipo="email" defaultValue={v("correo")} error={e("correo")} />
      </div>

      <Campo
        nombre="fechaIngreso"
        etiqueta="Fecha de ingreso"
        tipo="date"
        max={hoy}
        requerido
        defaultValue={v("fechaIngreso")}
        error={e("fechaIngreso")}
      />

      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{modo === "crear" ? "Guardar socio" : "Guardar cambios"}</BotonEnviar>
        <Link href="/socios" className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
