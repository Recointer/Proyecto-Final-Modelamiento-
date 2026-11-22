/** Formato de resultado de las acciones (ver specs/001-gestion-plataforma/contracts). */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { codigo: string; mensaje: string; campo?: string } };

export const MENSAJES: Record<string, string> = {
  CREDENCIALES_INVALIDAS: "Credenciales incorrectas.",
  CUENTA_BLOQUEADA: "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.",
  CUENTA_DESACTIVADA: "Su cuenta está desactivada. Contacte a su administrador.",
  JUNTA_DESACTIVADA: "La junta está desactivada. Contacte a la plataforma.",
  ELEGIR_JUNTA: "Su cuenta existe en más de una junta. Indique el identificador de su junta.",
  TOKEN_INVALIDO: "El enlace no es válido o ha expirado.",
  PASSWORD_DEBIL: "La contraseña debe tener al menos 10 caracteres, con letras y números.",
  NO_AUTORIZADO: "Acceso denegado.",
  NO_AUTENTICADO: "Debe iniciar sesión.",
  DATOS_INVALIDOS: "Revise los datos ingresados.",
  CEDULA_INVALIDA: "La cédula no es válida.",
  CEDULA_DUPLICADA: "Ya existe una cuenta con esa cédula en la junta.",
  CORREO_DUPLICADO: "Ya existe una cuenta con ese correo en la junta.",
  JUNTA_DUPLICADA: "Ya existe una junta con ese nombre en la parroquia.",
  ERROR_INTERNO: "Ocurrió un error inesperado. Intente nuevamente.",
};

export class AppError extends Error {
  constructor(
    public readonly codigo: string,
    mensaje?: string,
    public readonly campo?: string,
  ) {
    super(mensaje ?? MENSAJES[codigo] ?? codigo);
  }
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(codigo: string, mensaje?: string, campo?: string): Result<never> {
  return { ok: false, error: { codigo, mensaje: mensaje ?? MENSAJES[codigo] ?? codigo, campo } };
}

/** Envuelve una acción: convierte AppError en Result y oculta errores internos. */
export async function ejecutar<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof AppError) return fail(e.codigo, e.message, e.campo);
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect() de Next.js
    console.error("Error interno:", e instanceof Error ? e.message : "desconocido");
    return fail("ERROR_INTERNO");
  }
}
