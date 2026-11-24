import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarSectores } from "@/server/services/configuracion-service";
import { obtenerPredio } from "@/server/services/predio-service";
import { listarSociosParaSelector } from "@/server/services/socio-service";
import { socioDeSesion } from "@/server/services/socio-sesion";
import { fueraDeEcuador } from "@/server/validation/predio";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { MapaPredios } from "@/components/MapaPredios";
import { MensajeError, MensajeExito } from "@/components/forms";
import { Insignia } from "@/components/ui";
import { PredioForm } from "../PredioForm";
import { desactivarPredioAction, reactivarPredioAction } from "../actions";

export const metadata = { title: "Ficha del predio" };

const num = (n: number) => String(n).replace(".", ",");

export default async function PredioDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; creado?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero", "socio"]);
  let acotado: string | undefined;
  if (user.rol === "socio") {
    const socio = await socioDeSesion(ctx, user);
    if (!socio) notFound();
    acotado = socio.id;
  }
  const p = await obtenerPredio(ctx, id, acotado);
  if (!p) notFound();

  const puedeEditar = user.rol === "secretario";
  const activo = p.estado === "activo";
  const conCoordenadas = p.latitud !== null && p.longitud !== null;
  const lejos = conCoordenadas && fueraDeEcuador(p.latitud as number, p.longitud as number);
  const [sectores, socios] = puedeEditar
    ? await Promise.all([listarSectores(ctx), listarSociosParaSelector(ctx)])
    : [[], []];
  // el titular actual puede estar de baja y no figurar entre los activos: se añade para no perderlo
  const sociosConTitular = socios.some((s) => s.id === p.socioId)
    ? socios
    : [{ id: p.socioId, nombres: p.titularNombres, cedula: p.titularCedula }, ...socios];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/predios" className="text-sm text-teal-800 underline">← Volver a los predios</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{p.codigo} · {p.nombre}</h1>
          <Insignia tono={activo ? "verde" : "gris"}>{activo ? "Activo" : "Inactivo"}</Insignia>
        </div>
      </div>

      {sp.creado ? <MensajeExito mensaje="Predio registrado correctamente." /> : null}
      {sp.guardado ? <MensajeExito mensaje="Cambios guardados." /> : null}
      <MensajeExito mensaje={sp.ok} />
      <MensajeError mensaje={sp.error} />
      {lejos ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Las coordenadas están fuera de Ecuador. Verifique que la latitud y la longitud sean correctas.
        </p>
      ) : null}

      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 rounded-xl border bg-white p-5 text-sm">
        <dt className="text-slate-600">Titular</dt>
        <dd>{p.titularNombres} <span className="text-slate-500">({p.titularCedula})</span></dd>
        <dt className="text-slate-600">Sector</dt>
        <dd>{p.sectorNombre}</dd>
        <dt className="text-slate-600">Superficie</dt>
        <dd>{num(p.superficieHa)} ha</dd>
        <dt className="text-slate-600">Coordenadas</dt>
        <dd>{conCoordenadas ? `${num(p.latitud as number)}, ${num(p.longitud as number)}` : "Sin localización registrada"}</dd>
      </dl>

      {p.tieneImagen ? (
        <figure className="space-y-1">
          {/* imagen servida por una ruta autenticada: next/image no aplica */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/predios/${p.id}/imagen`} alt={`Imagen del predio ${p.codigo} ${p.nombre}`} className="max-h-72 rounded-xl border" />
          <figcaption className="text-xs text-slate-600">Imagen del predio</figcaption>
        </figure>
      ) : null}

      {conCoordenadas ? (
        <MapaPredios
          altura="h-64"
          puntos={[
            {
              id: p.id,
              codigo: p.codigo,
              nombre: p.nombre,
              lat: p.latitud as number,
              lng: p.longitud as number,
              sectorNombre: p.sectorNombre,
              superficieHa: p.superficieHa,
            },
          ]}
        />
      ) : null}

      {puedeEditar ? (
        <>
          <section aria-labelledby="editar-titulo" className="rounded-xl border bg-white p-5">
            <h2 id="editar-titulo" className="mb-3 font-bold">Editar predio</h2>
            <PredioForm
              modo="editar"
              id={p.id}
              sectores={sectores}
              socios={sociosConTitular}
              tieneImagen={p.tieneImagen}
              nombrePredio={p.nombre}
              inicial={{
                codigo: p.codigo,
                nombre: p.nombre,
                superficieHa: num(p.superficieHa),
                sectorId: p.sectorId,
                socioId: p.socioId,
                latitud: p.latitud === null ? "" : String(p.latitud),
                longitud: p.longitud === null ? "" : String(p.longitud),
              }}
            />
          </section>

          <section aria-labelledby="estado-titulo" className="rounded-xl border bg-white p-5">
            <h2 id="estado-titulo" className="font-bold">Estado del predio</h2>
            {activo ? (
              <>
                <p className="my-2 text-sm text-slate-600">Al darlo de baja deja de aparecer en el mapa, pero se conserva su registro.</p>
                <ConfirmarAccion
                  action={desactivarPredioAction}
                  etiqueta="Dar de baja"
                  titulo={`¿Dar de baja el predio ${p.codigo}?`}
                  mensaje="Podrá reactivarlo cuando quiera. No se elimina ningún dato."
                  etiquetaConfirmar="Sí, dar de baja"
                  campos={{ id: p.id }}
                />
              </>
            ) : (
              <form action={reactivarPredioAction} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Reactivar predio
                </button>
              </form>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
