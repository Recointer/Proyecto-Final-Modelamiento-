"use client";

import { useId, useRef, type ReactNode } from "react";

/**
 * Botón que abre un diálogo de confirmación accesible antes de ejecutar la acción
 * (formulario con `action`). Usa <dialog> nativo: foco atrapado y cierre con Escape.
 */
export function ConfirmarAccion({
  action,
  etiqueta,
  titulo,
  mensaje,
  etiquetaConfirmar,
  campos,
  peligro = true,
}: {
  action: (formData: FormData) => void | Promise<void>;
  etiqueta: string;
  titulo: string;
  mensaje: ReactNode;
  etiquetaConfirmar: string;
  campos?: Record<string, string>;
  peligro?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = `dlg-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
          peligro ? "border-red-300 text-red-700 hover:bg-red-50" : "border-teal-300 text-teal-800 hover:bg-teal-50"
        }`}
      >
        {etiqueta}
      </button>
      <dialog ref={ref} aria-labelledby={idTitulo} className="m-auto w-[min(92vw,28rem)] rounded-xl p-0 backdrop:bg-black/40">
        <form action={action} onSubmit={() => ref.current?.close()} className="space-y-4 p-6">
          {Object.entries(campos ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 id={idTitulo} className="text-lg font-bold">
            {titulo}
          </h2>
          <div className="text-sm text-slate-700">{mensaje}</div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                peligro ? "bg-red-700 hover:bg-red-800" : "bg-teal-700 hover:bg-teal-800"
              }`}
            >
              {etiquetaConfirmar}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
