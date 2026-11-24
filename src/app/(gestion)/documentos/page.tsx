import Link from "next/link";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, Paginacion, TablaScroll } from "@/components/ui";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarDocumentos } from "@/server/services/documento-service";
import { ETIQUETA_TIPO_DOCUMENTO, TIPOS_DOCUMENTO } from "@/server/validation/comunicaciones";
import { anularDocumentoAction, archivarDocumentoAction, publicarDocumentoAction } from "../comunicaciones/actions";

export const metadata = { title: "Actas y resoluciones" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero", "socio"]);
  const puedeEditar = user.rol === "secretario";
  const tipo = TIPOS_DOCUMENTO.find((t) => t === unico(sp.tipo));
  const anio = /^\d{4}$/.test(unico(sp.anio) ?? "") ? Number(unico(sp.anio)) : undefined;
  const busqueda = unico(sp.busqueda);
  const lista = await listarDocumentos(ctx, { tipo, anio, busqueda, pagina: Number(unico(sp.pagina)) || 1, soloVisibles: user.rol === "socio" });
  const hayFiltros = Boolean(tipo || anio || busqueda);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Actas y resoluciones</h1>
        <p className="text-sm text-slate-600">
          {lista.total === 1 ? "1 documento" : `${lista.total} documentos`}
          {user.rol === "socio" ? " publicados por la directiva" : ""}
        </p>
      </div>
      <MensajeExito mensaje={unico(sp.ok)} />
      <MensajeError mensaje={unico(sp.error)} />

      {puedeEditar ? (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">Archivar documento</summary>
          <div className="mt-4">
            <FormularioAccion
              action={archivarDocumentoAction}
              enviar="Archivar documento"
              campos={[
                { nombre: "tipo", etiqueta: "Tipo de documento", tipo: "select", requerido: true, opciones: TIPOS_DOCUMENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_DOCUMENTO[t] })) },
                { nombre: "titulo", etiqueta: "Título", requerido: true, placeholder: "Ej: Acta de la asamblea de marzo" },
                { nombre: "fecha", etiqueta: "Fecha del documento", tipo: "date", requerido: true, inicial: hoyEcuador() },
                { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea", ayuda: "Opcional." },
                { nombre: "archivo", etiqueta: "Archivo", tipo: "file", requerido: true, accept: "application/pdf,image/png,image/jpeg", ayuda: "PDF, PNG o JPEG de hasta 5 MB." },
                { nombre: "publicar", tipo: "checkbox", etiqueta: "Publicar para los socios", ayuda: "Puede publicarlo o retirarlo más tarde." },
              ]}
            />
          </div>
        </details>
      ) : null}

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Título o descripción</label>
          <input id="f-busqueda" name="busqueda" defaultValue={busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-tipo" className="mb-1 block text-xs font-semibold text-slate-700">Tipo</label>
          <select id="f-tipo" name="tipo" defaultValue={tipo ?? ""} className={campo}>
            <option value="">Todos</option>
            {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_DOCUMENTO[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-anio" className="mb-1 block text-xs font-semibold text-slate-700">Año</label>
          <input id="f-anio" name="anio" type="number" inputMode="numeric" min={2000} max={2100} defaultValue={anio} className={campo} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Buscar</button>
          {hayFiltros ? <Link href="/documentos" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
        </div>
      </form>

      {lista.items.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "Ningún documento coincide con la búsqueda" : user.rol === "socio" ? "Aún no hay documentos publicados" : "Aún no hay documentos archivados"}
        />
      ) : (
        <TablaScroll etiqueta="Actas y resoluciones">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Actas y resoluciones de la junta</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">Documento</th>
                {user.rol !== "socio" ? <th scope="col" className="px-4 py-3">Estado</th> : null}
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.items.map((d) => (
                <tr key={d.id} className={d.estado === "anulado" ? "text-slate-500" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3">{formatoFecha(d.fecha)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{d.titulo}</p>
                    <p className="text-xs text-slate-500">{ETIQUETA_TIPO_DOCUMENTO[d.tipo]}{d.descripcion ? ` · ${d.descripcion}` : ""}</p>
                    {d.estado === "anulado" && d.motivoAnulacion ? <p className="mt-1 text-xs">Anulado: {d.motivoAnulacion}</p> : null}
                  </td>
                  {user.rol !== "socio" ? (
                    <td className="px-4 py-3">
                      {d.estado === "anulado" ? <Insignia tono="gris">Anulado</Insignia> : d.publicado ? <Insignia tono="verde">Publicado</Insignia> : <Insignia tono="ambar">Sin publicar</Insignia>}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {d.estado === "vigente" ? (
                        <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener" className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                          Descargar<span className="sr-only"> {d.titulo}</span>
                        </a>
                      ) : null}
                      {puedeEditar && d.estado === "vigente" ? (
                        <>
                          <ConfirmarAccion
                            action={publicarDocumentoAction}
                            etiqueta={d.publicado ? "Retirar" : "Publicar"}
                            titulo={d.publicado ? "¿Retirar de la publicación?" : "¿Publicar el documento?"}
                            mensaje={d.publicado ? `Los socios dejarán de ver «${d.titulo}». Se conserva archivado.` : `Todos los socios podrán ver y descargar «${d.titulo}».`}
                            etiquetaConfirmar={d.publicado ? "Sí, retirar" : "Sí, publicar"}
                            campos={{ id: d.id, publicar: d.publicado ? "0" : "1" }}
                            peligro={false}
                          />
                          <ConfirmarAccion
                            action={anularDocumentoAction}
                            etiqueta="Anular"
                            titulo="¿Anular el documento?"
                            mensaje={`«${d.titulo}» dejará de ser visible para los socios. Se conserva en el historial con su motivo.`}
                            etiquetaConfirmar="Sí, anular"
                            campos={{ id: d.id }}
                            entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 3, maximo: 300 }}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}
      <Paginacion ruta="/documentos" pagina={lista.pagina} paginas={lista.paginas} params={{ busqueda, tipo, anio: anio ? String(anio) : undefined }} />
    </div>
  );
}
