import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/recuperar"];

/**
 * Filtro rápido por presencia de cookie. La validación real de la sesión y del rol se hace
 * en el servidor (exigirSesion / requireRole), nunca solo aquí.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esPublica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const tieneCookie = req.cookies.has("sesion");

  if (!esPublica && !tieneCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
