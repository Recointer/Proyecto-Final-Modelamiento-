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
  SLUG_DUPLICADO: "Ese identificador ya está en uso.",
  JUNTA_NO_ENCONTRADA: "La junta no existe.",
  CONFIRMACION_REQUERIDA: "Debe confirmar la operación.",
  ACTA_INVALIDA: "El acta debe ser un PDF o imagen de hasta 5 MB.",
  JUNTA_YA_TIENE_ADMIN: "La junta ya tiene un administrador. Use «Cambiar administrador».",
  JUNTA_SIN_ADMIN: "La junta no tiene administrador.",
  SECTOR_DUPLICADO: "Ya existe un sector con ese nombre.",
  USUARIO_NO_ENCONTRADO: "La cuenta no existe.",
  SOCIO_NO_ENCONTRADO: "El socio no existe.",
  FECHA_FUTURA: "La fecha no puede ser posterior a hoy.",
  EVENTO_NO_ENCONTRADO: "El evento no existe.",
  EVENTO_ANULADO: "El evento está anulado y no admite cambios.",
  EVENTO_FUTURO: "El evento aún no se realiza: la asistencia se registra desde su fecha.",
  SOCIO_NO_PERMITIDO: "Hay socios que no pueden registrarse en este evento.",
  PREDIO_NO_ENCONTRADO: "El predio no existe.",
  CODIGO_DUPLICADO: "Ya existe un predio con ese código en la junta.",
  COORDENADAS_INVALIDAS: "Las coordenadas no son válidas.",
  IMAGEN_INVALIDA: "La imagen debe ser PNG o JPEG de hasta 5 MB.",
  SERVICIO_NO_ENCONTRADO: "El servicio no existe.",
  SERVICIO_DUPLICADO: "Ya existe un servicio con ese nombre en la junta.",
  TURNO_NO_ENCONTRADO: "El turno no existe.",
  TURNO_HORARIO_INVALIDO: "La hora de fin debe ser posterior a la de inicio.",
  TURNO_SOLAPADO: "El turno se solapa con otro del mismo servicio, sector y día.",
  CONCEPTO_NO_ENCONTRADO: "El concepto de cobro no existe.",
  CONCEPTO_DUPLICADO: "Ya existe un concepto con ese nombre.",
  CONCEPTO_INACTIVO: "El concepto está inactivo y no admite nuevas emisiones.",
  CONCEPTO_PROTEGIDO: "Los conceptos de multa los administra el sistema.",
  CARGO_NO_ENCONTRADO: "El cargo no existe.",
  CARGO_ANULADO: "El cargo está anulado.",
  CARGO_CON_PAGOS: "El cargo tiene pagos vigentes: anúlelos primero.",
  PAGO_EXCEDE_SALDO: "El pago supera el saldo pendiente del cargo.",
  PAGO_NO_ENCONTRADO: "El pago no existe.",
  PAGO_ANULADO: "El pago ya está anulado.",
  MONTO_INVALIDO: "Ingrese un monto válido, mayor que cero y con hasta 2 decimales.",
  SIN_SOCIOS: "No hay socios activos que reciban el cargo.",
  MULTA_NO_CONFIGURADA: "La junta no tiene configurada una multa para este tipo de evento.",
  EVENTO_SIN_ASISTENCIA: "El evento aún no tiene asistencia guardada.",
  EGRESO_NO_ENCONTRADO: "El egreso no existe.",
  EGRESO_ANULADO: "El egreso ya está anulado.",
  RESPALDO_INVALIDO: "El respaldo debe ser un PDF o una imagen de hasta 5 MB.",
  MATERIAL_NO_ENCONTRADO: "El material no existe.",
  MATERIAL_DUPLICADO: "Ya existe un material con ese nombre.",
  STOCK_INSUFICIENTE: "La salida supera el stock disponible.",
  ACTIVO_NO_ENCONTRADO: "El activo no existe.",
  ACTIVO_DUPLICADO: "Ya existe un activo con ese código.",
  ACTIVO_EN_BAJA: "El activo ya fue dado de baja.",
  NO_EN_PADRON: "Su cédula aún no figura en el padrón de la junta. Contacte a la secretaría.",
  ROL_NO_PERMITIDO: "Rol no permitido.",
  NO_PUEDE_DESACTIVARSE_A_SI_MISMO: "No puede desactivar su propia cuenta.",
  SECTOR_NO_ENCONTRADO: "El sector no existe.",
  SECTOR_CON_ASOCIADOS: "No se puede eliminar: el sector tiene socios o predios asociados. Reasígnelos primero.",
  MOTIVO_REQUERIDO: "Indique el motivo del cambio.",
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

/**
 * Describe un error para los logs sin incluir su mensaje: los errores de la base de datos traen la
 * consulta con sus parámetros (hashes de contraseña, cédulas, correos) y no deben llegar a los logs.
 */
export function descripcionSegura(e: unknown): string {
  const nombre = e instanceof Error ? e.name : typeof e;
  const causa = (e as { cause?: { code?: string } } | undefined)?.cause;
  const codigo = causa?.code ?? (e as { code?: string } | undefined)?.code;
  return codigo ? `${nombre} (código ${codigo})` : nombre;
}

/** Envuelve una acción: convierte AppError en Result y oculta errores internos. */
export async function ejecutar<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof AppError) return fail(e.codigo, e.message, e.campo);
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect() de Next.js
    console.error("Error interno:", descripcionSegura(e));
    return fail("ERROR_INTERNO");
  }
}
