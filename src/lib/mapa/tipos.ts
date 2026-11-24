/**
 * Tipos mínimos de la Maps JavaScript API que usa la aplicación. Se declaran aquí para no depender de
 * un paquete de tipos externo: solo lo necesario para mostrar marcadores y ajustar la vista.
 */
export interface PuntoMapa {
  lat: number;
  lng: number;
}

export interface MapaGoogle {
  fitBounds(limites: unknown, relleno?: number): void;
  setCenter(punto: PuntoMapa): void;
  setZoom(zoom: number): void;
}

export interface MarcadorGoogle {
  addListener(evento: string, fn: () => void): unknown;
  setMap(mapa: MapaGoogle | null): void;
}

export interface LimitesGoogle {
  extend(punto: PuntoMapa): void;
}

export interface GoogleMapsApi {
  Map: new (elemento: HTMLElement, opciones: Record<string, unknown>) => MapaGoogle;
  Marker: new (opciones: Record<string, unknown>) => MarcadorGoogle;
  LatLngBounds: new () => LimitesGoogle;
}
