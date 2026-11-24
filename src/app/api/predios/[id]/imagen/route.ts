import { z } from "zod";
import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { obtenerImagenPredio } from "@/server/services/predio-service";
import { socioDeSesion } from "@/server/services/socio-sesion";

const ROLES = ["secretario", "admin_junta", "tesorero", "socio"];

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/predios/[id]/imagen — imagen del predio, solo con sesión. La RLS del contexto hace que un
 * predio de otra junta «no exista», y un Socio solo puede pedir los suyos. La ruta del archivo nunca se
 * expone y no hay URLs públicas.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || !ROLES.includes(user.rol)) return json(403, "NO_AUTORIZADO");

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json(404, "NO_ENCONTRADO");

  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  let acotado: string | undefined;
  if (user.rol === "socio") {
    const socio = await socioDeSesion(ctx, user);
    if (!socio) return json(404, "NO_ENCONTRADO");
    acotado = socio.id;
  }

  const imagen = await obtenerImagenPredio(ctx, id, acotado);
  if (!imagen) return json(404, "NO_ENCONTRADO");

  return new Response(new Uint8Array(imagen.datos), {
    headers: {
      "Content-Type": imagen.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
