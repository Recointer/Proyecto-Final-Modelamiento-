import Link from "next/link";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarEventosParaMultas } from "@/server/services/multa-service";
import { ETIQUETA_TIPO_EVENTO } from "@/server/validation/evento";
import { generarMultasAction } from "../actions";

export const metadata = { title: "Multas por inasistencia" };

export default async function MultasPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await contextoGestion(["tesorero"]);
  const eventos = await listarEventosParaMultas(ctx);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Multas por inasistencia</h1>
        <p className="text-sm text-slate-600">
          Cada socio ausente sin justificar recibe un cargo con la multa que la junta configuró para el tipo de evento. Las multas se cobran
          desde «Cuentas por cobrar».
        </p>
      </div>
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      {eventos.length === 0 ? (
        <EstadoVacio titulo="No hay eventos con asistencia guardada" descripcion="Secretaría debe registrar y guardar la asistencia de un evento realizado." />
      ) : (
        <TablaScroll etiqueta="Eventos con asistencia">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Eventos con asistencia guardada</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Evento</th>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3 text-right">Ausentes</th>
                <th scope="col" className="px-4 py-3 text-right">Multa</th>
                <th scope="col" className="px-4 py-3 text-right">Generadas</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {eventos.map((e) => {
                const sinMulta = Number(e.monto) <= 0;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{e.titulo}</p>
                      <p className="text-xs text-slate-500">{ETIQUETA_TIPO_EVENTO[e.tipo]}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(e.fecha)}</td>
                    <td className="px-4 py-3 text-right">{e.ausentes}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{sinMulta ? "No configurada" : formatoUsd(e.monto)}</td>
                    <td className="px-4 py-3 text-right">{e.multasGeneradas}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {sinMulta ? (
                          <span className="text-xs text-slate-500">El Administrador debe configurar la multa</span>
                        ) : e.ausentes === 0 ? (
                          <span className="text-xs text-slate-500">Sin ausentes injustificados</span>
                        ) : (
                          <ConfirmarAccion
                            action={generarMultasAction}
                            etiqueta={e.multasGeneradas > 0 ? "Completar multas" : "Generar multas"}
                            titulo="¿Generar las multas?"
                            mensaje={`Se emitirá un cargo de ${formatoUsd(e.monto)} a cada socio ausente sin justificar en «${e.titulo}». Las multas ya generadas no se duplican.`}
                            etiquetaConfirmar="Sí, generar"
                            campos={{ eventoId: e.id }}
                            peligro={false}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TablaScroll>
      )}
      <p className="text-sm">
        <Link href="/finanzas/cobros" className="text-teal-800 underline">Ir a las cuentas por cobrar</Link>
      </p>
    </div>
  );
}
