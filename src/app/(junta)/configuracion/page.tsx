import { contextoAdminJunta } from "@/server/auth/page-guard";
import { obtenerConfiguracion } from "@/server/services/configuracion-service";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { EstadoVacio } from "@/components/ui";
import { MensajeError, MensajeExito } from "@/components/forms";
import { ConfiguracionForm } from "./ConfiguracionForm";
import { NuevoSectorForm } from "./NuevoSectorForm";
import { editarSectorAction, eliminarSectorAction } from "./actions";

const num = (n: number) => String(n).replace(".", ",");

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await contextoAdminJunta();
  const c = await obtenerConfiguracion(ctx);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configuración de la junta</h1>
        <p className="text-sm text-slate-600">
          Identificador de acceso: <code>{c.junta.slug}</code> (lo define la plataforma)
        </p>
      </div>

      <section aria-labelledby="datos" className="rounded-xl border bg-white p-5">
        <h2 id="datos" className="mb-4 text-lg font-bold">Datos generales y parámetros</h2>
        <ConfiguracionForm
          inicial={{
            nombre: c.junta.nombre,
            tipo: c.junta.tipo,
            provincia: c.junta.provincia,
            canton: c.junta.canton,
            parroquia: c.junta.parroquia,
            contactoNombre: c.junta.contactoNombre ?? "",
            contactoTelefono: c.junta.contactoTelefono ?? "",
            contactoCorreo: c.junta.contactoCorreo ?? "",
            multaAsamblea: num(c.parametros.multaAsamblea),
            multaMinga: num(c.parametros.multaMinga),
            quorumPorcentaje: String(c.parametros.quorumPorcentaje),
          }}
        />
      </section>

      <section id="sectores" aria-labelledby="sectores-titulo" className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 id="sectores-titulo" className="text-lg font-bold">Sectores</h2>
          <p className="text-sm text-slate-600">
            Divisiones de la junta a las que se asignan socios y predios. No se puede eliminar un sector que tenga socios o predios asociados.
          </p>
        </div>

        <MensajeExito mensaje={sp.ok} />
        <MensajeError mensaje={sp.error} />

        <NuevoSectorForm />

        {c.sectores.length === 0 ? (
          <EstadoVacio titulo="Aún no hay sectores" descripcion="Agregue el primero con el formulario de arriba." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {c.sectores.map((s) => (
              <li key={s.id} className="flex flex-wrap items-end gap-3 p-3">
                <form action={editarSectorAction} className="flex flex-1 flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="min-w-40 flex-1">
                    <label htmlFor={`s-nombre-${s.id}`} className="mb-1 block text-xs font-semibold text-slate-700">
                      Nombre
                    </label>
                    <input
                      id={`s-nombre-${s.id}`}
                      name="nombre"
                      defaultValue={s.nombre}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="min-w-40 flex-1">
                    <label htmlFor={`s-desc-${s.id}`} className="mb-1 block text-xs font-semibold text-slate-700">
                      Descripción
                    </label>
                    <input
                      id={`s-desc-${s.id}`}
                      name="descripcion"
                      defaultValue={s.descripcion ?? ""}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                    aria-label={`Guardar sector ${s.nombre}`}
                  >
                    Guardar
                  </button>
                </form>
                <ConfirmarAccion
                  action={eliminarSectorAction}
                  etiqueta="Eliminar"
                  titulo={`¿Eliminar el sector «${s.nombre}»?`}
                  mensaje="Esta acción no se puede deshacer. Si tiene socios o predios asociados, no se eliminará."
                  etiquetaConfirmar="Sí, eliminar"
                  campos={{ id: s.id }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
