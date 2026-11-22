"use client";

import { useActionState } from "react";
import { cambiarPasswordInicialAction, type EstadoForm } from "../actions";
import { BotonEnviar, Campo, MensajeError } from "@/components/forms";

export default function CambiarPasswordPage() {
  const [estado, accion] = useActionState<EstadoForm, FormData>(cambiarPasswordInicialAction, {});
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold">Cree su contraseña</h1>
      <p className="mb-6 mt-1 text-slate-600">
        Por seguridad, debe establecer una contraseña propia antes de continuar.
      </p>
      <form action={accion} className="space-y-4" noValidate>
        <MensajeError mensaje={estado.error?.mensaje} />
        <Campo
          nombre="password"
          etiqueta="Nueva contraseña"
          tipo="password"
          requerido
          autoComplete="new-password"
          ayuda="Mínimo 10 caracteres, con letras y números."
        />
        <Campo nombre="confirmar" etiqueta="Confirmar contraseña" tipo="password" requerido autoComplete="new-password" />
        <BotonEnviar>Guardar contraseña</BotonEnviar>
      </form>
    </main>
  );
}
