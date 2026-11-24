import { z } from "zod";
import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { obtenerRespaldo } from "@/server/services/egreso-service";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

/** GET /api/egresos/[id]/respaldo — respaldo del egreso, solo para Tesorería y Administración de la misma junta. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || !["tesorero", "admin_junta"].includes(user.rol)) return json(403, "NO_AUTORIZADO");

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json(404, "NO_ENCONTRADO");
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const respaldo = await obtenerRespaldo(ctx, id);
  if (!respaldo) return json(404, "NO_ENCONTRADO");
  return new Response(new Uint8Array(respaldo.datos), {
    headers: {
      "Content-Type": respaldo.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
