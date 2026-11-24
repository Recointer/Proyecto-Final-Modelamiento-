import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { contextoGestion } from "@/server/auth/page-guard";
import { obtenerEvento } from "@/server/services/evento-service";
import { ETIQUETA_TIPO_EVENTO } from "@/server/validation/evento";
import { esFechaFutura, formatoFecha } from "@/lib/fechas";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { Insignia } from "@/components/ui";
import { EventoForm } from "../EventoForm";
import { anularEventoAction } from "../actions";

export const metadata = { title: "Detalle del evento" };

export default async function EventoDetallePage({
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
  const e = await obtenerEvento(ctx, id);
  if (!e) notFound();

  const puedeEditar = user.rol === "secretario";
  const anulado = e.estado === "anulado";
  const futuro = esFechaFutura(e.fecha);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/eventos" className="text-sm text-teal-800 underline">← Volver a los eventos</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{e.titulo}</h1>
          {anulado ? <Insignia tono="gris">Anulado</Insignia> : futuro ? <Insignia tono="ambar">Programado</Insignia> : <Insignia tono="verde">Vigente</Insignia>}
        </div>
        <p className="text-sm text-slate-600">
          {ETIQUETA_TIPO_EVENTO[e.tipo]} · {formatoFecha(e.fecha)} · {e.lugar}
        </p>
      </div>

      {sp.creado ? <MensajeExito mensaje="Evento registrado correctamente." /> : null}
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      <section aria-labelledby="asistencia-titulo" className="rounded-xl border bg-white p-5">
        <h2 id="asistencia-titulo" className="font-bold">Asistencia</h2>
        {anulado ? (
          <p className="mt-2 text-sm text-slate-600">
            Este evento fue anulado: <strong>{e.motivoAnulacion}</strong>. Ya no cuenta en porcentajes de cumplimiento ni en el panel.
          </p>
        ) : futuro ? (
          <p className="mt-2 text-sm text-slate-600">El evento aún no se realiza: la asistencia se registra desde su fecha.</p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {e.asistenciaRegistrada ? `${e.presentes} de ${e.registrados} socios presentes.` : "Todavía no se registró la asistencia."}
          </p>
        )}
        {!anulado && !futuro ? (
          <Link
            href={`/eventos/${e.id}/asistencia`}
            className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {puedeEditar ? (e.asistenciaRegistrada ? "Revisar o corregir asistencia" : "Tomar asistencia") : "Ver asistencia"}
          </Link>
        ) : null}
      </section>

      {puedeEditar && !anulado ? (
        <>
          <section aria-labelledby="datos-titulo" className="rounded-xl border bg-white p-5">
            <h2 id="datos-titulo" className="mb-3 font-bold">Datos del evento</h2>
            <EventoForm modo="editar" id={e.id} inicial={{ tipo: e.tipo, titulo: e.titulo, fecha: e.fecha, lugar: e.lugar }} />
          </section>

          <section aria-labelledby="anular-titulo" className="rounded-xl border bg-white p-5">
            <h2 id="anular-titulo" className="font-bold">Anular el evento</h2>
            <p className="my-2 text-sm text-slate-600">
              Un evento no se elimina: al anularlo se conserva con su motivo y deja de contar en porcentajes y en el panel. No se puede deshacer.
            </p>
            <ConfirmarAccion
              action={anularEventoAction}
              etiqueta="Anular evento"
              titulo={`¿Anular «${e.titulo}»?`}
              mensaje="La anulación es irreversible. Indique el motivo para que quede registrado."
              etiquetaConfirmar="Sí, anular"
              campos={{ id: e.id }}
              entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 5, maximo: 500 }}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
