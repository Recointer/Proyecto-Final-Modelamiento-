import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { generarCsv } from "@/lib/csv";
import { hoyEcuador } from "@/lib/fechas";
import { generarReportePdf } from "@/server/reportes/tabla-pdf";
import { obtenerConfiguracion } from "@/server/services/configuracion-service";
import { filasCsv, generarReporte, TIPOS_REPORTE, type TipoReporte } from "@/server/services/reporte-service";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/finanzas/reportes/[tipo]?formato=pdf|csv&anio=&desde=&hasta= — reportes financieros para el
 * Tesorero/a y el Administrador de la Junta. Los totales salen de la misma consulta que el detalle.
 */
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || !["tesorero", "admin_junta"].includes(user.rol)) return json(403, "NO_AUTORIZADO");

  const { tipo } = await params;
  const t = TIPOS_REPORTE.find((x) => x === tipo) as TipoReporte | undefined;
  if (!t) return json(404, "NO_ENCONTRADO");
  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const q = new URL(req.url).searchParams;
  const formato = q.get("formato") === "csv" ? "csv" : "pdf";
  const anioTexto = q.get("anio");
  const anio = anioTexto && /^\d{4}$/.test(anioTexto) ? Number(anioTexto) : undefined;
  const desde = q.get("desde");
  const hasta = q.get("hasta");
  if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) return json(400, "DATOS_INVALIDOS");

  const reporte = await generarReporte(ctx, t, { anio, desde: desde || undefined, hasta: hasta || undefined });
  const nombre = `${t}-${hoyEcuador()}`;

  if (formato === "csv") {
    return new Response(generarCsv(filasCsv(reporte)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const { junta } = await obtenerConfiguracion(ctx);
  const bytes = await generarReportePdf({ junta: junta.nombre, emitidoEn: hoyEcuador(), reporte });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
