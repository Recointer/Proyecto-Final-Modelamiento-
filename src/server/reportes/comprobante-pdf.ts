import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatoFecha, hoyEcuador } from "@/lib/fechas";
import { formatoUsd } from "@/lib/dinero";
import { ETIQUETA_FORMA_PAGO } from "../validation/finanzas";
import type { DatosComprobante } from "../services/pago-service";
import { limpiarTexto } from "./tabla-pdf";

/** Comprobante de pago (recibo interno de la junta, no un documento tributario). */
export async function generarComprobantePdf(c: DatosComprobante): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprobante de pago N.º ${c.numero}`);
  pdf.setProducer("Sistema Multi-Junta");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ANCHO = 595.28;
  const ALTO = 420;
  const M = 48;
  const page = pdf.addPage([ANCHO, ALTO]);
  const color = rgb(0.1, 0.12, 0.16);
  const gris = rgb(0.4, 0.45, 0.5);
  const rojo = rgb(0.7, 0.1, 0.1);
  let y = ALTO - M;
  const texto = (t: string, x: number, yy: number, tamano = 11, fuente = normal, col = color) =>
    page.drawText(limpiarTexto(t), { x, y: yy, size: tamano, font: fuente, color: col });
  const fila = (etiqueta: string, valor: string) => {
    texto(etiqueta, M, y, 10, normal, gris);
    texto(valor, M + 130, y, 11);
    y -= 20;
  };

  texto(c.junta, M, y, 12, negrita, gris);
  y -= 26;
  texto("Comprobante de pago", M, y, 20, negrita);
  const numero = `N.º ${String(c.numero).padStart(6, "0")}`;
  texto(numero, ANCHO - M - negrita.widthOfTextAtSize(numero, 16), y, 16, negrita);
  y -= 14;
  if (c.anulado) {
    texto(`ANULADO${c.motivoAnulacion ? `: ${c.motivoAnulacion}` : ""}`, M, y - 6, 11, negrita, rojo);
    y -= 14;
  }
  y -= 18;

  fila("Recibido de", `${c.socioNombres} (C.I. ${c.socioCedula})`);
  fila("Concepto", `${c.concepto} — año ${c.anio}`);
  fila("Fecha del pago", formatoFecha(c.fecha));
  fila("Forma de pago", ETIQUETA_FORMA_PAGO[c.forma as keyof typeof ETIQUETA_FORMA_PAGO] ?? c.forma);
  if (c.referencia) fila("Referencia", c.referencia);
  fila("Valor del cargo", formatoUsd(c.montoCargo));
  y -= 6;
  page.drawLine({ start: { x: M, y: y + 10 }, end: { x: ANCHO - M, y: y + 10 }, thickness: 0.7, color: gris });
  texto("Valor recibido", M, y - 10, 12, negrita);
  const monto = formatoUsd(c.monto);
  texto(monto, ANCHO - M - negrita.widthOfTextAtSize(monto, 18), y - 12, 18, negrita);

  texto("Recibo interno de la junta; no constituye factura ni documento tributario.", M, 38, 8, normal, gris);
  texto(`Emitido el ${formatoFecha(hoyEcuador(c.emitidoEn))}`, M, 26, 8, normal, gris);
  return pdf.save();
}
