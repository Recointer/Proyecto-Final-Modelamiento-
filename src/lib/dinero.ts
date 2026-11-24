/**
 * Dinero en dólares con 2 decimales. Los importes viajan como texto ("12.50") y se calculan en
 * centavos enteros para no arrastrar errores de redondeo de punto flotante.
 */

/** "12", "12.5", "12,50" → 1250. Devuelve null si no es un importe con hasta 2 decimales. */
export function aCentavos(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim().replace(",", ".");
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

/** 1250 → "12.50" (formato de la base de datos). */
export function deCentavos(centavos: number): string {
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Suma exacta de importes en texto. */
export function sumarDinero(valores: (string | null | undefined)[]): string {
  return deCentavos(valores.reduce((acc, v) => acc + (aCentavos(v) ?? 0), 0));
}

/** "1234.5" → "$ 1.234,50" (separador de miles con punto y decimales con coma). */
export function formatoUsd(valor: string | number | null | undefined): string {
  const c = typeof valor === "number" ? Math.round(valor * 100) : aCentavos(valor) ?? (Number(valor) ? Math.round(Number(valor) * 100) : 0);
  const [ent, dec] = deCentavos(Math.abs(c)).split(".");
  const miles = ent!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${c < 0 ? "-" : ""}$ ${miles},${dec}`;
}
