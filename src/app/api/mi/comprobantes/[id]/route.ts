import { z } from "zod";
import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { generarComprobantePdf } from "@/server/reportes/comprobante-pdf";
import { comprobanteDe } from "@/server/services/pago-service";
import { socioDeSesion } from "@/server/services/socio-sesion";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/mi/comprobantes/[id] — comprobante de un pago del propio Socio. El socio se deriva de la
 * sesión; un pago ajeno responde 404 igual que uno inexistente.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || user.rol !== "socio") return json(403, "NO_AUTORIZADO");

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json(404, "NO_ENCONTRADO");
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const socio = await socioDeSesion(ctx, user);
  if (!socio) return json(404, "NO_EN_PADRON");
  const comprobante = await comprobanteDe(ctx, id, socio.id);
  if (!comprobante || comprobante.anulado) return json(404, "NO_ENCONTRADO");

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
