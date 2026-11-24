import { z } from "zod";
import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { generarComprobantePdf } from "@/server/reportes/comprobante-pdf";
import { comprobanteDe } from "@/server/services/pago-service";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/comprobantes/[id] — comprobante de pago en PDF para el Tesorero/a y el Administrador de la
 * Junta. La RLS hace que un pago de otra junta «no exista» (404 sin revelar su existencia).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || !["tesorero", "admin_junta"].includes(user.rol)) return json(403, "NO_AUTORIZADO");

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json(404, "NO_ENCONTRADO");
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const comprobante = await comprobanteDe(ctx, id);
  if (!comprobante) return json(404, "NO_ENCONTRADO");
  const bytes = await generarComprobantePdf(comprobante);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comprobante-${String(comprobante.numero).padStart(6, "0")}.pdf"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
