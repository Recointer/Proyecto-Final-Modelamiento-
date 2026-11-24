import Link from "next/link";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, Paginacion } from "@/components/ui";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarComunicaciones } from "@/server/services/comunicacion-service";
import { anularComunicacionAction, publicarComunicacionAction, registrarComunicacionAction } from "./actions";

export const metadata = { title: "Comunicaciones recibidas" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ComunicacionesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero", "socio"]);
  const esSocio = user.rol === "socio";
  const puedeEditar = user.rol === "secretario";
  const anio = /^\d{4}$/.test(unico(sp.anio) ?? "") ? Number(unico(sp.anio)) : undefined;
  const busqueda = unico(sp.busqueda);
  const lista = await listarComunicaciones(ctx, { anio, busqueda, pagina: Number(unico(sp.pagina)) || 1, soloVisibles: esSocio });
  const hayFiltros = Boolean(anio || busqueda);
  const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  const titulo = esSocio ? "Comunicados" : "Comunicaciones recibidas";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-sm text-slate-600">
          {esSocio ? "Comunicados de otras instituciones que la directiva publicó para los socios." : "Oficios y comunicaciones que la junta recibe de otras instituciones."}
        </p>
      </div>
      <MensajeExito mensaje={unico(sp.ok)} />
      <MensajeError mensaje={unico(sp.error)} />

      {puedeEditar ? (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">Registrar comunicación</summary>
          <div className="mt-4">
            <FormularioAccion
              action={registrarComunicacionAction}
              enviar="Registrar comunicación"
              campos={[
                { nombre: "institucion", etiqueta: "Institución", requerido: true, placeholder: "Ej: GAD Parroquial, Ministerio del Ambiente" },
                { nombre: "asunto", etiqueta: "Asunto", requerido: true },
                { nombre: "referencia", etiqueta: "N.º de oficio o referencia", ayuda: "Opcional." },
                { nombre: "fechaRecepcion", etiqueta: "Fecha de recepción", tipo: "date", requerido: true, inicial: hoyEcuador(), max: hoyEcuador() },
                { nombre: "resumen", etiqueta: "Resumen", tipo: "textarea", requerido: true },
                { nombre: "adjunto", etiqueta: "Documento adjunto", tipo: "file", accept: "application/pdf,image/png,image/jpeg", ayuda: "Opcional. PDF, PNG o JPEG de hasta 5 MB." },
                { nombre: "publicar", tipo: "checkbox", etiqueta: "Publicar como comunicado para los socios" },
              ]}
            />
          </div>
        </details>
      ) : null}

      <form method="get" role="search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="f-busqueda" className="mb-1 block text-xs font-semibold text-slate-700">Institución, asunto o referencia</label>
          <input id="f-busqueda" name="busqueda" defaultValue={busqueda} className={campo} />
        </div>
        <div>
          <label htmlFor="f-anio" className="mb-1 block text-xs font-semibold text-slate-700">Año</label>
          <input id="f-anio" name="anio" type="number" inputMode="numeric" min={2000} max={2100} defaultValue={anio} className={campo} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Buscar</button>
          {hayFiltros ? <Link href="/comunicaciones" className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">Limpiar</Link> : null}
        </div>
      </form>

      {lista.items.length === 0 ? (
        <EstadoVacio titulo={hayFiltros ? "Nada coincide con la búsqueda" : esSocio ? "Aún no hay comunicados publicados" : "Aún no hay comunicaciones registradas"} />
      ) : (
        <ul className="space-y-3">
          {lista.items.map((c) => (
            <li key={c.id} className={`space-y-2 rounded-xl border bg-white p-5 ${c.estado === "anulado" ? "text-slate-500" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{c.asunto}</h2>
                {!esSocio ? (c.estado === "anulado" ? <Insignia tono="gris">Anulada</Insignia> : c.publicada ? <Insignia tono="verde">Publicada</Insignia> : <Insignia tono="ambar">Interna</Insignia>) : null}
              </div>
              <p className="text-sm text-slate-600">
                {c.institucion} · Recibida el {formatoFecha(c.fechaRecepcion)}
                {c.referencia ? ` · Ref. ${c.referencia}` : ""}
              </p>
              <p className="whitespace-pre-line text-sm">{c.resumen}</p>
              {c.estado === "anulado" && c.motivoAnulacion ? <p className="text-xs">Anulada: {c.motivoAnulacion}</p> : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {c.tieneAdjunto && c.estado === "vigente" ? (
                  <a href={`/api/comunicaciones/${c.id}/adjunto`} target="_blank" rel="noopener" className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                    Ver adjunto<span className="sr-only"> de {c.asunto}</span>
                  </a>
                ) : null}
                {puedeEditar && c.estado === "vigente" ? (
                  <>
                    <ConfirmarAccion
                      action={publicarComunicacionAction}
                      etiqueta={c.publicada ? "Retirar comunicado" : "Publicar como comunicado"}
                      titulo={c.publicada ? "¿Retirar el comunicado?" : "¿Publicar como comunicado?"}
                      mensaje={c.publicada ? "Los socios dejarán de verla. Se conserva en el registro." : "Los socios podrán ver el resumen y el adjunto."}
                      etiquetaConfirmar={c.publicada ? "Sí, retirar" : "Sí, publicar"}
                      campos={{ id: c.id, publicar: c.publicada ? "0" : "1" }}
                      peligro={false}
                    />
                    <ConfirmarAccion
                      action={anularComunicacionAction}
                      etiqueta="Anular"
                      titulo="¿Anular la comunicación?"
                      mensaje={`«${c.asunto}» dejará de figurar como vigente y de ser visible para los socios.`}
                      etiquetaConfirmar="Sí, anular"
                      campos={{ id: c.id }}
                      entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 3, maximo: 300 }}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Paginacion ruta="/comunicaciones" pagina={lista.pagina} paginas={lista.paginas} params={{ busqueda, anio: anio ? String(anio) : undefined }} />
    </div>
  );
}
