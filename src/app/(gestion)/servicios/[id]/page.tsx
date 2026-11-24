import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarSectores } from "@/server/services/configuracion-service";
import { obtenerServicio } from "@/server/services/servicio-service";
import { DIAS_SEMANA, ETIQUETA_TIPO_SERVICIO } from "@/server/validation/servicio";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { Insignia } from "@/components/ui";
import { ServicioForm } from "../ServicioForm";
import { TurnoForm } from "../TurnoForm";
import { desactivarServicioAction, eliminarTurnoAction, reactivarServicioAction } from "../actions";

export const metadata = { title: "Servicio y turnos" };

export default async function ServicioDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; creado?: string; guardado?: string; turno?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero"]);
  const s = await obtenerServicio(ctx, id);
  if (!s) notFound();
  const puedeEditar = user.rol === "secretario";
  const activo = s.estado === "activo";
  const sectores = puedeEditar ? await listarSectores(ctx) : [];
  const enEdicion = puedeEditar ? s.turnosDetalle.find((t) => t.id === sp.turno) : undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/servicios" className="text-sm text-teal-800 underline">← Volver a los servicios</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{s.nombre}</h1>
          <Insignia tono={activo ? "verde" : "gris"}>{activo ? "Activo" : "Inactivo"}</Insignia>
        </div>
        <p className="text-sm text-slate-600">{ETIQUETA_TIPO_SERVICIO[s.tipo]}</p>
      </div>

      {sp.creado ? <MensajeExito mensaje="Servicio registrado correctamente." /> : null}
      {sp.guardado ? <MensajeExito mensaje="Cambios guardados." /> : null}
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      <section aria-labelledby="turnos-titulo" className="space-y-3">
        <h2 id="turnos-titulo" className="font-bold">Turnos semanales</h2>
        {s.turnosDetalle.length === 0 ? (
          <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Este servicio aún no tiene turnos.</p>
        ) : (
          <div role="region" aria-label="Turnos del servicio (desplazable)" tabIndex={0} className="relative overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Turnos del servicio</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Día</th>
                  <th scope="col" className="px-4 py-3">Horario</th>
                  <th scope="col" className="px-4 py-3">Sector</th>
                  {puedeEditar ? <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.turnosDetalle.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3">{DIAS_SEMANA[t.diaSemana - 1]}</td>
                    <td className="whitespace-nowrap px-4 py-3">{t.horaInicio} – {t.horaFin}</td>
                    <td className="px-4 py-3">{t.sectorNombre}</td>
                    {puedeEditar ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link href={`/servicios/${id}?turno=${t.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                            Editar<span className="sr-only"> turno del {DIAS_SEMANA[t.diaSemana - 1]} {t.horaInicio}</span>
                          </Link>
                          <ConfirmarAccion
                            action={eliminarTurnoAction}
                            etiqueta="Eliminar"
                            titulo="¿Eliminar el turno?"
                            mensaje={`Se eliminará el turno del ${DIAS_SEMANA[t.diaSemana - 1]} de ${t.horaInicio} a ${t.horaFin} en ${t.sectorNombre}.`}
                            etiquetaConfirmar="Sí, eliminar"
                            campos={{ turnoId: t.id, servicioId: id }}
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {puedeEditar && activo ? (
        <section aria-labelledby="turno-form-titulo" className="space-y-3 rounded-xl border bg-white p-5">
          <h2 id="turno-form-titulo" className="font-bold">{enEdicion ? "Editar turno" : "Agregar turno"}</h2>
          {sectores.length === 0 ? (
            <p role="status" className="text-sm text-amber-900">Aún no hay sectores: pida al Administrador de la Junta que los cree en «Configuración».</p>
          ) : (
            <TurnoForm
              key={enEdicion?.id ?? "nuevo"}
              servicioId={id}
              sectores={sectores}
              turnoId={enEdicion?.id}
              inicial={
                enEdicion
                  ? { sectorId: enEdicion.sectorId, diaSemana: String(enEdicion.diaSemana), horaInicio: enEdicion.horaInicio, horaFin: enEdicion.horaFin }
                  : undefined
              }
            />
          )}
        </section>
      ) : null}

      {puedeEditar ? (
        <>
          <section aria-labelledby="datos-titulo" className="space-y-3">
            <h2 id="datos-titulo" className="font-bold">Datos del servicio</h2>
            <ServicioForm modo="editar" id={id} inicial={{ nombre: s.nombre, tipo: s.tipo }} />
          </section>
          <section className="flex flex-wrap gap-3 border-t pt-4">
            {activo ? (
              <ConfirmarAccion
                action={desactivarServicioAction}
                etiqueta="Dar de baja"
                titulo="¿Dar de baja el servicio?"
                mensaje="El servicio dejará de aparecer en el calendario de los socios. Podrá reactivarlo cuando quiera."
                etiquetaConfirmar="Sí, dar de baja"
                campos={{ id }}
              />
            ) : (
              <ConfirmarAccion
                action={reactivarServicioAction}
                etiqueta="Reactivar"
                titulo="¿Reactivar el servicio?"
                mensaje="El servicio volverá a aparecer en el calendario."
                etiquetaConfirmar="Sí, reactivar"
                campos={{ id }}
                peligro={false}
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
