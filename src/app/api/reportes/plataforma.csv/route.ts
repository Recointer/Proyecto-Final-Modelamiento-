import { AppError } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import { generarReportePlataforma } from "@/server/services/panel-service";

/** GET /api/reportes/plataforma.csv — solo super_admin; contiene únicamente datos agregados. */
export async function GET() {
  try {
    const { ctx } = await requireRole("super_admin");
    if (ctx.role !== "super_admin") throw new AppError("NO_AUTORIZADO");
    const ahora = new Date();
    const csv = await generarReportePlataforma(ctx, ahora);
    const fecha = ahora.toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="plataforma-${fecha}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError) {
      const estado = e.codigo === "NO_AUTENTICADO" ? 401 : 403;
      return Response.json({ ok: false, error: { codigo: e.codigo, mensaje: e.message } }, { status: estado });
    }
    console.error("Error al generar el reporte");
    return Response.json({ ok: false, error: { codigo: "ERROR_INTERNO" } }, { status: 500 });
  }
}
