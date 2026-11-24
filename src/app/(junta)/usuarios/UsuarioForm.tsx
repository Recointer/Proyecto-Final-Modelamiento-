"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearUsuarioAction, editarUsuarioAction, type EstadoUsuarioForm } from "./actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";
import { CredencialInicial } from "@/components/CredencialInicial";
import { ETIQUETA_ROL, ROLES_GESTIONABLES } from "@/server/validation/usuario";

export function UsuarioForm({
  modo,
  inicial,
  id,
  cedula,
  rolBloqueado,
}: {
  modo: "crear" | "editar";
  inicial?: Record<string, string>;
  id?: string;
  cedula?: string;
  /** El rol del administrador y el propio no se pueden cambiar desde aquí. */
  rolBloqueado?: boolean;
}) {
  const [estado, enviar] = useActionState<EstadoUsuarioForm, FormData>(
    modo === "crear" ? crearUsuarioAction : editarUsuarioAction,
    {},
  );
  const v = (c: string) => estado.valores?.[c] ?? inicial?.[c] ?? "";
  const e = (c: string) => estado.errores?.[c];
  const errorGeneral = estado.error && !estado.error.campo ? estado.error.mensaje : undefined;

  if (estado.credencial) {
    return (
      <div className="max-w-xl space-y-4">
        <CredencialInicial
          titulo="Cuenta creada."
          credencial={estado.credencial.credencialInicial}
          correoEnviado={estado.credencial.correoEnviado}
          correo={estado.credencial.correo}
        />
        <Link href="/usuarios" className="inline-block rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <form action={enviar} className="max-w-xl space-y-4" noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <MensajeExito mensaje={estado.exito} />
      <MensajeError mensaje={errorGeneral} />

      {modo === "crear" ? (
        <Campo nombre="cedula" etiqueta="Cédula" requerido defaultValue={v("cedula")} error={e("cedula")} />
      ) : (
        <p className="text-sm">
          <span className="font-semibold">Cédula:</span> {cedula} <span className="text-slate-600">(no se puede modificar)</span>
        </p>
      )}
      <Campo nombre="nombres" etiqueta="Nombres completos" requerido defaultValue={v("nombres")} error={e("nombres")} />
      <Campo
        nombre="correo"
        etiqueta="Correo electrónico (opcional)"
        tipo="email"
        defaultValue={v("correo")}
        error={e("correo")}
        ayuda="Necesario para recuperar la contraseña y recibir la credencial inicial."
      />
      <Campo nombre="telefono" etiqueta="Teléfono (opcional)" defaultValue={v("telefono")} error={e("telefono")} />

      <div className="space-y-1">
        <label htmlFor="usuario-rol" className="block text-sm font-semibold text-slate-800">
          Rol <span aria-hidden="true">*</span>
        </label>
        {rolBloqueado ? (
          <>
            <input type="hidden" name="rol" value="" />
            <p id="usuario-rol" className="rounded-lg border bg-slate-100 px-3 py-2 text-sm">
              {ETIQUETA_ROL[inicial?.rolActual ?? ""] ?? "—"} <span className="text-slate-600">(no se puede cambiar)</span>
            </p>
          </>
        ) : (
          <select
            key={v("rol")}
            id="usuario-rol"
            name="rol"
            defaultValue={v("rol") || "socio"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm"
          >
            {ROLES_GESTIONABLES.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        )}
        {e("rol") ? (
          <p role="alert" className="text-sm text-red-700">
            {e("rol")}
          </p>
        ) : null}
      </div>

      <div className="flex max-w-sm items-center gap-3">
        <BotonEnviar>{modo === "crear" ? "Crear cuenta" : "Guardar cambios"}</BotonEnviar>
        <Link href="/usuarios" className="rounded-lg border px-4 py-3 text-sm hover:bg-slate-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
