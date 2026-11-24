import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { exigirSesion } from "@/server/auth/page-guard";
import { navegacionPara } from "@/lib/navegacion";

export default async function JuntaLayout({ children }: { children: ReactNode }) {
  const user = await exigirSesion(["admin_junta"]);
  return (
    <AppShell
      user={user}
      navegacion={navegacionPara("admin_junta")}
    >
      {children}
    </AppShell>
  );
}
