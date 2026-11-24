import { z } from "zod";
import { AppError } from "@/lib/result";
import { contextoGestion } from "@/server/auth/page-guard";
import { obtenerCalendarioSemanal } from "@/server/services/calendario-service";
import { listarSectores } from "@/server/services/configuracion-service";
import { socioDeSesion } from "@/server/services/socio-sesion";
import { SemanaCalendario } from "@/components/SemanaCalendario";
import { EstadoVacio } from "@/components/ui";

export const metadata = { title: "Calendario semanal" };

export default async function CalendarioSemanalPage({ searchParams }: { searchParams: Promise<{ sectorId?: string }> }) {
  const sp = await searchParams;
  const { ctx, user } = await contextoGestion(["secretario", "admin_junta", "tesorero", "socio"]);
  const sectores = await listarSectores(ctx);

  let sectorId: string | undefined;
  if (user.rol === "socio") {
    // el sector del socio se deriva de la sesión, nunca de la URL
    const socio = await socioDeSesion(ctx, user);
    if (!socio) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Calendario semanal</h1>
          <p role="status" className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {new AppError("NO_EN_PADRON").message}
          </p>
        </div>
      );
    }
    sectorId = socio.sectorId;
  } else {
    const pedido = z.string().uuid().safeParse(sp.sectorId);
    sectorId = pedido.success && sectores.some((s) => s.id === pedido.data) ? pedido.data : sectores[0]?.id;
  }

  const sector = sectores.find((s) => s.id === sectorId);
  const calendario = sector ? await obtenerCalendarioSemanal(ctx, sector.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendario semanal</h1>
        {sector ? <p className="text-sm text-slate-600">Sector {sector.nombre}</p> : null}
      </div>

      {user.rol !== "socio" && sectores.length > 0 ? (
        <form method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
          <div>
            <label htmlFor="f-sector" className="mb-1 block text-xs font-semibold text-slate-700">Sector</label>
            <select
              id="f-sector"
              name="sectorId"
              defaultValue={sectorId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Ver calendario</button>
        </form>
      ) : null}

      {calendario && sector ? (
        <SemanaCalendario calendario={calendario} titulo={`Semana del sector ${sector.nombre}`} />
      ) : (
        <EstadoVacio titulo="Aún no hay sectores configurados" descripcion="El Administrador de la Junta debe crearlos en «Configuración»." />
      )}
    </div>
  );
}
