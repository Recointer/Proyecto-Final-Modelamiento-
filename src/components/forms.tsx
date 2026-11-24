"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function Campo(props: {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  placeholder?: string;
  requerido?: boolean;
  autoComplete?: string;
  ayuda?: string;
  error?: string;
  defaultValue?: string;
  /** Para campos de fecha o número. */
  max?: string;
}) {
  // id único: varios formularios pueden compartir el nombre de campo en la misma página
  const id = `campo-${props.nombre}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {props.etiqueta}
        {props.requerido ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        name={props.nombre}
        type={props.tipo ?? "text"}
        placeholder={props.placeholder}
        required={props.requerido}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        max={props.max}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${id}-error` : props.ayuda ? `${id}-ayuda` : undefined}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-teal-700"
      />
      {props.ayuda && !props.error ? (
        <p id={`${id}-ayuda`} className="text-xs text-slate-600">
          {props.ayuda}
        </p>
      ) : null}
      {props.error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}

export function BotonEnviar({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
    >
      {pending ? "Procesando…" : children}
    </button>
  );
}

export function MensajeError({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {mensaje}
    </div>
  );
}

export function MensajeExito({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
      {mensaje}
    </div>
  );
}
