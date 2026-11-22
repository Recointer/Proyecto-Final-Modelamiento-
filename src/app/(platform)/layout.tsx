import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { exigirSesion } from "@/server/auth/page-guard";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await exigirSesion(["super_admin"]);
  return (
    <AppShell
      user={user}
      navegacion={[
        { href: "/panel", etiqueta: "Panel general" },
        { href: "/juntas", etiqueta: "Juntas y tenencias" },
      ]}
    >
      {children}
    </AppShell>
  );
}
