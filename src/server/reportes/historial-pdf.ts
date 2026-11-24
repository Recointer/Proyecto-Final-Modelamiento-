import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Cumplimiento } from "@/lib/cumplimiento";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_TIPO_EVENTO } from "../validation/evento";
import type { FilaHistorial } from "../services/mi-informacion-service";

export interface DatosHistorialPdf {
  junta: string;
  socio: { nombres: string; cedula: string };
  emitidoEn: string; // AAAA-MM-DD, hora de Ecuador
  items: FilaHistorial[];
  cumplimiento: Cumplimiento;
}

const ESTADO: Record<FilaHistorial["estado"], string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
};

/** La fuente estándar (WinAnsi) cubre tildes y ñ; cualquier otro carácter se sustituye para no fallar. */
function limpiar(texto: string): string {
  return texto
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, "?");
}

function recortar(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  let t = limpiar(texto);
  if (fuente.widthOfTextAtSize(t, tamano) <= ancho) return t;
  while (t.length > 1 && fuente.widthOfTextAtSize(`${t}…`.replace("…", "..."), tamano) > ancho) t = t.slice(0, -1);
  return `${t}...`;
}

/** Genera el historial de asistencia de UN socio en PDF (A4, varias páginas si hace falta). */
export async function generarHistorialPdf(d: DatosHistorialPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Historial de asistencia");
  pdf.setProducer("Sistema Multi-Junta");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ANCHO = 595.28;
  const ALTO = 841.89;
  const M = 48;
  const color = rgb(0.1, 0.12, 0.16);
  const gris = rgb(0.4, 0.45, 0.5);
  const columnas = [
    { x: M, ancho: 62, titulo: "Fecha" },
    { x: M + 66, ancho: 200, titulo: "Evento" },
    { x: M + 270, ancho: 58, titulo: "Tipo" },
    { x: M + 332, ancho: 66, titulo: "Asistencia" },
    { x: M + 402, ancho: 97, titulo: "Motivo" },
  ];

  let page: PDFPage = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - M;
  const texto = (t: string, x: number, yy: number, tamano = 10, fuente = normal, c = color) =>
    page.drawText(limpiar(t), { x, y: yy, size: tamano, font: fuente, color: c });

  const encabezadoTabla = () => {
    page.drawRectangle({ x: M - 4, y: y - 5, width: ANCHO - 2 * M + 8, height: 18, color: rgb(0.92, 0.94, 0.96) });
    for (const c of columnas) texto(c.titulo, c.x, y, 9, negrita);
    y -= 20;
  };

  texto(d.junta, M, y, 11, negrita, gris);
  y -= 24;
  texto("Historial de asistencia", M, y, 18, negrita);
  y -= 26;
  texto(`Socio: ${d.socio.nombres}`, M, y, 11);
  y -= 15;
  texto(`Cédula: ${d.socio.cedula}`, M, y, 11);
  y -= 15;
  texto(`Fecha de emisión: ${formatoFecha(d.emitidoEn)}`, M, y, 11);
  y -= 26;

  const c = d.cumplimiento;
  texto("Resumen", M, y, 12, negrita);
  y -= 16;
  texto(`Presentes: ${c.presentes}    Justificadas: ${c.justificados}    Ausencias injustificadas: ${c.ausentes}`, M, y, 10);
  y -= 15;
  texto(
    c.porcentaje === null
      ? "Cumplimiento: no aplica (aún no hay eventos con asistencia registrada)"
      : `Cumplimiento: ${String(c.porcentaje).replace(".", ",")} % (meta de referencia ${c.meta} %)`,
    M,
    y,
    10,
    negrita,
  );
  y -= 15;
  texto("Las asistencias justificadas no penalizan ni suman al porcentaje.", M, y, 8, normal, gris);
  y -= 26;

  texto("Detalle por evento", M, y, 12, negrita);
  y -= 20;
  encabezadoTabla();

  if (d.items.length === 0) {
    texto("Sin eventos con asistencia registrada.", M, y, 10, normal, gris);
  }
  for (const f of d.items) {
    if (y < M + 20) {
      page = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - M;
      encabezadoTabla();
    }
    const celdas = [
      formatoFecha(f.fecha),
      f.titulo,
      ETIQUETA_TIPO_EVENTO[f.tipo],
      ESTADO[f.estado],
      f.motivo ?? "",
    ];
    celdas.forEach((t, i) => {
      const col = columnas[i]!;
      texto(recortar(t, normal, 9, col.ancho), col.x, y, 9);
    });
    y -= 15;
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`Página ${i + 1} de ${paginas.length}`, { x: ANCHO - M - 70, y: 24, size: 8, font: normal, color: gris });
  });

  return pdf.save();
}
