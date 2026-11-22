/**
 * Valida una cédula ecuatoriana: 10 dígitos, provincia 01–24 o 30, tercer dígito < 6
 * y dígito verificador (módulo 10).
 */
export function validarCedula(valor: string): boolean {
  if (!/^\d{10}$/.test(valor)) return false;

  const provincia = Number(valor.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;

  const tercero = Number(valor[2]);
  if (tercero >= 6) return false;

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(valor[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(valor[9]);
}

/** Normaliza espacios y guiones antes de validar. */
export function normalizarCedula(valor: string): string {
  return valor.replace(/[\s-]/g, "");
}
