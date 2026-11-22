"use client";

import { useActionState } from "react";
import Link from "next/link";
import { iniciarSesionAction, type EstadoForm } from "../actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";

export function LoginForm({ restablecida }: { restablecida: boolean }) {
  const [estado, accion] = useActionState<EstadoForm, FormData>(iniciarSesionAction, {});

  return (
    <form action={accion} className="space-y-4" noValidate>
      {restablecida ? <MensajeExito mensaje="Contraseña actualizada. Ya puede iniciar sesión." /> : null}
      <MensajeError mensaje={estado.error?.mensaje} />
      {estado.juntas ? (
        <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {estado.juntas.map((j) => (
            <li key={j.slug}>
              {j.nombre}: <code>{j.slug}</code>
            </li>
          ))}
        </ul>
      ) : null}

      <Campo
        nombre="junta"
        etiqueta="Identificador de junta (opcional)"
        placeholder="Ej: san-antonio"
        autoComplete="organization"
        defaultValue={estado.valores?.junta}
      />
      <Campo
        nombre="identificador"
        etiqueta="Correo electrónico o número de cédula"
        placeholder="nombre@correo.com o 1712345678"
        requerido
        autoComplete="username"
        defaultValue={estado.valores?.identificador}
      />
      <Campo nombre="password" etiqueta="Contraseña" tipo="password" requerido autoComplete="current-password" />

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="recordar" className="size-4" />
          Mantener sesión activa
        </label>
        <Link href="/recuperar" className="text-teal-800 underline">
          ¿Olvidó su contraseña?
        </Link>
      </div>

      <BotonEnviar>Iniciar sesión</BotonEnviar>
    </form>
  );
}
