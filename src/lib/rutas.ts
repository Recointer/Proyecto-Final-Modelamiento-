export function destinoPorRol(rol: string): string {
  if (rol === "super_admin") return "/panel";
  if (rol === "admin_junta") return "/configuracion";
  return "/inicio";
}
