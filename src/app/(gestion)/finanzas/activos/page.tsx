import Link from "next/link";
import { z } from "zod";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, TablaScroll } from "@/components/ui";
import { formatoUsd, sumarDinero } from "@/lib/dinero";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarActivos } from "@/server/services/activo-service";
import { bajaActivoAction, guardarActivoAction } from "../actions";

export const metadata = { title: "Activos fijos" };

export default async function ActivosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; editar?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await contextoGestion(["tesorero"]);
  const activos = await listarActivos(ctx);
  const vigentes = activos.filter((a) => a.estado === "vigente");
  const editar = z.string().uuid().safeParse(sp.editar).success ? vigentes.find((a) => a.id === sp.editar) : undefined;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activos fijos</h1>
        <p className="text-sm text-slate-600">
          {vigentes.length === 1 ? "1 activo vigente" : `${vigentes.length} activos vigentes`} · Valor de adquisición vigente:{" "}
          <strong>{formatoUsd(sumarDinero(vigentes.map((a) => a.valor)))}</strong>
        </p>
      </div>
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      {activos.length === 0 ? (
        <EstadoVacio titulo="Aún no hay activos fijos registrados" descripcion="Registre bombas, herramientas, terrenos o equipos de la junta." />
      ) : (
        <TablaScroll etiqueta="Activos fijos">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Activos fijos de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Código</th>
                <th scope="col" className="px-4 py-3">Activo</th>
                <th scope="col" className="px-4 py-3">Adquisición</th>
                <th scope="col" className="px-4 py-3 text-right">Valor</th>
                <th scope="col" className="px-4 py-3">Ubicación</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activos.map((a) => (
                <tr key={a.id} className={a.estado === "baja" ? "text-slate-500" : undefined}>
                  <td className="px-4 py-3 font-semibold">{a.codigo}</td>
                  <td className="px-4 py-3">{a.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatoFecha(a.fechaAdquisicion)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatoUsd(a.valor)}</td>
                  <td className="px-4 py-3">{a.ubicacion}</td>
                  <td className="px-4 py-3">
                    {a.estado === "vigente" ? <Insignia tono="verde">Vigente</Insignia> : <Insignia tono="gris">De baja</Insignia>}
                    {a.motivoBaja ? <p className="mt-1 text-xs">{a.motivoBaja}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {a.estado === "vigente" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/finanzas/activos?editar=${a.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                          Editar<span className="sr-only"> {a.nombre}</span>
                        </Link>
                        <ConfirmarAccion
                          action={bajaActivoAction}
                          etiqueta="Dar de baja"
                          titulo="¿Dar de baja el activo?"
                          mensaje={`«${a.nombre}» dejará de contar como activo vigente. Se conserva en el historial con su motivo.`}
                          etiquetaConfirmar="Sí, dar de baja"
                          campos={{ id: a.id }}
                          entrada={{ nombre: "motivo", etiqueta: "Motivo de la baja", minimo: 3, maximo: 300 }}
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}

      <section aria-labelledby="activo-form-titulo" className="space-y-3 rounded-xl border bg-white p-5">
        <h2 id="activo-form-titulo" className="font-bold">{editar ? `Editar «${editar.nombre}»` : "Nuevo activo fijo"}</h2>
        <FormularioAccion
          key={editar?.id ?? "nuevo"}
          action={guardarActivoAction}
          ocultos={editar ? { id: editar.id } : undefined}
          cancelarHref={editar ? "/finanzas/activos" : undefined}
          enviar={editar ? "Guardar cambios" : "Registrar activo"}
          campos={[
            { nombre: "codigo", etiqueta: "Código", requerido: true, placeholder: "Ej: AF-001", inicial: editar?.codigo },
            { nombre: "nombre", etiqueta: "Nombre", requerido: true, placeholder: "Ej: Bomba de agua", inicial: editar?.nombre },
            { nombre: "fechaAdquisicion", etiqueta: "Fecha de adquisición", tipo: "date", requerido: true, max: hoyEcuador(), inicial: editar?.fechaAdquisicion },
            { nombre: "valor", etiqueta: "Valor de adquisición (USD)", requerido: true, modo: "decimal", inicial: editar?.valor },
            { nombre: "ubicacion", etiqueta: "Ubicación", requerido: true, placeholder: "Ej: Bodega comunal", inicial: editar?.ubicacion },
          ]}
        />
      </section>
    </div>
  );
}
