import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { calcularCumplimiento } from "@/lib/cumplimiento";
import { generarHistorialPdf } from "@/server/reportes/historial-pdf";
import type { FilaHistorial } from "@/server/services/mi-informacion-service";

const fila = (i: number, o: Partial<FilaHistorial> = {}): FilaHistorial => ({
  eventoId: `e-${i}`,
  titulo: `Asamblea número ${i}`,
  tipo: "asamblea",
  fecha: "2026-03-10",
  lugar: "Casa comunal",
  estado: "presente",
  motivo: null,
  ...o,
});

const datos = (items: FilaHistorial[]) => ({
  junta: "Junta de Riego Ñuñurco",
  socio: { nombres: "Ana Torres Muñoz", cedula: "1710000017" },
  emitidoEn: "2026-11-24",
  items,
  cumplimiento: calcularCumplimiento(items.map((i) => i.estado)),
});

describe("historial de asistencia en PDF (RF-15)", () => {
  it("genera un PDF válido que empieza por %PDF", async () => {
    const bytes = await generarHistorialPdf(datos([fila(1), fila(2, { estado: "justificado", motivo: "Viaje" })]));
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Historial de asistencia");
  });

  it("funciona sin eventos (cumplimiento «no aplica») y con caracteres fuera de WinAnsi", async () => {
    await expect(generarHistorialPdf(datos([]))).resolves.toBeInstanceOf(Uint8Array);
    const raro = fila(1, { titulo: "Asamblea 😀 ✓ 中文 \n con salto", motivo: "x".repeat(300) });
    const doc = await PDFDocument.load(await generarHistorialPdf(datos([raro])));
    expect(doc.getPageCount()).toBe(1);
  });

  it("pasa a más páginas cuando el historial es largo", async () => {
    const items = Array.from({ length: 120 }, (_, i) => fila(i + 1, { estado: i % 3 === 0 ? "ausente" : "presente" }));
    const doc = await PDFDocument.load(await generarHistorialPdf(datos(items)));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });
});
