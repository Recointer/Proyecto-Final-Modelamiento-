/** Panel de "credencial inicial": se muestra una sola vez tras crear o restablecer una cuenta. */
export function CredencialInicial({
  titulo,
  credencial,
  correoEnviado,
  correo,
}: {
  titulo: string;
  credencial: string;
  correoEnviado: boolean;
  correo?: string;
}) {
  return (
    <div role="status" className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
      <p className="font-bold text-emerald-900">{titulo}</p>
      <p className="text-sm text-emerald-900">
        {correoEnviado && correo
          ? `Se envió la contraseña inicial a ${correo}.`
          : correo
            ? `No se pudo enviar el correo a ${correo}. Entregue esta contraseña de forma segura.`
            : "La cuenta no tiene correo: entregue esta contraseña de forma segura."}
      </p>
      <p className="text-sm">
        Contraseña inicial (se muestra una sola vez):{" "}
        <code data-testid="credencial" className="rounded bg-white px-2 py-1 font-mono text-base">
          {credencial}
        </code>
      </p>
      <p className="text-xs text-slate-600">La persona deberá crear su propia contraseña al ingresar por primera vez.</p>
    </div>
  );
}
