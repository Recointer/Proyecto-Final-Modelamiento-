import { z } from "zod";
import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { obtenerAdjuntoComunicacion } from "@/server/services/comunicacion-service";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

const ROLES = ["secretario", "admin_junta", "tesorero", "socio"];

/** GET /api/comunicaciones/[id]/adjunto — adjunto de una comunicación; el Socio solo si está publicada y vigente. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || !ROLES.includes(user.rol)) return json(403, "NO_AUTORIZADO");

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json(404, "NO_ENCONTRADO");
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const adjunto = await obtenerAdjuntoComunicacion(ctx, id, { soloVisibles: user.rol === "socio" });
  if (!adjunto) return json(404, "NO_ENCONTRADO");
  return new Response(new Uint8Array(adjunto.datos), {
    headers: {
      "Content-Type": adjunto.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
