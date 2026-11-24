import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { contextoGestion } from "@/server/auth/page-guard";
import { obtenerSocio } from "@/server/services/socio-service";
import { listarSectores } from "@/server/services/configuracion-service";
import { hoyEcuador } from "@/lib/fechas";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { Insignia } from "@/components/ui";
import { SocioForm } from "../SocioForm";
import { desactivarSocioAction, reactivarSocioAction } from "../actions";

export const metadata = { title: "Ficha del socio" };

export default async function SocioDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; creado?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero"]);
  const [s, sectores] = await Promise.all([obtenerSocio(ctx, id), listarSectores(ctx)]);
  if (!s) notFound();

  const puedeEditar = user.rol === "secretario";
  const activo = s.estado === "activo";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/socios" className="text-sm text-teal-800 underline">← Volver a la nómina</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{s.nombres}</h1>
          <Insignia tono={activo ? "verde" : "gris"}>{activo ? "Activo" : "Inactivo"}</Insignia>
        </div>
      </div>

      {sp.creado ? <MensajeExito mensaje="Socio registrado correctamente." /> : null}
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      {puedeEditar ? (
        <>
          <SocioForm
            modo="editar"
            id={s.id}
            cedula={s.cedula}
            sectores={sectores}
            hoy={hoyEcuador()}
            inicial={{
              nombres: s.nombres,
              sectorId: s.sectorId,
              telefono: s.telefono ?? "",
              correo: s.correo ?? "",
              fechaIngreso: s.fechaIngreso,
            }}
          />

          <section aria-labelledby="estado-socio" className="rounded-xl border bg-white p-5">
            <h2 id="estado-socio" className="font-bold">Estado en la nómina</h2>
            {activo ? (
              <>
                <p className="my-2 text-sm text-slate-600">
                  Al darlo de baja deja de aparecer en las listas de asistencia nuevas, pero su historial y sus predios se conservan.
                </p>
                <ConfirmarAccion
                  action={desactivarSocioAction}
                  etiqueta="Dar de baja"
                  titulo={`¿Dar de baja a ${s.nombres}?`}
                  mensaje="Podrá reactivarlo cuando quiera. No se elimina ningún dato."
                  etiquetaConfirmar="Sí, dar de baja"
                  campos={{ id: s.id }}
                />
              </>
            ) : (
              <form action={reactivarSocioAction} className="mt-2">
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Reactivar socio
                </button>
              </form>
            )}
          </section>
        </>
      ) : (
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2 rounded-xl border bg-white p-5 text-sm">
          <dt className="text-slate-600">Cédula</dt>
          <dd>{s.cedula}</dd>
          <dt className="text-slate-600">Sector</dt>
          <dd>{s.sectorNombre}</dd>
          <dt className="text-slate-600">Teléfono</dt>
          <dd>{s.telefono ?? "—"}</dd>
          <dt className="text-slate-600">Correo</dt>
          <dd>{s.correo ?? "—"}</dd>
          <dt className="text-slate-600">Fecha de ingreso</dt>
          <dd>{s.fechaIngreso.split("-").reverse().join("/")}</dd>
        </dl>
      )}
    </div>
  );
}
