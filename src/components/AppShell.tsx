import type { ReactNode } from "react";
import type { UsuarioSesion } from "@/server/auth/session";
import { cerrarSesionAction } from "@/app/(auth)/actions";
import { NavLinks, type ItemNav } from "./NavLinks";

export type { ItemNav };

const ROLES: Record<string, string> = {
  super_admin: "Super Administrador",
  admin_junta: "Administrador de la Junta",
  secretario: "Secretario/a",
  tesorero: "Tesorero/a",
  socio: "Socio",
};

export function AppShell({
  user,
  navegacion,
  children,
}: {
  user: UsuarioSesion;
  navegacion: ItemNav[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-slate-900 focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <aside className="bg-slate-900 p-4 text-slate-100 md:w-64 md:shrink-0">
        <p className="text-lg font-bold">Multi-Junta</p>
        <p className="mb-4 text-xs text-slate-300">{user.juntaNombre ?? "Plataforma"}</p>
        <nav aria-label="Navegación principal">
          <NavLinks items={navegacion} />
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div>
            <p className="font-semibold">{user.nombres}</p>
            <p className="text-xs text-slate-600">{ROLES[user.rol]}</p>
          </div>
          <form action={cerrarSesionAction}>
            <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100">
              Cerrar sesión
            </button>
          </form>
        </header>
        <main id="contenido" tabIndex={-1} className="p-4 outline-none md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
