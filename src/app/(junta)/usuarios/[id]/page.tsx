import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { contextoAdminJunta } from "@/server/auth/page-guard";
import { obtenerUsuario } from "@/server/services/usuario-service";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { Insignia } from "@/components/ui";
import { UsuarioForm } from "../UsuarioForm";
import { RestablecerCredencial } from "../RestablecerCredencial";
import { desactivarUsuarioAction, reactivarUsuarioAction } from "../actions";

export const metadata = { title: "Detalle de cuenta" };

export default async function UsuarioDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const ctx = await contextoAdminJunta();
  const u = await obtenerUsuario(ctx, id);
  if (!u) notFound();

  const esUno = u.id === ctx.userId;
  const rolBloqueado = esUno || u.rol === "admin_junta";
  const activo = u.estado === "activo";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/usuarios" className="text-sm text-teal-800 underline">← Volver al listado</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{u.nombres}</h1>
          <Insignia tono={activo ? "verde" : "gris"}>{activo ? "Activa" : "Desactivada"}</Insignia>
        </div>
      </div>

      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      <UsuarioForm
        modo="editar"
        id={u.id}
        cedula={u.cedula}
        rolBloqueado={rolBloqueado}
        inicial={{
          nombres: u.nombres,
          correo: u.correo ?? "",
          telefono: u.telefono ?? "",
          rol: u.rol === "admin_junta" ? "" : u.rol,
          rolActual: u.rol,
        }}
      />

      {!esUno ? (
        <section aria-labelledby="acceso" className="space-y-4 rounded-xl border bg-white p-5">
          <h2 id="acceso" className="font-bold">Acceso de la cuenta</h2>

          <RestablecerCredencial id={u.id} nombres={u.nombres} correo={u.correo ?? undefined} />

          {activo ? (
            <div>
              <p className="mb-2 text-sm text-slate-600">
                Al desactivarla la persona no podrá ingresar y se cerrarán sus sesiones. Su historial se conserva.
              </p>
              <ConfirmarAccion
                action={desactivarUsuarioAction}
                etiqueta="Desactivar cuenta"
                titulo={`¿Desactivar la cuenta de ${u.nombres}?`}
                mensaje="No podrá ingresar al sistema hasta que la reactive. No se elimina ningún dato."
                etiquetaConfirmar="Sí, desactivar"
                campos={{ id: u.id }}
              />
            </div>
          ) : (
            <form action={reactivarUsuarioAction}>
              <input type="hidden" name="id" value={u.id} />
              <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                Reactivar cuenta
              </button>
            </form>
          )}
        </section>
      ) : (
        <p className="text-sm text-slate-600">
          Esta es su propia cuenta: no puede desactivarla ni cambiar su rol. Para cambiar su contraseña use «¿Olvidó su contraseña?» en el inicio de sesión.
        </p>
      )}
    </div>
  );
}
