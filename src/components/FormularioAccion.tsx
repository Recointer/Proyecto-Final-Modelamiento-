"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { BotonEnviar, MensajeError } from "@/components/forms";
import type { CampoFormulario, EstadoFormulario } from "@/lib/formularios";

const base = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-teal-700";

/**
 * Formulario genérico para las pantallas de Finanzas: se describe con una lista de campos, usa una
 * acción de servidor con estado y muestra los errores junto a cada campo.
 */
export function FormularioAccion({
  action,
  campos,
  enviar,
  ocultos,
  cancelarHref,
  ancho = "max-w-xl",
}: {
  action: (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  campos: CampoFormulario[];
  enviar: string;
  ocultos?: Record<string, string>;
  cancelarHref?: string;
  ancho?: string;
}) {
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(action, {});
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  return (
    <form action={accion} className={`${ancho} space-y-4`} noValidate>
      {Object.entries(ocultos ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <MensajeError mensaje={errorGeneral} />
      {campos.map((c) => {
        const id = `f-${c.nombre}-${uid}`;
        const valor = estado.valores?.[c.nombre] ?? c.inicial ?? "";
        const error = estado.errores?.[c.nombre];
        const descr = error ? `${id}-error` : c.ayuda ? `${id}-ayuda` : undefined;
        const comun = { id, name: c.nombre, "aria-invalid": error ? true : undefined, "aria-describedby": descr } as const;
        if (c.tipo === "checkbox") {
          return (
            <div key={c.nombre} className="space-y-1">
              <label htmlFor={id} className="flex items-start gap-2 text-sm font-semibold text-slate-800">
                <input {...comun} type="checkbox" value="on" defaultChecked={estado.valores ? Boolean(estado.valores[c.nombre]) : c.inicial === "on"} className="mt-1 h-4 w-4" />
                <span>{c.etiqueta}</span>
              </label>
              {c.ayuda ? (
                <p id={`${id}-ayuda`} className="pl-6 text-xs font-normal text-slate-600">
                  {c.ayuda}
                </p>
              ) : null}
            </div>
          );
        }
        return (
          <div key={`${c.nombre}-${valor}`} className="space-y-1">
            <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
              {c.etiqueta}
              {c.requerido ? <span aria-hidden="true"> *</span> : null}
            </label>
            {c.tipo === "select" ? (
              <select {...comun} defaultValue={valor} className={base}>
                <option value="">{c.vacio ?? "Seleccione…"}</option>
                {c.opciones?.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            ) : c.tipo === "textarea" ? (
              <textarea {...comun} defaultValue={valor} rows={3} placeholder={c.placeholder} className={base} />
            ) : c.tipo === "file" ? (
              <input {...comun} type="file" accept={c.accept} className={`${base} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1`} />
            ) : (
              <input
                {...comun}
                type={c.tipo ?? "text"}
                defaultValue={valor}
                placeholder={c.placeholder}
                max={c.max}
                inputMode={c.modo}
                className={base}
              />
            )}
            {c.ayuda && !error ? (
              <p id={`${id}-ayuda`} className="text-xs text-slate-600">
                {c.ayuda}
              </p>
            ) : null}
            {error ? (
              <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{enviar}</BotonEnviar>
        {cancelarHref ? (
          <Link href={cancelarHref} className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
