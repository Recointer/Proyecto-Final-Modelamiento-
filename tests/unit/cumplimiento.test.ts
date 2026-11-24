import { describe, expect, it } from "vitest";
import { calcularCumplimiento, META_CUMPLIMIENTO } from "@/lib/cumplimiento";

describe("calcularCumplimiento", () => {
  it("es presentes sobre presentes más ausentes", () => {
    const c = calcularCumplimiento(["presente", "presente", "presente", "ausente"]);
    expect(c).toMatchObject({ presentes: 3, ausentes: 1, justificados: 0, computables: 4, porcentaje: 75 });
  });

  it("las justificadas ni penalizan ni suman", () => {
    const c = calcularCumplimiento(["presente", "justificado", "justificado", "ausente"]);
    expect(c).toMatchObject({ presentes: 1, ausentes: 1, justificados: 2, computables: 2, porcentaje: 50 });
    expect(calcularCumplimiento(["presente", "justificado"]).porcentaje).toBe(100);
  });

  it("sin eventos computables es «no aplica»", () => {
    for (const e of [[], ["justificado"], ["justificado", "justificado"]] as const) {
      const c = calcularCumplimiento(e);
      expect(c.porcentaje).toBeNull();
      expect(c.cumpleMeta).toBeNull();
    }
  });

  it("redondea a un decimal", () => {
    expect(calcularCumplimiento(["presente", "ausente", "ausente"]).porcentaje).toBe(33.3);
    expect(calcularCumplimiento(["presente", "presente", "ausente"]).porcentaje).toBe(66.7);
    expect(calcularCumplimiento(Array(7).fill("presente").concat(["ausente"])).porcentaje).toBe(87.5);
  });

  it("compara con la meta de referencia del 80 %", () => {
    expect(META_CUMPLIMIENTO).toBe(80);
    expect(calcularCumplimiento(["presente", "presente", "presente", "presente", "ausente"])).toMatchObject({ porcentaje: 80, cumpleMeta: true });
    expect(calcularCumplimiento(["presente", "presente", "presente", "ausente"]).cumpleMeta).toBe(false);
    expect(calcularCumplimiento(["presente"]).cumpleMeta).toBe(true);
    expect(calcularCumplimiento(["ausente"])).toMatchObject({ porcentaje: 0, cumpleMeta: false });
  });
});
