"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearPredioAction, editarPredioAction, type EstadoPredioForm } from "./actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";

export function PredioForm({
  modo,
  sectores,
  socios,
  id,
  inicial,
  tieneImagen,
  nombrePredio,
}: {
  modo: "crear" | "editar";
  sectores: { id: string; nombre: string }[];
  socios: { id: string; nombres: string; cedula: string }[];
  id?: string;
  inicial?: Record<string, string>;
  tieneImagen?: boolean;
  nombrePredio?: string;
}) {
  const [estado, enviar] = useActionState<EstadoPredioForm, FormData>(
    modo === "crear" ? crearPredioAction : editarPredioAction,
    {},
  );
  const v = (c: string) => estado.valores?.[c] ?? inicial?.[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  const selectClase = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm";

  return (
    <form action={enviar} className="max-w-2xl space-y-4" noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <MensajeExito mensaje={estado.exito} />
      <MensajeError mensaje={errorGeneral} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="codigo" etiqueta="Código del predio" requerido defaultValue={v("codigo")} error={e("codigo")} placeholder="Ej: P-045" />
        <Campo nombre="nombre" etiqueta="Nombre del predio" requerido defaultValue={v("nombre")} error={e("nombre")} placeholder="Ej: Parcela central" />
      </div>

      <Campo
        nombre="superficieHa"
        etiqueta="Superficie (hectáreas)"
        requerido
        defaultValue={v("superficieHa")}
        error={e("superficieHa")}
        ayuda="Hasta 4 decimales; puede usar coma o punto."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="predio-sector" className="block text-sm font-semibold text-slate-800">
            Sector <span aria-hidden="true">*</span>
          </label>
          <select key={v("sectorId")} id="predio-sector" name="sectorId" defaultValue={v("sectorId")} aria-invalid={e("sectorId") ? true : undefined} className={selectClase}>
            <option value="">Seleccione un sector…</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          {e("sectorId") ? <p role="alert" className="text-sm text-red-700">{e("sectorId")}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="predio-socio" className="block text-sm font-semibold text-slate-800">
            Socio titular <span aria-hidden="true">*</span>
          </label>
          <select key={v("socioId")} id="predio-socio" name="socioId" defaultValue={v("socioId")} aria-invalid={e("socioId") ? true : undefined} className={selectClase}>
            <option value="">Seleccione un socio…</option>
            {socios.map((s) => (
              <option key={s.id} value={s.id}>{s.nombres} ({s.cedula})</option>
            ))}
          </select>
          {e("socioId") ? <p role="alert" className="text-sm text-red-700">{e("socioId")}</p> : null}
        </div>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Localización (opcional)</legend>
        <Campo nombre="latitud" etiqueta="Latitud" defaultValue={v("latitud")} error={e("latitud")} placeholder="-1.254310" ayuda="Entre -90 y 90." />
        <Campo nombre="longitud" etiqueta="Longitud" defaultValue={v("longitud")} error={e("longitud")} placeholder="-78.623120" ayuda="Entre -180 y 180." />
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="predio-imagen" className="block text-sm font-semibold text-slate-800">
          Imagen del predio (PNG o JPEG, máx. 5 MB)
        </label>
        {modo === "editar" && tieneImagen && id ? (
          <div className="space-y-2">
            {/* imagen servida por una ruta autenticada: next/image no aplica */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/predios/${id}/imagen`} alt={`Imagen actual del predio ${nombrePredio ?? ""}`} className="max-h-48 rounded-lg border" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="quitarImagen" className="size-4" />
              Quitar la imagen actual
            </label>
          </div>
        ) : null}
        <input
          id="predio-imagen"
          name="imagen"
          type="file"
          accept="image/png,image/jpeg"
          aria-describedby={e("imagen") ? "predio-imagen-error" : undefined}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2"
        />
        {e("imagen") ? (
          <p id="predio-imagen-error" role="alert" className="text-sm text-red-700">{e("imagen")}</p>
        ) : null}
      </div>

      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{modo === "crear" ? "Guardar predio" : "Guardar cambios"}</BotonEnviar>
        <Link href="/predios" className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">Cancelar</Link>
      </div>
    </form>
  );
}
