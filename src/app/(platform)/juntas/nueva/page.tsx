import { crearJuntaAction } from "../actions";
import { JuntaForm } from "../JuntaForm";

export const metadata = { title: "Nueva junta" };

export default function NuevaJuntaPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Agregar nueva junta</h1>
      <p className="mb-6 text-slate-600">Registre una organización comunitaria en la plataforma.</p>
      <JuntaForm accion={crearJuntaAction} inicial={{}} />
    </div>
  );
}
