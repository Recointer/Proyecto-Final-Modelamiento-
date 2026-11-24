import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatoFecha } from "@/lib/fechas";
import type { Reporte } from "../services/reporte-service";

/** La fuente estándar (WinAnsi) cubre tildes y ñ; cualquier otro carácter se sustituye para no fallar. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, "?");
}

export function recortarTexto(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  let t = limpiarTexto(texto);
  if (fuente.widthOfTextAtSize(t, tamano) <= ancho) return t;
  while (t.length > 1 && fuente.widthOfTextAtSize(`${t}...`, tamano) > ancho) t = t.slice(0, -1);
  return `${t}...`;
}

export interface DatosReportePdf {
  junta: string;
  emitidoEn: string; // AAAA-MM-DD, hora de Ecuador
  reporte: Reporte;
}

/** Reporte financiero genérico en PDF: A4 (apaisado si hay muchas columnas), con totales y paginación. */
export async function generarReportePdf(d: DatosReportePdf): Promise<Uint8Array> {
  const { reporte } = d;
  const pdf = await PDFDocument.create();
  pdf.setTitle(reporte.titulo);
  pdf.setProducer("Sistema Multi-Junta");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const apaisado = reporte.columnas.length > 6;
  const ANCHO = apaisado ? 841.89 : 595.28;
  const ALTO = apaisado ? 595.28 : 841.89;
  const M = 40;
  const util = ANCHO - 2 * M;
  const color = rgb(0.1, 0.12, 0.16);
  const gris = rgb(0.4, 0.45, 0.5);
  const TAM = 8.5;

  // Ancho de cada columna proporcional a su contenido (acotado) para que quepan los textos largos.
  const pesos = reporte.columnas.map((c, i) => {
    const mayor = Math.max(c.etiqueta.length, ...reporte.filas.map((f) => (f[i] ?? "").length));
    return Math.min(34, Math.max(6, mayor));
  });
  const suma = pesos.reduce((a, b) => a + b, 0);
  const anchos = pesos.map((p) => (p / suma) * util);
  const xs = anchos.map((_, i) => M + anchos.slice(0, i).reduce((a, b) => a + b, 0));

  let page: PDFPage = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - M;
  const texto = (t: string, x: number, yy: number, tamano = 10, fuente = normal, c = color) =>
    page.drawText(limpiarTexto(t), { x, y: yy, size: tamano, font: fuente, color: c });
  const celda = (t: string, i: number, yy: number, fuente = normal) => {
    const col = reporte.columnas[i]!;
    const s = recortarTexto(t, fuente, TAM, anchos[i]! - 6);
    const w = fuente.widthOfTextAtSize(s, TAM);
    texto(s, col.derecha ? xs[i]! + anchos[i]! - 3 - w : xs[i]! + 2, yy, TAM, fuente);
  };

  const encabezadoTabla = () => {
    page.drawRectangle({ x: M - 2, y: y - 5, width: util + 4, height: 17, color: rgb(0.92, 0.94, 0.96) });
    reporte.columnas.forEach((c, i) => celda(c.etiqueta, i, y, negrita));
    y -= 19;
  };

  texto(d.junta, M, y, 11, negrita, gris);
  y -= 22;
  texto(reporte.titulo, M, y, 17, negrita);
  y -= 18;
  texto(reporte.periodo, M, y, 10);
  y -= 14;
  texto(`Fecha de emisión: ${formatoFecha(d.emitidoEn)}`, M, y, 9, normal, gris);
  y -= 24;
  encabezadoTabla();

  if (reporte.filas.length === 0) texto("Sin movimientos en el período.", M + 2, y, 10, normal, gris);
  for (const f of reporte.filas) {
    if (y < M + 40) {
      page = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - M;
      encabezadoTabla();
    }
    f.forEach((t, i) => celda(t, i, y));
    y -= 14;
  }

  y -= 8;
  if (y < M + 20 + reporte.totales.length * 16) {
    page = pdf.addPage([ANCHO, ALTO]);
    y = ALTO - M;
  }
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: ANCHO - M, y: y + 8 }, thickness: 0.7, color: gris });
  for (const t of reporte.totales) {
    const valor = `USD ${t.valor}`;
    texto(t.etiqueta, ANCHO - M - 220, y - 6, 10, negrita);
    texto(valor, ANCHO - M - normal.widthOfTextAtSize(valor, 10), y - 6, 10, negrita);
    y -= 16;
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`Página ${i + 1} de ${paginas.length}`, { x: ANCHO - M - 70, y: 22, size: 8, font: normal, color: gris });
  });
  return pdf.save();
}
