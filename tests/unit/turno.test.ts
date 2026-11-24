import { describe, expect, it } from "vitest";
import { ahoraEcuador, proximosTurnos, textoEn, type TurnoSemana } from "@/lib/calendario";
import { servicioSchema, turnoSchema } from "@/server/validation/servicio";

const U = "11111111-2222-4333-8444-555555555555";
const base = { servicioId: U, sectorId: U, diaSemana: "2", horaInicio: "20:00", horaFin: "22:00" };

describe("turnoSchema", () => {
  it("acepta un turno válido y convierte el día a número", () => {
    expect(turnoSchema.parse(base)).toMatchObject({ diaSemana: 2, horaInicio: "20:00", horaFin: "22:00" });
  });

  it("rechaza fin menor o igual al inicio", () => {
    expect(turnoSchema.safeParse({ ...base, horaFin: "20:00" }).success).toBe(false);
    expect(turnoSchema.safeParse({ ...base, horaFin: "19:59" }).success).toBe(false);
    expect(turnoSchema.safeParse({ ...base, horaInicio: "08:00", horaFin: "08:01" }).success).toBe(true);
  });

  it("valida el formato de hora y el día", () => {
    for (const h of ["24:00", "7:30", "12:60", "ab:cd", "", "12.30"]) {
      expect(turnoSchema.safeParse({ ...base, horaInicio: h, horaFin: "23:59" }).success, h).toBe(false);
    }
    for (const d of ["0", "8", "x", ""]) expect(turnoSchema.safeParse({ ...base, diaSemana: d }).success, d).toBe(false);
    for (const d of ["1", "7"]) expect(turnoSchema.safeParse({ ...base, diaSemana: d }).success, d).toBe(true);
  });

  it("exige sector válido", () => {
    expect(turnoSchema.safeParse({ ...base, sectorId: "" }).success).toBe(false);
  });
});

describe("servicioSchema", () => {
  it("exige nombre y tipo válido", () => {
    expect(servicioSchema.safeParse({ nombre: " Riego ", tipo: "agua_riego" }).success).toBe(true);
    expect(servicioSchema.safeParse({ nombre: " ", tipo: "agua_riego" }).success).toBe(false);
    expect(servicioSchema.safeParse({ nombre: "X", tipo: "inventado" }).success).toBe(false);
    expect(servicioSchema.safeParse({ nombre: "X".repeat(101), tipo: "otro" }).success).toBe(false);
  });
});

describe("ahoraEcuador", () => {
  it("convierte a día (1 = lunes) y minuto en UTC-5", () => {
    // lunes 2026-11-23 15:30 UTC = 10:30 en Ecuador
    expect(ahoraEcuador(new Date("2026-11-23T15:30:00Z"))).toEqual({ dia: 1, minuto: 630 });
    // lunes 03:00 UTC = domingo 22:00 en Ecuador
    expect(ahoraEcuador(new Date("2026-11-23T03:00:00Z"))).toEqual({ dia: 7, minuto: 1320 });
  });
});

const t = (id: string, dia: number, inicio: string, fin: string, servicio = "Riego"): TurnoSemana => ({ id, servicio, dia, inicio, fin });

describe("proximosTurnos", () => {
  // lunes 10:30 en Ecuador
  const ahora = new Date("2026-11-23T15:30:00Z");

  it("ordena por lo que falta, con la semana circular", () => {
    const r = proximosTurnos([t("a", 1, "08:00", "09:00"), t("b", 2, "09:00", "10:00"), t("c", 1, "20:00", "22:00")], ahora, 3);
    expect(r.map((x) => x.id)).toEqual(["c", "b", "a"]); // lunes 20:00, martes 09:00 y, dando la vuelta, lunes 08:00
    expect(r[0]).toMatchObject({ enCurso: false, enMinutos: 9 * 60 + 30 });
    expect(r[2]!.enMinutos).toBe(7 * 24 * 60 - 150);
  });

  it("marca el turno en curso con 0 minutos", () => {
    const r = proximosTurnos([t("a", 1, "10:00", "11:00"), t("b", 1, "12:00", "13:00")], ahora);
    expect(r[0]).toMatchObject({ id: "a", enCurso: true, enMinutos: 0 });
    expect(r[1]).toMatchObject({ id: "b", enCurso: false, enMinutos: 90 });
  });

  it("el fin es exclusivo: a la hora exacta de fin ya no está en curso", () => {
    const fin = new Date("2026-11-23T16:00:00Z"); // 11:00
    expect(proximosTurnos([t("a", 1, "10:00", "11:00")], fin)[0]?.enCurso).toBe(false);
  });

  it("limita a n resultados y no falla sin turnos", () => {
    expect(proximosTurnos([], ahora)).toEqual([]);
    expect(proximosTurnos([t("a", 1, "11:00", "12:00"), t("b", 1, "12:00", "13:00"), t("c", 1, "13:00", "14:00"), t("d", 1, "14:00", "15:00")], ahora, 2)).toHaveLength(2);
  });
});

describe("textoEn", () => {
  it("formatea el tiempo restante", () => {
    expect(textoEn(0, true)).toBe("en curso");
    expect(textoEn(45, false)).toBe("en 45 min");
    expect(textoEn(120, false)).toBe("en 2 h");
    expect(textoEn(200, false)).toBe("en 3 h 20 min");
    expect(textoEn(1440, false)).toBe("en 1 día");
    expect(textoEn(3000, false)).toBe("en 2 días");
  });
});
