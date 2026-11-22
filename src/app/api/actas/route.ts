import { NextResponse } from "next/server";
import { AppError } from "@/lib/result";
import { requireRole } from "@/server/auth/guard";
import { fileStore } from "@/server/files/file-store";
import { leerActa } from "@/server/services/acta";

/**
 * POST /api/actas (multipart, solo super_admin): valida tipo real y tamaño de un acta (PDF o imagen
 * de hasta 5 MB) y devuelve la ruta interna usada al asignar o cambiar administrador.
 */
export async function POST(req: Request) {
  try {
    await requireRole("super_admin");
    const form = await req.formData();
    const bytes = await leerActa(form.get("acta"));
    const ruta = await fileStore().guardar(bytes, "actas");
    return NextResponse.json({ ok: true, data: { ruta } });
  } catch (e) {
    if (e instanceof AppError) {
      const estado = e.codigo === "NO_AUTENTICADO" ? 401 : e.codigo === "NO_AUTORIZADO" ? 403 : 400;
      return NextResponse.json({ ok: false, error: { codigo: e.codigo, mensaje: e.message } }, { status: estado });
    }
    console.error("Error al subir acta");
    return NextResponse.json({ ok: false, error: { codigo: "ERROR_INTERNO" } }, { status: 500 });
  }
}
