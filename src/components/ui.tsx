import Link from "next/link";
import type { ReactNode } from "react";

export function EstadoVacio({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-semibold text-slate-800">{titulo}</p>
      {descripcion ? <p className="mt-1 text-sm text-slate-600">{descripcion}</p> : null}
    </div>
  );
}

export function Insignia({
  tono,
  children,
}: {
  tono: "verde" | "gris" | "rojo" | "ambar";
  children: ReactNode;
}) {
  const clases = {
    verde: "bg-emerald-100 text-emerald-800",
    gris: "bg-slate-200 text-slate-700",
    rojo: "bg-red-100 text-red-800",
    ambar: "bg-amber-100 text-amber-800",
  }[tono];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${clases}`}>{children}</span>;
}

/** Paginación por enlaces; conserva los filtros recibidos en `params`. */
export function Paginacion({
  ruta,
  pagina,
  paginas,
  params,
}: {
  ruta: string;
  pagina: number;
  paginas: number;
  params: Record<string, string | undefined>;
}) {
  if (paginas <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("pagina", String(p));
    return `${ruta}?${q.toString()}`;
  };
  const clase = "rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100";
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between">
      {pagina > 1 ? (
        <Link href={href(pagina - 1)} className={clase}>
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-slate-600">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={href(pagina + 1)} className={clase}>
          Siguiente →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Contenedor de tabla desplazable en móvil y accesible por teclado (WCAG 2.1.1). */
export function TablaScroll({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={`${etiqueta} (desplazable)`} tabIndex={0} className="relative overflow-x-auto rounded-xl border bg-white">
      {children}
    </div>
  );
}

const TONO_CARGO = { pendiente: "ambar", parcial: "ambar", pagado: "verde", anulado: "gris" } as const;
const TEXTO_CARGO = { pendiente: "Pendiente", parcial: "Pago parcial", pagado: "Pagado", anulado: "Anulado" } as const;

/** Estado de un cargo; si está vencido se destaca en rojo. */
export function InsigniaCargo({ estado, vencido }: { estado: string; vencido?: boolean }) {
  const e = (estado in TONO_CARGO ? estado : "pendiente") as keyof typeof TONO_CARGO;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Insignia tono={TONO_CARGO[e]}>{TEXTO_CARGO[e]}</Insignia>
      {vencido ? <Insignia tono="rojo">Vencido</Insignia> : null}
    </span>
  );
}
