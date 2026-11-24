import { contextoDe } from "@/server/auth/guard";
import { usuarioActual } from "@/server/auth/session";
import { hoyEcuador } from "@/lib/fechas";
import { generarHistorialPdf } from "@/server/reportes/historial-pdf";
import { obtenerConfiguracion } from "@/server/services/configuracion-service";
import { obtenerMiHistorial } from "@/server/services/mi-informacion-service";

const json = (estado: number, codigo: string) =>
  Response.json({ ok: false, error: { codigo } }, { status: estado, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/mi/asistencia.pdf — historial de asistencia del propio socio. Solo rol Socio; el socio se
 * deriva de la sesión, nunca de un parámetro, así que nadie puede pedir el de otra persona.
 */
export async function GET() {
  const user = await usuarioActual();
  if (!user) return json(401, "NO_AUTENTICADO");
  if (user.debeCambiarPassword || user.rol !== "socio") return json(403, "NO_AUTORIZADO");

  const ctx = contextoDe(user);
  if (ctx.role !== "tenant") return json(403, "NO_AUTORIZADO");

  const historial = await obtenerMiHistorial(ctx, user);
  if (!historial) return json(404, "NO_EN_PADRON");
  const { junta } = await obtenerConfiguracion(ctx);

  const bytes = await generarHistorialPdf({
    junta: junta.nombre,
    socio: { nombres: historial.socio.nombres, cedula: historial.socio.cedula },
    emitidoEn: hoyEcuador(),
    items: historial.items,
    cumplimiento: historial.cumplimiento,
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="historial-asistencia.pdf"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
