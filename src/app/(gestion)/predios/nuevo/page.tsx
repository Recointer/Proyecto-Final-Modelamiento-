import Link from "next/link";
import { contextoGestion } from "@/server/auth/page-guard";
import { listarSectores } from "@/server/services/configuracion-service";
import { listarSociosParaSelector } from "@/server/services/socio-service";
import { PredioForm } from "../PredioForm";

export const metadata = { title: "Nuevo predio" };

export default async function NuevoPredioPage() {
  // solo el Secretario/a registra predios: los demás roles son redirigidos
  const { ctx } = await contextoGestion(["secretario"]);
  const [sectores, socios] = await Promise.all([listarSectores(ctx), listarSociosParaSelector(ctx)]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Nuevo predio</h1>
      <p className="mb-6 text-slate-600">Registre un predio o recurso asignado a un socio.</p>
      {sectores.length === 0 || socios.length === 0 ? (
        <div role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {sectores.length === 0
            ? "Aún no hay sectores configurados: pida al Administrador de la Junta que los cree en «Configuración»."
            : "Aún no hay socios activos: registre primero al titular en la nómina."}
          <p className="mt-3">
            <Link href="/predios" className="text-teal-800 underline">Volver a los predios</Link>
          </p>
        </div>
      ) : (
        <PredioForm modo="crear" sectores={sectores} socios={socios} />
      )}
    </div>
  );
}
