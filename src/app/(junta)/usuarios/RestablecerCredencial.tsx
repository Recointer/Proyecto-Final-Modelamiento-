"use client";

import { useState } from "react";
import { restablecerCredencialAction } from "./actions";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { CredencialInicial } from "@/components/CredencialInicial";
import { MensajeError } from "@/components/forms";

export function RestablecerCredencial({ id, nombres, correo }: { id: string; nombres: string; correo?: string }) {
  const [resultado, setResultado] = useState<
    | { tipo: "ok"; credencial: string; correoEnviado: boolean }
    | { tipo: "error"; mensaje: string }
    | null
  >(null);

  async function ejecutar(fd: FormData) {
    const r = await restablecerCredencialAction(fd);
    setResultado(
      r.ok
        ? { tipo: "ok", credencial: r.data.credencialInicial, correoEnviado: r.data.correoEnviado }
        : { tipo: "error", mensaje: r.error.mensaje },
    );
  }

  return (
    <div className="space-y-3">
      <ConfirmarAccion
        action={ejecutar}
        etiqueta="Restablecer contraseña"
        titulo={`¿Restablecer la contraseña de ${nombres}?`}
        mensaje="Se generará una contraseña inicial nueva, se cerrarán sus sesiones y deberá crear una propia al ingresar."
        etiquetaConfirmar="Sí, restablecer"
        campos={{ id }}
        peligro={false}
      />
      {resultado?.tipo === "ok" ? (
        <CredencialInicial
          titulo="Contraseña restablecida."
          credencial={resultado.credencial}
          correoEnviado={resultado.correoEnviado}
          correo={correo}
        />
      ) : null}
      {resultado?.tipo === "error" ? <MensajeError mensaje={resultado.mensaje} /> : null}
    </div>
  );
}
