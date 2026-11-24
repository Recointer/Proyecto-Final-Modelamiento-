import { AppShell } from "@/components/AppShell";
import { exigirSesion } from "@/server/auth/page-guard";
import { navegacionPara } from "@/lib/navegacion";

export const metadata = { title: "Inicio" };

export default async function InicioMiembroPage() {
  const user = await exigirSesion(["secretario", "tesorero", "socio"]);
  return (
    <AppShell user={user} navegacion={navegacionPara(user.rol)}>
      <h1 className="text-2xl font-bold">Bienvenido, {user.nombres}</h1>
      <p className="mt-2 text-slate-600">
        Los módulos administrativo, financiero y de comunicaciones estarán disponibles pronto.
      </p>
    </AppShell>
  );
}
