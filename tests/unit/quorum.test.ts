import { describe, expect, it } from "vitest";
import { resumirAsistencia, type EstadoAsistenciaValor } from "@/lib/quorum";

const lista = (p: number, a: number, j: number): EstadoAsistenciaValor[] => [
  ...Array<EstadoAsistenciaValor>(p).fill("presente"),
  ...Array<EstadoAsistenciaValor>(a).fill("ausente"),
  ...Array<EstadoAsistenciaValor>(j).fill("justificado"),
];

describe("resumirAsistencia", () => {
  it("cuenta presentes, ausentes y justificados y calcula el porcentaje", () => {
    const r = resumirAsistencia(lista(2, 1, 1), 50);
    expect(r).toMatchObject({ total: 4, presentes: 2, ausentes: 1, justificados: 1, porcentaje: 50 });
  });

  it("el quórum se alcanza exactamente en el límite", () => {
    expect(resumirAsistencia(lista(2, 2, 0), 50).alcanzaQuorum).toBe(true); // 50 % de 50 %
    expect(resumirAsistencia(lista(1, 2, 0), 50).alcanzaQuorum).toBe(false); // 33,3 %
  });

  it("las justificaciones no cuentan como presentes para el quórum", () => {
    const r = resumirAsistencia(lista(1, 0, 3), 50);
    expect(r.porcentaje).toBe(25);
    expect(r.alcanzaQuorum).toBe(false);
  });

  it("una lista vacía no tiene porcentaje ni quórum y no falla", () => {
    expect(resumirAsistencia([], 50)).toMatchObject({ total: 0, porcentaje: null, alcanzaQuorum: false });
  });

  it("con quórum del 100 % y un solo socio funciona", () => {
    expect(resumirAsistencia(["presente"], 100).alcanzaQuorum).toBe(true);
    expect(resumirAsistencia(["ausente"], 100).alcanzaQuorum).toBe(false);
    expect(resumirAsistencia(["justificado"], 100).alcanzaQuorum).toBe(false);
  });

  it("redondea el porcentaje a un decimal y evita errores de coma flotante", () => {
    expect(resumirAsistencia(lista(1, 2, 0), 30).porcentaje).toBe(33.3);
    expect(resumirAsistencia(lista(2, 1, 0), 30).porcentaje).toBe(66.7);
    // 7 de 10 con quórum 70: debe alcanzarse exactamente
    expect(resumirAsistencia(lista(7, 3, 0), 70).alcanzaQuorum).toBe(true);
    expect(resumirAsistencia(lista(29, 71, 0), 29).alcanzaQuorum).toBe(true);
  });

  it("acepta cualquier iterable", () => {
    expect(resumirAsistencia(new Set<EstadoAsistenciaValor>(["presente", "ausente"]), 10).total).toBe(2);
  });
});
