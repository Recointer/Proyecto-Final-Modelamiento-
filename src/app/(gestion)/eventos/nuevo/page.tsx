import { contextoGestion } from "@/server/auth/page-guard";
import { EventoForm } from "../EventoForm";

export const metadata = { title: "Nuevo evento" };

export default async function NuevoEventoPage() {
  // solo el Secretario/a registra eventos: los demás roles son redirigidos
  await contextoGestion(["secretario"]);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Nuevo evento</h1>
      <p className="mb-6 text-slate-600">Registre una asamblea o una minga para poder tomar su asistencia.</p>
      <EventoForm modo="crear" />
    </div>
  );
}
