import Link from "next/link";
import { z } from "zod";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, TablaScroll } from "@/components/ui";
import { AppError } from "@/lib/result";
import { contextoGestion } from "@/server/auth/page-guard";
import { abrirHilo, listarHilos, sociosConCuenta, totalNoLeidos } from "@/server/services/mensajeria-service";
import { iniciarHiloAction, responderHiloAction } from "../comunicaciones/actions";

export const metadata = { title: "Mensajes" };

const fechaHora = (d: Date) =>
  d.toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function MensajesPage({ searchParams }: { searchParams: Promise<{ hilo?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["admin_junta", "socio"]);
  const rol = user.rol === "admin_junta" ? "admin_junta" : "socio";
  const hiloId = z.string().uuid().safeParse(sp.hilo).success ? sp.hilo : undefined;

  // abrir una conversación ajena o inexistente muestra la bandeja con un aviso, sin revelar si existe
  let abierto = null;
  let errorApertura: string | undefined;
  if (hiloId) {
    try {
      abierto = await abrirHilo(ctx, rol, hiloId);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      errorApertura = e.message;
    }
  }
  const [hilos, noLeidos, socios] = await Promise.all([listarHilos(ctx, rol), totalNoLeidos(ctx, rol), rol === "admin_junta" ? sociosConCuenta(ctx) : Promise.resolve([])]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mensajes</h1>
        <p className="text-sm text-slate-600" data-testid="resumen-mensajes">
          {rol === "socio" ? "Escriba al Administrador de la Junta." : "Conversaciones con los socios."}{" "}
          {noLeidos === 0 ? "No tiene mensajes sin leer." : noLeidos === 1 ? "Tiene 1 mensaje sin leer." : `Tiene ${noLeidos} mensajes sin leer.`}
        </p>
      </div>
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error ?? errorApertura} />

      {abierto ? (
        <section aria-labelledby="hilo-titulo" className="space-y-4 rounded-xl border bg-white p-5">
          <div>
            <Link href="/mensajes" className="text-sm text-teal-800 underline">← Volver a la bandeja</Link>
            <h2 id="hilo-titulo" className="mt-2 text-lg font-bold">{abierto.asunto}</h2>
            {rol === "admin_junta" ? <p className="text-sm text-slate-600">Con {abierto.socioNombres}</p> : null}
          </div>
          <ol className="space-y-3" aria-label="Mensajes de la conversación">
            {abierto.mensajes.map((m) => (
              <li key={m.id} className={`rounded-lg border p-3 ${m.deAdministracion ? "border-teal-200 bg-teal-50" : "bg-slate-50"}`}>
                <p className="text-xs text-slate-600">
                  <strong>{m.autorNombres}</strong> · {m.deAdministracion ? "Administración" : "Socio"} · {fechaHora(m.creadoEn)}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm">{m.texto}</p>
              </li>
            ))}
          </ol>
          <FormularioAccion
            key={`${abierto.id}-${abierto.mensajes.length}`}
            action={responderHiloAction}
            ocultos={{ hiloId: abierto.id }}
            enviar="Enviar respuesta"
            ancho="max-w-2xl"
            campos={[{ nombre: "texto", etiqueta: "Su respuesta", tipo: "textarea", requerido: true, ayuda: "Hasta 2.000 caracteres." }]}
          />
        </section>
      ) : (
        <>
          {hilos.length === 0 ? (
            <EstadoVacio titulo="Aún no hay conversaciones" descripcion={rol === "socio" ? "Escriba su primer mensaje con el formulario de abajo." : "Inicie una conversación con un socio con cuenta."} />
          ) : (
            <TablaScroll etiqueta="Conversaciones">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Conversaciones</caption>
                <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Asunto</th>
                    {rol === "admin_junta" ? <th scope="col" className="px-4 py-3">Socio</th> : null}
                    <th scope="col" className="px-4 py-3">Última actividad</th>
                    <th scope="col" className="px-4 py-3">Sin leer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {hilos.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-3">
                        <Link href={`/mensajes?hilo=${h.id}`} className={`text-teal-800 underline ${h.noLeidos > 0 ? "font-bold" : ""}`}>{h.asunto}</Link>
                      </td>
                      {rol === "admin_junta" ? <td className="px-4 py-3">{h.socioNombres}</td> : null}
                      <td className="whitespace-nowrap px-4 py-3">{fechaHora(h.ultimoMensajeEn)}</td>
                      <td className="px-4 py-3">{h.noLeidos > 0 ? <Insignia tono="rojo">{h.noLeidos} sin leer</Insignia> : <span className="text-slate-500">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          )}

          <section aria-labelledby="nuevo-titulo" className="space-y-3 rounded-xl border bg-white p-5">
            <h2 id="nuevo-titulo" className="font-bold">{rol === "socio" ? "Escribir al Administrador" : "Nueva conversación"}</h2>
            {rol === "admin_junta" && socios.length === 0 ? (
              <p role="status" className="text-sm text-amber-900">Aún no hay socios con cuenta activa. Cree sus cuentas en «Cuentas de usuario».</p>
            ) : (
              <FormularioAccion
                action={iniciarHiloAction}
                enviar="Enviar mensaje"
                campos={[
                  ...(rol === "admin_junta"
                    ? [{ nombre: "usuarioId", etiqueta: "Socio", tipo: "select" as const, requerido: true, opciones: socios.map((s) => ({ valor: s.id, etiqueta: `${s.nombres} (${s.cedula})` })) }]
                    : []),
                  { nombre: "asunto", etiqueta: "Asunto", requerido: true },
                  { nombre: "texto", etiqueta: "Mensaje", tipo: "textarea", requerido: true, ayuda: "Hasta 2.000 caracteres." },
                ]}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
