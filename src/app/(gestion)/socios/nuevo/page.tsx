import Link from "next/link";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarSectores } from "@/server/services/configuracion-service";
import { hoyEcuador } from "@/lib/fechas";
import { SocioForm } from "../SocioForm";

export const metadata = { title: "Nuevo socio" };

export default async function NuevoSocioPage() {
  // solo el Secretario/a registra socios: los demás roles son redirigidos
  const { ctx } = await contextoGestion(["secretario"]);
  const sectores = await listarSectores(ctx);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Nuevo socio</h1>
      <p className="mb-6 text-slate-600">Registre a un miembro en la nómina de la junta.</p>
      {sectores.length === 0 ? (
        <div role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Aún no hay sectores configurados. Pida al Administrador de la Junta que los cree en «Configuración» antes de
          registrar socios.
          <p className="mt-3">
            <Link href="/socios" className="text-teal-800 underline">Volver a la nómina</Link>
          </p>
        </div>
      ) : (
        <SocioForm modo="crear" sectores={sectores} hoy={hoyEcuador()} />
      )}
    </div>
  );
}
