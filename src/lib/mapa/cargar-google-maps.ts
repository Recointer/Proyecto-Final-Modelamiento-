import type { GoogleMapsApi } from "./tipos";

export type CodigoErrorMapa = "SIN_CLAVE" | "ERROR_RED" | "TIMEOUT";

export class ErrorMapa extends Error {
  constructor(public readonly codigo: CodigoErrorMapa) {
    super(codigo);
    this.name = "ErrorMapa";
  }
}

/** Lo mínimo del navegador que usa el cargador (inyectable para las pruebas). */
export interface EntornoMapa {
  documento: {
    createElement(tag: "script"): ScriptSimple;
    head: { appendChild(nodo: ScriptSimple): unknown };
  };
  ventana: Record<string, unknown>;
}

export interface ScriptSimple {
  src: string;
  async: boolean;
  defer?: boolean;
  onerror: ((e?: unknown) => void) | null;
  remove?: () => void;
}

export interface OpcionesCarga {
  /** Clave de la Maps JavaScript API (pública; debe restringirse por referente HTTP en Google Cloud). */
  clave?: string;
  mapId?: string;
  /** Tiempo máximo de espera (por defecto 8 s). */
  timeoutMs?: number;
  /** Se invoca si Google rechaza la clave después de cargar (gm_authFailure). */
  alFallarAutenticacion?: () => void;
  entorno?: EntornoMapa;
}

const CALLBACK = "__multijuntaMapaListo";
let enCurso: Promise<GoogleMapsApi> | null = null;

/** Solo para pruebas: descarta la carga en curso. */
export function reiniciarCargador(): void {
  enCurso = null;
}

function entornoPorDefecto(): EntornoMapa {
  return {
    documento: document as unknown as EntornoMapa["documento"],
    ventana: window as unknown as Record<string, unknown>,
  };
}

/**
 * Carga la Maps JavaScript API una sola vez. Falla con ErrorMapa si no hay clave, hay un error de red
 * o se supera el tiempo máximo: el llamador debe degradar a la lista de predios con coordenadas, el mapa
 * nunca debe bloquear el trabajo (FR-014).
 */
export function cargarGoogleMaps(opciones: OpcionesCarga = {}): Promise<GoogleMapsApi> {
  const { clave, mapId, timeoutMs = 8000, alFallarAutenticacion } = opciones;
  if (!clave) return Promise.reject(new ErrorMapa("SIN_CLAVE"));

  const { documento, ventana } = opciones.entorno ?? entornoPorDefecto();
  const yaCargada = (ventana.google as { maps?: GoogleMapsApi } | undefined)?.maps;
  if (yaCargada?.Map) return Promise.resolve(yaCargada);
  if (enCurso) return enCurso;

  if (alFallarAutenticacion) ventana.gm_authFailure = alFallarAutenticacion;

  enCurso = new Promise<GoogleMapsApi>((resolver, rechazar) => {
    const fallar = (codigo: CodigoErrorMapa) => {
      clearTimeout(temporizador);
      delete ventana[CALLBACK];
      enCurso = null; // permite reintentar
      rechazar(new ErrorMapa(codigo));
    };
    const temporizador = setTimeout(() => fallar("TIMEOUT"), timeoutMs);

    ventana[CALLBACK] = () => {
      clearTimeout(temporizador);
      const api = (ventana.google as { maps?: GoogleMapsApi } | undefined)?.maps;
      if (api) resolver(api);
      else fallar("ERROR_RED");
    };

    const script = documento.createElement("script");
    const params = new URLSearchParams({ key: clave, loading: "async", libraries: "marker", callback: CALLBACK, v: "weekly" });
    if (mapId) params.set("map_ids", mapId);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => fallar("ERROR_RED");
    documento.head.appendChild(script);
  });
  return enCurso;
}
