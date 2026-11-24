import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, TablaScroll } from "@/components/ui";
import { formatoFecha } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { eventosParaVincular, listarConvocatorias, type FilaConvocatoria } from "@/server/services/convocatoria-service";
import { ETIQUETA_TIPO_CONVOCATORIA, TIPOS_CONVOCATORIA } from "@/server/validation/comunicaciones";
import { anularConvocatoriaAction, emitirConvocatoriaAction } from "../comunicaciones/actions";

export const metadata = { title: "Convocatorias" };

function Tarjeta({ c, puedeAnular }: { c: FilaConvocatoria; puedeAnular: boolean }) {
  const anulada = c.estado === "anulado";
  return (
    <li className={`space-y-2 rounded-xl border bg-white p-5 ${anulada ? "text-slate-500" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{c.titulo}</h3>
        <Insignia tono={c.tipo === "asamblea" ? "verde" : "ambar"}>{ETIQUETA_TIPO_CONVOCATORIA[c.tipo]}</Insignia>
        {anulada ? <Insignia tono="gris">Anulada</Insignia> : c.pasada ? <Insignia tono="gris">Realizada</Insignia> : null}
      </div>
      <p className="text-sm">
        {formatoFecha(c.fecha)} a las {c.hora} · {c.lugar}
      </p>
      {c.eventoTitulo ? <p className="text-xs text-slate-500">Evento: {c.eventoTitulo}</p> : null}
      {c.ordenDia ? (
        <div className="text-sm">
          <p className="font-semibold">Orden del día</p>
          <p className="whitespace-pre-line">{c.ordenDia}</p>
        </div>
      ) : null}
      {anulada && c.motivoAnulacion ? <p className="text-xs">Motivo de la anulación: {c.motivoAnulacion}</p> : null}
      {puedeAnular && !anulada ? (
        <div className="flex items-center gap-3 pt-1">
          <ConfirmarAccion
            action={anularConvocatoriaAction}
            etiqueta="Anular"
            titulo="¿Anular la convocatoria?"
            mensaje={`«${c.titulo}» dejará de ser visible para los socios. Se conserva en el historial con su motivo.`}
            etiquetaConfirmar="Sí, anular"
            campos={{ id: c.id }}
            entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 3, maximo: 300 }}
          />
          {c.notificados > 0 ? <span className="text-xs text-slate-500">{c.notificados} avisos por correo</span> : null}
        </div>
      ) : null}
    </li>
  );
}

export default async function ConvocatoriasPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero", "socio"]);
  const puedeEmitir = user.rol === "secretario";
  const lista = await listarConvocatorias(ctx, { soloVisibles: user.rol === "socio" });
  const proximas = lista.filter((c) => c.estado === "vigente" && !c.pasada).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  const anteriores = lista.filter((c) => c.estado === "vigente" && c.pasada);
  const anuladas = lista.filter((c) => c.estado === "anulado");
  const eventos = puedeEmitir ? await eventosParaVincular(ctx) : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Convocatorias</h1>
        <p className="text-sm text-slate-600">Convocatorias a asambleas generales y mingas de la junta.</p>
      </div>
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      {puedeEmitir ? (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">Emitir convocatoria</summary>
          <div className="mt-4">
            <FormularioAccion
              action={emitirConvocatoriaAction}
              enviar="Emitir convocatoria"
              campos={[
                { nombre: "tipo", etiqueta: "Tipo", tipo: "select", requerido: true, opciones: TIPOS_CONVOCATORIA.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_CONVOCATORIA[t] })) },
                { nombre: "titulo", etiqueta: "Título", requerido: true, placeholder: "Ej: Asamblea general ordinaria" },
                { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true },
                { nombre: "hora", etiqueta: "Hora", tipo: "time", requerido: true },
                { nombre: "lugar", etiqueta: "Lugar", requerido: true, placeholder: "Ej: Casa comunal" },
                { nombre: "ordenDia", etiqueta: "Orden del día", tipo: "textarea", ayuda: "Opcional. Un punto por línea." },
                {
                  nombre: "eventoId",
                  etiqueta: "Evento vinculado",
                  tipo: "select",
                  vacio: "Ninguno",
                  opciones: eventos.map((e) => ({ valor: e.id, etiqueta: `${e.titulo} (${formatoFecha(e.fecha)})` })),
                  ayuda: "Opcional. Une la convocatoria a un evento ya registrado.",
                },
                { nombre: "avisar", tipo: "checkbox", etiqueta: "Avisar por correo a los socios", ayuda: "Se envía a los socios activos que tengan correo registrado." },
              ]}
            />
          </div>
        </details>
      ) : null}

      <section aria-labelledby="proximas-titulo" className="space-y-3">
        <h2 id="proximas-titulo" className="font-bold">Próximas</h2>
        {proximas.length === 0 ? <EstadoVacio titulo="No hay convocatorias próximas" /> : <ul className="space-y-3">{proximas.map((c) => <Tarjeta key={c.id} c={c} puedeAnular={puedeEmitir} />)}</ul>}
      </section>

      {anteriores.length > 0 ? (
        <section aria-labelledby="anteriores-titulo" className="space-y-3">
          <h2 id="anteriores-titulo" className="font-bold">Anteriores</h2>
          <TablaScroll etiqueta="Convocatorias anteriores">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Convocatorias anteriores</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Convocatoria</th>
                  <th scope="col" className="px-4 py-3">Lugar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {anteriores.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(c.fecha)} {c.hora}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.titulo}</p>
                      <p className="text-xs text-slate-500">{ETIQUETA_TIPO_CONVOCATORIA[c.tipo]}</p>
                    </td>
                    <td className="px-4 py-3">{c.lugar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </section>
      ) : null}

      {anuladas.length > 0 ? (
        <section aria-labelledby="anuladas-titulo" className="space-y-3">
          <h2 id="anuladas-titulo" className="font-bold">Anuladas</h2>
          <ul className="space-y-3">{anuladas.map((c) => <Tarjeta key={c.id} c={c} puedeAnular={false} />)}</ul>
        </section>
      ) : null}
    </div>
  );
}
