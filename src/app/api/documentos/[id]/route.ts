import { z } from "zod";
import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { obtenerArchivoDocumento } from "@/server/services/documento-service";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

const ROLES = ["secretario", "admin_junta", "tesorero", "socio"];

/**
 * GET /api/documentos/[id] — archivo de un acta o resolución, solo con sesión. La RLS hace que un
 * documento de otra junta «no exista»; el Socio solo accede a los publicados y vigentes (404 si no).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || !ROLES.includes(user.rol)) return json(403, "NO_AUTORIZADO");

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json(404, "NO_ENCONTRADO");
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const archivo = await obtenerArchivoDocumento(ctx, id, { soloVisibles: user.rol === "socio" });
  if (!archivo) return json(404, "NO_ENCONTRADO");
  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
