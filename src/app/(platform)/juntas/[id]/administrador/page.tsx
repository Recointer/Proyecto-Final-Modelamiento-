import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { contextoSuperAdmin } from "@/server/auth/page-guard";
import { obtenerJunta } from "@/server/services/junta-service";
import { obtenerAdministradorActual } from "@/server/services/administrador-service";
import { asignarAdministradorAction, cambiarAdministradorAction } from "./actions";
import { AdministradorForm } from "./AdministradorForm";
import { Insignia } from "@/components/ui";

export default async function AdministradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const ctx = await contextoSuperAdmin();
  const j = await obtenerJunta(ctx, id);
  if (!j) notFound();
  const actual = await obtenerAdministradorActual(ctx, id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/juntas/${id}`} className="text-sm text-teal-800 underline">← Volver a la junta</Link>
        <h1 className="mt-2 text-2xl font-bold">Gestión de administrador</h1>
        <p className="text-slate-600">{j.nombre}</p>
      </div>

      <section aria-labelledby="actual" className="rounded-xl border bg-white p-5">
        <h2 id="actual" className="mb-2 font-bold">Administrador actual</h2>
        {actual ? (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-600">Nombres</dt>
            <dd>{actual.nombres} <Insignia tono="verde">Vigente</Insignia></dd>
            <dt className="text-slate-600">Cédula</dt>
            <dd>{actual.cedula}</dd>
            <dt className="text-slate-600">Correo</dt>
            <dd>{actual.correo ?? "—"}</dd>
            {actual.desde ? (
              <>
                <dt className="text-slate-600">Desde</dt>
                <dd>{actual.desde.toLocaleDateString("es-EC")}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-slate-600">Esta junta aún no tiene administrador.</p>
        )}
      </section>

      <section aria-labelledby="accion" className="rounded-xl border bg-white p-5">
        <h2 id="accion" className="mb-1 font-bold">
          {actual ? "Cambiar administrador de junta" : "Asignar administrador de junta"}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          {actual
            ? "El administrador actual pasará a ser socio y perderá sus sesiones activas. Indique el motivo y adjunte el acta que respalda el cambio."
            : "Valide la cédula y adjunte el acta que respalda la designación. La persona recibirá una contraseña inicial por correo."}
        </p>
        <AdministradorForm
          juntaId={id}
          modo={actual ? "cambiar" : "asignar"}
          accion={actual ? cambiarAdministradorAction : asignarAdministradorAction}
        />
      </section>
    </div>
  );
}
