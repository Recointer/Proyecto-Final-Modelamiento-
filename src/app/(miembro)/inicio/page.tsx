import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TarjetaCumplimiento } from "@/components/TarjetaCumplimiento";
import { navegacionPara } from "@/lib/navegacion";
import { AppError } from "@/lib/result";
import { contextoDe } from "@/server/auth/guard";
import { exigirSesion } from "@/server/auth/page-guard";
import { obtenerMiHistorial } from "@/server/services/mi-informacion-service";

export const metadata = { title: "Inicio" };

export default async function InicioMiembroPage() {
  const user = await exigirSesion(["secretario", "tesorero", "socio"]);
  const ctx = contextoDe(user);
  const esSocio = user.rol === "socio" && ctx.role === "tenant";
  const historial = esSocio ? await obtenerMiHistorial(ctx, user) : null;

  return (
    <AppShell user={user} navegacion={navegacionPara(user.rol)}>
      <h1 className="text-2xl font-bold">Bienvenido, {user.nombres}</h1>
      {esSocio ? (
        historial ? (
          <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
            <TarjetaCumplimiento cumplimiento={historial.cumplimiento} />
            <nav aria-label="Accesos rápidos" className="space-y-2 rounded-xl border bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-600">Accesos rápidos</h2>
              <ul className="space-y-1 text-teal-800 underline">
                <li><Link href="/mi/informacion">Ver mi ficha y mis predios</Link></li>
                <li><Link href="/mi/asistencia">Ver mi historial de asistencia</Link></li>
                <li><Link href="/mi/estado-de-cuenta">Ver mi estado de cuenta</Link></li>
                <li><Link href="/calendario">Ver el calendario de turnos</Link></li>
                <li><Link href="/predios">Ver el mapa de mis predios</Link></li>
              </ul>
            </nav>
          </div>
        ) : (
          <p role="status" className="mt-4 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {new AppError("NO_EN_PADRON").message}
          </p>
        )
      ) : (
        <p className="mt-2 text-slate-600">
          {user.rol === "tesorero"
            ? "Use el menú para cobrar cuotas, generar multas, registrar egresos y emitir reportes; también puede consultar socios, eventos, predios, servicios y el calendario."
            : "Use el menú para trabajar con socios, eventos, predios, servicios y el calendario. El módulo de comunicaciones estará disponible pronto."}
        </p>
      )}
    </AppShell>
  );
}
