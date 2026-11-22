/**
 * Escapa una celda CSV (RFC 4180) y neutraliza la inyección de fórmulas en hojas de cálculo:
 * si empieza con = + - @ tab o retorno, se antepone un apóstrofo.
 */
export function csvCelda(valor: string | number | boolean | Date | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  let texto: string;
  if (valor instanceof Date) texto = valor.toISOString();
  else if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  else texto = String(valor);

  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function csvFila(celdas: (string | number | boolean | Date | null | undefined)[]): string {
  return celdas.map(csvCelda).join(",");
}

/** Une filas con CRLF y antepone BOM para que Excel reconozca UTF-8. */
export function generarCsv(filas: (string | number | boolean | Date | null | undefined)[][]): string {
  return `﻿${filas.map(csvFila).join("\r\n")}\r\n`;
}
