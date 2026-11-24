import Link from "next/link";
import { z } from "zod";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarConceptos } from "@/server/services/concepto-service";
import { ETIQUETA_TIPO_CONCEPTO } from "@/server/validation/finanzas";
import { cambiarEstadoConceptoAction, guardarConceptoAction } from "../actions";

export const metadata = { title: "Conceptos de cobro" };

export default async function ConceptosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; editar?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await contextoGestion(["tesorero"]);
  const conceptos = await listarConceptos(ctx);
  const visibles = conceptos.filter((c) => c.tipo !== "multa");
  const multas = conceptos.filter((c) => c.tipo === "multa");
  const editar = z.string().uuid().safeParse(sp.editar).success ? visibles.find((c) => c.id === sp.editar) : undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conceptos de cobro</h1>
        <p className="text-sm text-slate-600">Cuotas y servicios que la junta cobra a sus socios. Luego emita los cargos desde «Cuentas por cobrar».</p>
      </div>
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      {visibles.length === 0 ? (
        <EstadoVacio titulo="Aún no hay conceptos de cobro" descripcion="Cree el primero, por ejemplo «Cuota anual de riego»." />
      ) : (
        <TablaScroll etiqueta="Conceptos de cobro">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Conceptos de cobro de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Concepto</th>
                <th scope="col" className="px-4 py-3">Tipo</th>
                <th scope="col" className="px-4 py-3">Monto por defecto</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibles.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.nombre}</td>
                  <td className="px-4 py-3">{ETIQUETA_TIPO_CONCEPTO[c.tipo]}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatoUsd(c.montoDefecto)}</td>
                  <td className="px-4 py-3"><Insignia tono={c.estado === "activo" ? "verde" : "gris"}>{c.estado === "activo" ? "Activo" : "Inactivo"}</Insignia></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/finanzas/conceptos?editar=${c.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                        Editar<span className="sr-only"> {c.nombre}</span>
                      </Link>
                      {c.estado === "activo" ? (
                        <ConfirmarAccion
                          action={cambiarEstadoConceptoAction}
                          etiqueta="Desactivar"
                          titulo="¿Desactivar el concepto?"
                          mensaje={`«${c.nombre}» no admitirá nuevas emisiones. Los cargos ya emitidos se conservan.`}
                          etiquetaConfirmar="Sí, desactivar"
                          campos={{ id: c.id, estado: "inactivo" }}
                        />
                      ) : (
                        <ConfirmarAccion
                          action={cambiarEstadoConceptoAction}
                          etiqueta="Reactivar"
                          titulo="¿Reactivar el concepto?"
                          mensaje={`«${c.nombre}» volverá a admitir emisiones.`}
                          etiquetaConfirmar="Sí, reactivar"
                          campos={{ id: c.id, estado: "activo" }}
                          peligro={false}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}

      <section aria-labelledby="form-titulo" className="space-y-3 rounded-xl border bg-white p-5">
        <h2 id="form-titulo" className="font-bold">{editar ? `Editar «${editar.nombre}»` : "Nuevo concepto"}</h2>
        <FormularioAccion
          key={editar?.id ?? "nuevo"}
          action={guardarConceptoAction}
          ocultos={editar ? { id: editar.id } : undefined}
          cancelarHref={editar ? "/finanzas/conceptos" : undefined}
          enviar={editar ? "Guardar cambios" : "Crear concepto"}
          campos={[
            { nombre: "nombre", etiqueta: "Nombre", requerido: true, placeholder: "Ej: Cuota anual de riego", inicial: editar?.nombre },
            {
              nombre: "tipo",
              etiqueta: "Tipo",
              tipo: "select",
              requerido: true,
              opciones: [
                { valor: "cuota", etiqueta: "Cuota" },
                { valor: "servicio", etiqueta: "Servicio" },
              ],
              inicial: editar?.tipo,
            },
            {
              nombre: "montoDefecto",
              etiqueta: "Monto por defecto (USD)",
              requerido: true,
              modo: "decimal",
              ayuda: "Puede cambiarlo al emitir los cargos. Use 0 si varía en cada emisión.",
              inicial: editar?.montoDefecto ?? "",
            },
          ]}
        />
      </section>

      {multas.length > 0 ? (
        <p className="text-sm text-slate-600">
          Los conceptos de multa por inasistencia los administra el sistema ({multas.map((m) => m.nombre).join("; ")}). El monto sale de la
          configuración de la junta.
        </p>
      ) : null}
    </div>
  );
}
