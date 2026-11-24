export interface ItemNav {
  href: string;
  etiqueta: string;
}

/**
 * Módulos ya implementados. Se amplía a medida que se entregan las historias, para que el menú
 * nunca enlace a pantallas inexistentes.
 */
export const MODULOS_DISPONIBLES = new Set<string>([
  "socios",
  "eventos",
  "predios",
  "servicios",
  "calendario",
  "mi-informacion",
  "mi-asistencia",
  "finanzas",
  "cobros",
  "conceptos",
  "multas",
  "egresos",
  "reportes",
  "inventario",
  "activos",
  "mi-estado-cuenta",
  "convocatorias",
  "documentos",
  "comunicaciones",
  "mensajes",
  "comunicados",
]);

interface Entrada extends ItemNav {
  modulo: string;
  roles: readonly string[];
}

const PERSONAL = ["admin_junta", "secretario", "tesorero"] as const;

const ENTRADAS: readonly Entrada[] = [
  { modulo: "configuracion", href: "/configuracion", etiqueta: "Configuración", roles: ["admin_junta"] },
  { modulo: "usuarios", href: "/usuarios", etiqueta: "Cuentas de usuario", roles: ["admin_junta"] },
  { modulo: "inicio", href: "/inicio", etiqueta: "Inicio", roles: ["secretario", "tesorero", "socio"] },
  { modulo: "socios", href: "/socios", etiqueta: "Socios", roles: PERSONAL },
  { modulo: "eventos", href: "/eventos", etiqueta: "Eventos y asistencia", roles: PERSONAL },
  { modulo: "predios", href: "/predios", etiqueta: "Predios y mapa", roles: [...PERSONAL, "socio"] },
  { modulo: "servicios", href: "/servicios", etiqueta: "Servicios y turnos", roles: PERSONAL },
  { modulo: "calendario", href: "/calendario", etiqueta: "Calendario semanal", roles: [...PERSONAL, "socio"] },
  { modulo: "finanzas", href: "/finanzas", etiqueta: "Resumen financiero", roles: ["tesorero", "admin_junta"] },
  { modulo: "cobros", href: "/finanzas/cobros", etiqueta: "Cuentas por cobrar", roles: ["tesorero"] },
  { modulo: "conceptos", href: "/finanzas/conceptos", etiqueta: "Conceptos de cobro", roles: ["tesorero"] },
  { modulo: "multas", href: "/finanzas/multas", etiqueta: "Multas", roles: ["tesorero"] },
  { modulo: "egresos", href: "/finanzas/egresos", etiqueta: "Egresos", roles: ["tesorero"] },
  { modulo: "reportes", href: "/finanzas/reportes", etiqueta: "Reportes", roles: ["tesorero", "admin_junta"] },
  { modulo: "inventario", href: "/finanzas/inventario", etiqueta: "Inventario", roles: ["tesorero"] },
  { modulo: "activos", href: "/finanzas/activos", etiqueta: "Activos fijos", roles: ["tesorero"] },
  { modulo: "convocatorias", href: "/convocatorias", etiqueta: "Convocatorias", roles: [...PERSONAL, "socio"] },
  { modulo: "documentos", href: "/documentos", etiqueta: "Actas y resoluciones", roles: [...PERSONAL, "socio"] },
  { modulo: "comunicaciones", href: "/comunicaciones", etiqueta: "Comunicaciones recibidas", roles: PERSONAL },
  { modulo: "comunicados", href: "/comunicaciones", etiqueta: "Comunicados", roles: ["socio"] },
  { modulo: "mensajes", href: "/mensajes", etiqueta: "Mensajes", roles: ["admin_junta", "socio"] },
  { modulo: "mi-informacion", href: "/mi/informacion", etiqueta: "Mi información", roles: ["socio"] },
  { modulo: "mi-asistencia", href: "/mi/asistencia", etiqueta: "Mi asistencia", roles: ["socio"] },
  { modulo: "mi-estado-cuenta", href: "/mi/estado-de-cuenta", etiqueta: "Mi estado de cuenta", roles: ["socio"] },
];

const SIEMPRE = new Set(["configuracion", "usuarios", "inicio"]);

/** Enlaces del menú principal para un rol, solo de módulos disponibles. */
export function navegacionPara(rol: string): ItemNav[] {
  if (rol === "super_admin") {
    return [
      { href: "/panel", etiqueta: "Panel general" },
      { href: "/juntas", etiqueta: "Juntas y tenencias" },
    ];
  }
  return ENTRADAS.filter(
    (e) => e.roles.includes(rol) && (SIEMPRE.has(e.modulo) || MODULOS_DISPONIBLES.has(e.modulo)),
  ).map(({ href, etiqueta }) => ({ href, etiqueta }));
}
