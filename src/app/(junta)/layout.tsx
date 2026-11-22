import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { exigirSesion } from "@/server/auth/page-guard";

export default async function JuntaLayout({ children }: { children: ReactNode }) {
  const user = await exigirSesion(["admin_junta"]);
  return (
    <AppShell
      user={user}
      navegacion={[
        { href: "/configuracion", etiqueta: "Configuración" },
        { href: "/usuarios", etiqueta: "Cuentas de usuario" },
      ]}
    >
      {children}
    </AppShell>
  );
}
