import { contextoAdminJunta } from "@/server/auth/page-guard";
import { UsuarioForm } from "../UsuarioForm";

export default async function NuevoUsuarioPage() {
  await contextoAdminJunta();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Nueva cuenta de usuario</h1>
      <p className="mb-6 text-slate-600">
        Se generará una contraseña inicial; la persona deberá cambiarla en su primer ingreso.
      </p>
      <UsuarioForm modo="crear" />
    </div>
  );
}
