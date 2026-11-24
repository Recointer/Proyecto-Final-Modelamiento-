import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { InsigniaCargo, Insignia, TablaScroll } from "@/components/ui";
import { formatoUsd } from "@/lib/dinero";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { contextoGestion } from "@/server/auth/page-guard";
import { obtenerCargo } from "@/server/services/cargo-service";
import { ETIQUETA_FORMA_PAGO, FORMAS_PAGO } from "@/server/validation/finanzas";
import { anularCargoAction, anularPagoAction, registrarPagoAction } from "../../actions";

export const metadata = { title: "Cargo y pagos" };

export default async function CargoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { ctx } = await contextoGestion(["tesorero"]);
  const c = await obtenerCargo(ctx, id);
  if (!c) notFound();
  const puedeCobrar = c.estado === "pendiente" || c.estado === "parcial";
  const hayPagosVigentes = c.pagos.some((p) => !p.anulado);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/finanzas/cobros" className="text-sm text-teal-800 underline">← Volver a las cuentas por cobrar</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{c.concepto} · {c.anio}</h1>
          <InsigniaCargo estado={c.estado} vencido={c.vencido} />
        </div>
        <p className="text-sm text-slate-600">{c.socioNombres} · C.I. {c.socioCedula} · {c.sectorNombre}</p>
      </div>
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />

      <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-white p-5 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-600">Monto del cargo</dt><dd className="text-lg font-bold">{formatoUsd(c.monto)}</dd></div>
        <div><dt className="text-slate-600">Pagado</dt><dd className="text-lg font-bold">{formatoUsd(c.pagado)}</dd></div>
        <div><dt className="text-slate-600">Saldo</dt><dd className="text-lg font-bold">{formatoUsd(c.saldo)}</dd></div>
        <div><dt className="text-slate-600">Vence</dt><dd className="text-lg font-bold">{c.vence ? formatoFecha(c.vence) : "Sin fecha"}</dd></div>
      </dl>
      {c.estado === "anulado" ? (
        <p role="status" className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm">Cargo anulado. Motivo: {c.motivoAnulacion}</p>
      ) : null}

      <section aria-labelledby="pagos-titulo" className="space-y-3">
        <h2 id="pagos-titulo" className="font-bold">Pagos registrados</h2>
        {c.pagos.length === 0 ? (
          <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Este cargo aún no tiene pagos.</p>
        ) : (
          <TablaScroll etiqueta="Pagos del cargo">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Pagos del cargo</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">N.º</th>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Forma</th>
                  <th scope="col" className="px-4 py-3 text-right">Monto</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {c.pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-semibold">{String(p.numero).padStart(6, "0")}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatoFecha(p.fecha)}</td>
                    <td className="px-4 py-3">
                      {ETIQUETA_FORMA_PAGO[p.forma as keyof typeof ETIQUETA_FORMA_PAGO]}
                      {p.referencia ? <span className="text-xs text-slate-500"> · {p.referencia}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatoUsd(p.monto)}</td>
                    <td className="px-4 py-3">
                      {p.anulado ? <Insignia tono="gris">Anulado</Insignia> : <Insignia tono="verde">Vigente</Insignia>}
                      {p.anulado && p.motivoAnulacion ? <p className="mt-1 text-xs text-slate-500">{p.motivoAnulacion}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <a href={`/api/comprobantes/${p.id}`} download className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                          Comprobante<span className="sr-only"> N.º {p.numero}</span>
                        </a>
                        {!p.anulado ? (
                          <ConfirmarAccion
                            action={anularPagoAction}
                            etiqueta="Anular"
                            titulo="¿Anular el pago?"
                            mensaje={`Se anulará el pago N.º ${String(p.numero).padStart(6, "0")} de ${formatoUsd(p.monto)} y el saldo del cargo se restituirá. El comprobante conserva su número.`}
                            etiquetaConfirmar="Sí, anular"
                            campos={{ id: p.id, cargoId: id }}
                            entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 3, maximo: 300 }}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )}
      </section>

      {puedeCobrar ? (
        <section aria-labelledby="pagar-titulo" className="space-y-3 rounded-xl border bg-white p-5">
          <h2 id="pagar-titulo" className="font-bold">Registrar pago</h2>
          <FormularioAccion
            action={registrarPagoAction}
            enviar="Registrar pago"
            ocultos={{ cargoId: id }}
            campos={[
              { nombre: "monto", etiqueta: "Monto (USD)", requerido: true, modo: "decimal", inicial: c.saldo, ayuda: `Saldo pendiente: ${formatoUsd(c.saldo)}` },
              { nombre: "fecha", etiqueta: "Fecha del pago", tipo: "date", requerido: true, inicial: hoyEcuador(), max: hoyEcuador() },
              {
                nombre: "forma",
                etiqueta: "Forma de pago",
                tipo: "select",
                requerido: true,
                opciones: FORMAS_PAGO.map((f) => ({ valor: f, etiqueta: ETIQUETA_FORMA_PAGO[f] })),
                inicial: "efectivo",
              },
              { nombre: "referencia", etiqueta: "Referencia (opcional)", placeholder: "N.º de transferencia o depósito" },
            ]}
          />
        </section>
      ) : null}

      {c.estado !== "anulado" ? (
        <section className="border-t pt-4">
          <ConfirmarAccion
            action={anularCargoAction}
            etiqueta="Anular cargo"
            titulo="¿Anular el cargo?"
            mensaje={
              hayPagosVigentes
                ? "El cargo tiene pagos vigentes: anúlelos primero para poder anular el cargo."
                : "El cargo dejará de contar como cuenta por cobrar. Se conserva en el historial con su motivo."
            }
            etiquetaConfirmar="Sí, anular cargo"
            campos={{ id }}
            entrada={{ nombre: "motivo", etiqueta: "Motivo de la anulación", minimo: 3, maximo: 300 }}
          />
        </section>
      ) : null}
    </div>
  );
}
