"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  restablecerPasswordAction,
  solicitarRecuperacionAction,
  type EstadoForm,
} from "../actions";
import { BotonEnviar, Campo, MensajeError, MensajeExito } from "@/components/forms";

function Solicitar() {
  const [estado, accion] = useActionState<EstadoForm, FormData>(solicitarRecuperacionAction, {});
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeError mensaje={estado.error?.mensaje} />
      <MensajeExito mensaje={estado.exito} />
      <Campo nombre="junta" etiqueta="Identificador de junta (opcional)" />
      <Campo nombre="identificador" etiqueta="Correo electrónico o cédula" requerido autoComplete="username" />
      <BotonEnviar>Enviar enlace de recuperación</BotonEnviar>
    </form>
  );
}

function Restablecer({ token }: { token: string }) {
  const [estado, accion] = useActionState<EstadoForm, FormData>(restablecerPasswordAction, {});
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeError mensaje={estado.error?.mensaje} />
      <input type="hidden" name="token" value={token} />
      <Campo
        nombre="password"
        etiqueta="Nueva contraseña"
        tipo="password"
        requerido
        autoComplete="new-password"
        ayuda="Mínimo 10 caracteres, con letras y números."
      />
      <Campo nombre="confirmar" etiqueta="Confirmar contraseña" tipo="password" requerido autoComplete="new-password" />
      <BotonEnviar>Guardar nueva contraseña</BotonEnviar>
    </form>
  );
}

function Contenido() {
  const token = useSearchParams().get("token");
  return token ? <Restablecer token={token} /> : <Solicitar />;
}

export default function RecuperarPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Recuperar contraseña</h1>
      <Suspense>
        <Contenido />
      </Suspense>
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-teal-800 underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </main>
  );
}
