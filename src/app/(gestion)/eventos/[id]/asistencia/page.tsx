import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/result";
import { contextoGestion } from "@/server/auth/page-guard";
import { obtenerListaAsistencia } from "@/server/services/asistencia-service";
import { ETIQUETA_TIPO_EVENTO } from "@/server/validation/evento";
import { formatoFecha } from "@/lib/fechas";
import { ListaAsistencia } from "./ListaAsistencia";

export const metadata = { title: "Asistencia" };

export default async function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero"]);
  let lista;
  try {
    lista = await obtenerListaAsistencia(ctx, id);
  } catch (e) {
    if (e instanceof AppError && e.codigo === "EVENTO_NO_ENCONTRADO") notFound();
    throw e;
  }

  const puedeEditar = user.rol === "secretario" && lista.puedeRegistrar;
  const ev = lista.evento;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href={`/eventos/${ev.id}`} className="text-sm text-teal-800 underline">← Volver al evento</Link>
        <h1 className="mt-2 text-2xl font-bold">Registrar asistencia</h1>
        <p className="text-sm text-slate-600">
          {ev.titulo} · {ETIQUETA_TIPO_EVENTO[ev.tipo]} · {formatoFecha(ev.fecha)} · {ev.lugar}
        </p>
      </div>

      {lista.motivoBloqueo === "anulado" ? (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
          Este evento está anulado y no admite cambios de asistencia.
        </p>
      ) : null}
      {lista.motivoBloqueo === "futuro" ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          El evento aún no se realiza: la asistencia se registra desde su fecha.
        </p>
      ) : null}
      {user.rol !== "secretario" ? (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
          Vista de consulta: solo el Secretario/a registra la asistencia.
        </p>
      ) : null}

      <ListaAsistencia
        eventoId={ev.id}
        items={lista.items}
        quorumPorcentaje={lista.resumen.quorumPorcentaje}
        soloLectura={!puedeEditar}
      />
    </div>
  );
}
