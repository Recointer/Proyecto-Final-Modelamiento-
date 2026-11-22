"use client";

import { useActionState } from "react";
import type { EstadoAdminForm } from "./actions";
import { BotonEnviar, Campo, MensajeError } from "@/components/forms";

export function AdministradorForm({
  accion,
  juntaId,
  modo,
}: {
  accion: (prev: EstadoAdminForm, fd: FormData) => Promise<EstadoAdminForm>;
  juntaId: string;
  modo: "asignar" | "cambiar";
}) {
  const [estado, enviar] = useActionState<EstadoAdminForm, FormData>(accion, {});
  const v = (c: string) => estado.valores?.[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  if (estado.resultado) {
    const r = estado.resultado;
    return (
      <div role="status" className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
        <p className="font-bold text-emerald-900">
          {r.modo === "asignar" ? "Administrador asignado." : "Administrador cambiado."}
        </p>
        <p className="text-sm text-emerald-900">
          {r.correoEnviado
            ? `Se envió la contraseña inicial a ${r.correo}.`
            : `No se pudo enviar el correo a ${r.correo}. Entregue esta contraseña de forma segura.`}
        </p>
        <p className="text-sm">
          Contraseña inicial (se muestra una sola vez):{" "}
          <code data-testid="credencial" className="rounded bg-white px-2 py-1 font-mono text-base">
            {r.credencialInicial}
          </code>
        </p>
        <p className="text-xs text-slate-600">La persona deberá crear su propia contraseña al ingresar por primera vez.</p>
      </div>
    );
  }

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="juntaId" value={juntaId} />
      <MensajeError mensaje={errorGeneral} />
      <Campo nombre="cedula" etiqueta="Cédula del nuevo administrador" requerido defaultValue={v("cedula")} error={e("cedula")} />
      <Campo nombre="nombres" etiqueta="Nombres completos" requerido defaultValue={v("nombres")} error={e("nombres")} />
      <Campo nombre="correo" etiqueta="Correo electrónico" tipo="email" requerido defaultValue={v("correo")} error={e("correo")} />
      {modo === "cambiar" ? (
        <Campo
          nombre="motivo"
          etiqueta="Motivo del cambio"
          requerido
          defaultValue={v("motivo")}
          error={e("motivo")}
          ayuda="Quedará registrado en la auditoría."
        />
      ) : null}
      <div className="space-y-1">
        <label htmlFor="campo-acta" className="block text-sm font-semibold text-slate-800">
          Acta de designación (PDF o imagen, máx. 5 MB) <span aria-hidden="true">*</span>
        </label>
        <input
          id="campo-acta"
          name="acta"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg"
          aria-describedby={e("acta") ? "campo-acta-error" : undefined}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2"
        />
        {e("acta") ? (
          <p id="campo-acta-error" role="alert" className="text-sm text-red-700">
            {e("acta")}
          </p>
        ) : null}
      </div>
      <BotonEnviar>{modo === "asignar" ? "Validar y asignar nuevo administrador" : "Solicitar cambio de administrador"}</BotonEnviar>
    </form>
  );
}
