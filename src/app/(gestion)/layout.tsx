import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { exigirSesion } from "@/server/auth/page-guard";
import { navegacionPara } from "@/lib/navegacion";

/**
 * Pantallas de operación del módulo administrativo. Aquí entra todo el personal de la junta y el
 * Socio; cada página restringe lo que le corresponde (el Socio solo ve lo suyo, el personal solo
 * consulta salvo el Secretario/a).
 */
export default async function GestionLayout({ children }: { children: ReactNode }) {
  const user = await exigirSesion(["secretario", "admin_junta", "tesorero", "socio"]);
  return (
    <AppShell user={user} navegacion={navegacionPara(user.rol)}>
      {children}
    </AppShell>
  );
}
