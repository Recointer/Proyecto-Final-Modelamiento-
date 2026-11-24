import { contextoGestion } from "@/server/auth/page-guard";
import { ServicioForm } from "../ServicioForm";

export const metadata = { title: "Nuevo servicio" };

export default async function NuevoServicioPage() {
  await contextoGestion(["secretario"]);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Nuevo servicio</h1>
      <p className="mb-6 text-slate-600">Registre un servicio de la junta; luego le definirá turnos por sector.</p>
      <ServicioForm modo="crear" />
    </div>
  );
}
