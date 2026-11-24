export interface ItemNav {
  href: string;
  etiqueta: string;
}

/**
 * Módulos ya implementados. Se amplía a medida que se entregan las historias, para que el menú
 * nunca enlace a pantallas inexistentes.
 */
export const MODULOS_DISPONIBLES = new Set<string>(["socios"]);

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
  { modulo: "mi-informacion", href: "/mi/informacion", etiqueta: "Mi información", roles: ["socio"] },
  { modulo: "mi-asistencia", href: "/mi/asistencia", etiqueta: "Mi asistencia", roles: ["socio"] },
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
