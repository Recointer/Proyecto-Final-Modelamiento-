import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cargarGoogleMaps,
  ErrorMapa,
  reiniciarCargador,
  type EntornoMapa,
  type ScriptSimple,
} from "@/lib/mapa/cargar-google-maps";

function entornoFalso() {
  const scripts: ScriptSimple[] = [];
  const entorno: EntornoMapa = {
    documento: {
      createElement: () => ({ src: "", async: false, onerror: null }),
      head: { appendChild: (s) => void scripts.push(s) },
    },
    ventana: {},
  };
  return { entorno, scripts };
}

const MAPS = { Map: class {}, Marker: class {}, LatLngBounds: class {} };

async function codigoDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof ErrorMapa ? e.codigo : "OTRO";
  }
  return "SIN_ERROR";
}

beforeEach(() => {
  reiniciarCargador();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("cargarGoogleMaps", () => {
  it("sin clave falla de inmediato y no inserta ningún script", async () => {
    const { entorno, scripts } = entornoFalso();
    expect(await codigoDe(cargarGoogleMaps({ entorno }))).toBe("SIN_CLAVE");
    expect(await codigoDe(cargarGoogleMaps({ clave: "", entorno }))).toBe("SIN_CLAVE");
    expect(scripts).toHaveLength(0);
  });

  it("inserta un solo script con la clave y el callback, y resuelve al cargarse", async () => {
    const { entorno, scripts } = entornoFalso();
    const p = cargarGoogleMaps({ clave: "mi clave&x", mapId: "mi-mapa", entorno });
    expect(scripts).toHaveLength(1);
    const url = new URL(scripts[0]!.src);
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/js");
    expect(url.searchParams.get("key")).toBe("mi clave&x"); // codificada correctamente
    expect(url.searchParams.get("callback")).toBe("__multijuntaMapaListo");
    expect(url.searchParams.get("map_ids")).toBe("mi-mapa");
    expect(url.searchParams.get("libraries")).toBe("marker");

    entorno.ventana.google = { maps: MAPS };
    (entorno.ventana.__multijuntaMapaListo as () => void)();
    await expect(p).resolves.toBe(MAPS);
  });

  it("varias llamadas simultáneas comparten una sola carga", async () => {
    const { entorno, scripts } = entornoFalso();
    const a = cargarGoogleMaps({ clave: "k", entorno });
    const b = cargarGoogleMaps({ clave: "k", entorno });
    expect(a).toBe(b);
    expect(scripts).toHaveLength(1);
    entorno.ventana.google = { maps: MAPS };
    (entorno.ventana.__multijuntaMapaListo as () => void)();
    await a;
  });

  it("si la API ya está cargada, la devuelve sin insertar scripts", async () => {
    const { entorno, scripts } = entornoFalso();
    entorno.ventana.google = { maps: MAPS };
    await expect(cargarGoogleMaps({ clave: "k", entorno })).resolves.toBe(MAPS);
    expect(scripts).toHaveLength(0);
  });

  it("un error de red rechaza con ERROR_RED y permite reintentar", async () => {
    const { entorno, scripts } = entornoFalso();
    const p = cargarGoogleMaps({ clave: "k", entorno });
    scripts[0]!.onerror?.();
    expect(await codigoDe(p)).toBe("ERROR_RED");
    expect(entorno.ventana.__multijuntaMapaListo).toBeUndefined();

    const reintento = cargarGoogleMaps({ clave: "k", entorno });
    expect(scripts).toHaveLength(2); // vuelve a intentarlo
    entorno.ventana.google = { maps: MAPS };
    (entorno.ventana.__multijuntaMapaListo as () => void)();
    await expect(reintento).resolves.toBe(MAPS);
  });

  it("rechaza con TIMEOUT si pasan 8 segundos sin cargar", async () => {
    const { entorno } = entornoFalso();
    const p = cargarGoogleMaps({ clave: "k", entorno });
    const resultado = codigoDe(p);
    await vi.advanceTimersByTimeAsync(7999);
    await vi.advanceTimersByTimeAsync(2);
    expect(await resultado).toBe("TIMEOUT");
  });

  it("respeta un tiempo máximo personalizado y no falla después de cargar", async () => {
    const { entorno } = entornoFalso();
    const p = cargarGoogleMaps({ clave: "k", timeoutMs: 1000, entorno });
    entorno.ventana.google = { maps: MAPS };
    (entorno.ventana.__multijuntaMapaListo as () => void)();
    await vi.advanceTimersByTimeAsync(5000); // el temporizador ya se canceló
    await expect(p).resolves.toBe(MAPS);
  });

  it("si el callback se invoca sin la API, falla con ERROR_RED", async () => {
    const { entorno } = entornoFalso();
    const p = cargarGoogleMaps({ clave: "k", entorno });
    (entorno.ventana.__multijuntaMapaListo as () => void)();
    expect(await codigoDe(p)).toBe("ERROR_RED");
  });

  it("registra el aviso de fallo de autenticación de Google", async () => {
    const { entorno } = entornoFalso();
    const alFallar = vi.fn();
    const p = cargarGoogleMaps({ clave: "k", alFallarAutenticacion: alFallar, entorno });
    (entorno.ventana.gm_authFailure as () => void)();
    expect(alFallar).toHaveBeenCalledOnce();
    entorno.ventana.google = { maps: MAPS };
    (entorno.ventana.__multijuntaMapaListo as () => void)();
    await p;
  });
});
