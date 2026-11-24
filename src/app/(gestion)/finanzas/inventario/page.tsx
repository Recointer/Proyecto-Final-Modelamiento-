import Link from "next/link";
import { z } from "zod";
import { FormularioAccion } from "@/components/FormularioAccion";
import { MensajeError, MensajeExito } from "@/components/forms";
import { EstadoVacio, Insignia, TablaScroll } from "@/components/ui";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarMateriales, listarMovimientos } from "@/server/services/inventario-service";
import { crearMaterialAction, editarMaterialAction, registrarMovimientoAction } from "../actions";

export const metadata = { title: "Inventario" };

type Params = Record<string, string | string[] | undefined>;
const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const uuid = (v?: string) => (z.string().uuid().safeParse(v).success ? v : undefined);
const num = (n: string) => n.replace(".", ",");

export default async function InventarioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { ctx } = await contextoGestion(["tesorero"]);
  const materiales = await listarMateriales(ctx);
  const editar = materiales.find((m) => m.id === uuid(unico(sp.editar)));
  const verId = uuid(unico(sp.material));
  const seleccionado = materiales.find((m) => m.id === verId);
  const movimientos = seleccionado ? await listarMovimientos(ctx, seleccionado.id) : [];
  const activos = materiales.filter((m) => m.estado === "activo");

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-slate-600">
          {materiales.length === 1 ? "1 material" : `${materiales.length} materiales`}
          {materiales.some((m) => m.bajo) ? ` · ${materiales.filter((m) => m.bajo).length} con stock bajo` : ""}
        </p>
      </div>
      <MensajeExito mensaje={unico(sp.ok)} />
      <MensajeError mensaje={unico(sp.error)} />

      {materiales.length === 0 ? (
        <EstadoVacio titulo="Aún no hay materiales registrados" descripcion="Registre el primero con el formulario de abajo." />
      ) : (
        <TablaScroll etiqueta="Materiales del inventario">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Materiales del inventario</caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Material</th>
                <th scope="col" className="px-4 py-3 text-right">Stock</th>
                <th scope="col" className="px-4 py-3 text-right">Mínimo</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-semibold">{m.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{num(m.stock)} {m.unidad}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{num(m.minimo)} {m.unidad}</td>
                  <td className="px-4 py-3">
                    {m.estado === "inactivo" ? <Insignia tono="gris">Inactivo</Insignia> : m.bajo ? <Insignia tono="rojo">Stock bajo</Insignia> : <Insignia tono="verde">Normal</Insignia>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/finanzas/inventario?material=${m.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                        Movimientos<span className="sr-only"> de {m.nombre}</span>
                      </Link>
                      <Link href={`/finanzas/inventario?editar=${m.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                        Editar<span className="sr-only"> {m.nombre}</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}

      {seleccionado ? (
        <section aria-labelledby="mov-titulo" className="space-y-3">
          <h2 id="mov-titulo" className="font-bold">Últimos movimientos de {seleccionado.nombre}</h2>
          <TablaScroll etiqueta="Movimientos del material">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Movimientos de {seleccionado.nombre}</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3 text-right">Cantidad</th>
                  <th scope="col" className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movimientos.map((x) => (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap px-4 py-3">{x.creadoEn.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}</td>
                    <td className="px-4 py-3">{x.tipo === "entrada" ? "Entrada" : "Salida"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{x.tipo === "entrada" ? "+" : "−"}{num(x.cantidad)} {seleccionado.unidad}</td>
                    <td className="px-4 py-3">{x.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {activos.length > 0 ? (
          <section aria-labelledby="mov-form-titulo" className="space-y-3 rounded-xl border bg-white p-5">
            <h2 id="mov-form-titulo" className="font-bold">Registrar entrada o salida</h2>
            <FormularioAccion
              action={registrarMovimientoAction}
              enviar="Registrar movimiento"
              ancho="max-w-md"
              campos={[
                { nombre: "materialId", etiqueta: "Material", tipo: "select", requerido: true, opciones: activos.map((m) => ({ valor: m.id, etiqueta: `${m.nombre} (${num(m.stock)} ${m.unidad})` })), inicial: seleccionado?.id },
                { nombre: "tipo", etiqueta: "Tipo de movimiento", tipo: "select", requerido: true, opciones: [{ valor: "entrada", etiqueta: "Entrada (compra, donación)" }, { valor: "salida", etiqueta: "Salida (uso, consumo)" }] },
                { nombre: "cantidad", etiqueta: "Cantidad", requerido: true, modo: "decimal" },
                { nombre: "motivo", etiqueta: "Motivo", requerido: true, placeholder: "Ej: Reparación del canal norte" },
              ]}
            />
          </section>
        ) : null}

        <section aria-labelledby="mat-form-titulo" className="space-y-3 rounded-xl border bg-white p-5">
          <h2 id="mat-form-titulo" className="font-bold">{editar ? `Editar «${editar.nombre}»` : "Nuevo material"}</h2>
          {editar ? (
            <FormularioAccion
              key={editar.id}
              action={editarMaterialAction}
              enviar="Guardar cambios"
              ancho="max-w-md"
              ocultos={{ id: editar.id }}
              cancelarHref="/finanzas/inventario"
              campos={[
                { nombre: "nombre", etiqueta: "Nombre", requerido: true, inicial: editar.nombre },
                { nombre: "unidad", etiqueta: "Unidad", requerido: true, inicial: editar.unidad },
                { nombre: "minimo", etiqueta: "Stock mínimo", requerido: true, modo: "decimal", inicial: editar.minimo },
                { nombre: "estado", etiqueta: "Estado", tipo: "select", requerido: true, opciones: [{ valor: "activo", etiqueta: "Activo" }, { valor: "inactivo", etiqueta: "Inactivo" }], inicial: editar.estado },
              ]}
            />
          ) : (
            <FormularioAccion
              action={crearMaterialAction}
              enviar="Registrar material"
              ancho="max-w-md"
              campos={[
                { nombre: "nombre", etiqueta: "Nombre", requerido: true, placeholder: "Ej: Tubería PVC 2 pulgadas" },
                { nombre: "unidad", etiqueta: "Unidad", requerido: true, placeholder: "m, kg, unidad…" },
                { nombre: "stockInicial", etiqueta: "Stock inicial", requerido: true, modo: "decimal", inicial: "0" },
                { nombre: "minimo", etiqueta: "Stock mínimo", requerido: true, modo: "decimal", inicial: "0", ayuda: "Se avisa cuando el stock llega a este valor o menos." },
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
