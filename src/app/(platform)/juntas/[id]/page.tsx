import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoSuperAdmin } from "@/server/auth/page-guard";
import { obtenerJunta } from "@/server/services/junta-service";
import { z } from "zod";
import { desactivarJuntaAction, editarJuntaAction, reactivarJuntaAction } from "../actions";
import { JuntaForm } from "../JuntaForm";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { Insignia } from "@/components/ui";
import { MensajeError, MensajeExito } from "@/components/forms";

type Params = Record<string, string | string[] | undefined>;

export default async function JuntaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const ctx = await contextoSuperAdmin();
  const j = await obtenerJunta(ctx, id);
  if (!j) notFound();

  const aviso = (k: string) => (sp[k] ? true : false);
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const activa = j.estado === "activa";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/juntas" className="text-sm text-teal-800 underline">← Volver al listado</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{j.nombre}</h1>
          <Insignia tono={activa ? "verde" : "gris"}>{activa ? "Activa" : "Desactivada"}</Insignia>
        </div>
        <p className="text-sm text-slate-600">Identificador de acceso: <code>{j.slug}</code></p>
      </div>

      {aviso("creada") ? <MensajeExito mensaje="Junta registrada correctamente." /> : null}
      {aviso("guardada") ? <MensajeExito mensaje="Cambios guardados." /> : null}
      {aviso("desactivada") ? <MensajeExito mensaje="Junta desactivada. Sus usuarios ya no pueden ingresar; sus datos se conservan." /> : null}
      {aviso("reactivada") ? <MensajeExito mensaje="Junta reactivada." /> : null}
      <MensajeError mensaje={error} />

      <section aria-labelledby="admin-titulo" className="max-w-2xl rounded-xl border bg-white p-5">
        <h2 id="admin-titulo" className="font-bold">Administrador de la junta</h2>
        <p className="my-2 text-sm text-slate-600">Asigne o cambie a la persona que administra esta junta.</p>
        <Link href={`/juntas/${j.id}/administrador`} className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Gestionar administrador
        </Link>
      </section>

      <JuntaForm
        accion={editarJuntaAction}
        idJunta={j.id}
        inicial={{
          nombre: j.nombre,
          tipo: j.tipo,
          provincia: j.provincia,
          canton: j.canton,
          parroquia: j.parroquia,
          contactoNombre: j.contactoNombre ?? "",
          contactoTelefono: j.contactoTelefono ?? "",
          contactoCorreo: j.contactoCorreo ?? "",
        }}
      />

      <section aria-labelledby="estado-titulo" className="max-w-2xl rounded-xl border bg-white p-5">
        <h2 id="estado-titulo" className="font-bold">Estado de la junta</h2>
        {activa ? (
          <>
            <p className="my-2 text-sm text-slate-600">
              Al desactivarla, ni la junta ni sus usuarios podrán ingresar. Los datos se conservan y puede reactivarla cuando quiera.
            </p>
            <ConfirmarAccion
              action={desactivarJuntaAction}
              etiqueta="Desactivar junta"
              titulo={`¿Desactivar «${j.nombre}»?`}
              mensaje="Se cerrarán las sesiones activas de todos sus usuarios. Los datos no se eliminan."
              etiquetaConfirmar="Sí, desactivar"
              campos={{ id: j.id, confirmar: "true" }}
            />
          </>
        ) : (
          <>
            <p className="my-2 text-sm text-slate-600">La junta está desactivada. Reactívela para devolver el acceso a sus usuarios.</p>
            <form action={reactivarJuntaAction}>
              <input type="hidden" name="id" value={j.id} />
              <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                Reactivar junta
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
