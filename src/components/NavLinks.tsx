"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemNav {
  href: string;
  etiqueta: string;
}

/** Menú principal; marca con aria-current la sección activa. */
export function NavLinks({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();
  return (
    <ul className="flex gap-2 overflow-x-auto md:flex-col">
      {items.map((n) => {
        // si otro ítem cuelga de esta ruta (p. ej. /finanzas y /finanzas/cobros), solo se marca con coincidencia exacta
        const tieneHijos = items.some((o) => o !== n && o.href.startsWith(`${n.href}/`));
        const activo = ruta === n.href || (!tieneHijos && ruta.startsWith(`${n.href}/`));
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={activo ? "page" : undefined}
              className={`block whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-800 ${
                activo ? "bg-slate-800 font-semibold" : ""
              }`}
            >
              {n.etiqueta}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
