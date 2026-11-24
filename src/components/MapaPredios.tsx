"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cargarGoogleMaps, ErrorMapa } from "@/lib/mapa/cargar-google-maps";
import type { MapaGoogle, MarcadorGoogle } from "@/lib/mapa/tipos";

export interface PuntoPredio {
  id: string;
  codigo: string;
  nombre: string;
  lat: number;
  lng: number;
  sectorNombre: string;
  superficieHa: number;
}

type EstadoMapa = "cargando" | "listo" | "sin-clave" | "error" | "tiempo" | "clave-rechazada";

const AVISOS: Record<Exclude<EstadoMapa, "cargando" | "listo">, string> = {
  "sin-clave": "No hay una clave de Google Maps configurada.",
  error: "No se pudo cargar Google Maps (sin conexión o bloqueado).",
  tiempo: "Google Maps tardó demasiado en responder.",
  "clave-rechazada": "Google Maps rechazó la clave configurada.",
};

const enlaceGoogle = (p: PuntoPredio) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
const formato = (n: number) => String(n).replace(".", ",");

/**
 * Mapa de predios con degradación: la lista con coordenadas se muestra SIEMPRE (alternativa accesible y
 * respaldo), y el mapa de Google se añade encima solo si se pudo cargar. Nunca bloquea el trabajo.
 */
export function MapaPredios({ puntos, altura = "h-80" }: { puntos: PuntoPredio[]; altura?: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const marcadores = useRef<Map<string, MarcadorGoogle>>(new Map());
  const [estado, setEstado] = useState<EstadoMapa>(puntos.length === 0 ? "listo" : "cargando");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  useEffect(() => {
    if (puntos.length === 0) return;
    let cancelado = false;
    let mapa: MapaGoogle | null = null;
    const usados = marcadores.current;

    cargarGoogleMaps({
      clave: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined,
      alFallarAutenticacion: () => !cancelado && setEstado("clave-rechazada"),
    })
      .then((api) => {
        if (cancelado || !contenedor.current) return;
        mapa = new api.Map(contenedor.current, {
          center: { lat: puntos[0]!.lat, lng: puntos[0]!.lng },
          zoom: 15,
          mapTypeControl: true,
        });
        const limites = new api.LatLngBounds();
        for (const p of puntos) {
          const m = new api.Marker({ position: { lat: p.lat, lng: p.lng }, map: mapa, title: `${p.codigo} · ${p.nombre}` });
          m.addListener("click", () => setSeleccionado(p.id));
          usados.set(p.id, m);
          limites.extend({ lat: p.lat, lng: p.lng });
        }
        if (puntos.length > 1) mapa.fitBounds(limites, 48);
        setEstado("listo");
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        const codigo = e instanceof ErrorMapa ? e.codigo : "ERROR_RED";
        setEstado(codigo === "SIN_CLAVE" ? "sin-clave" : codigo === "TIMEOUT" ? "tiempo" : "error");
      });

    return () => {
      cancelado = true;
      for (const m of usados.values()) m.setMap(null);
      usados.clear();
    };
  }, [puntos]);

  const elegido = puntos.find((p) => p.id === seleccionado) ?? null;
  const hayMapa = estado === "listo" && puntos.length > 0;
  const aviso = estado !== "cargando" && estado !== "listo" ? AVISOS[estado] : null;

  return (
    <section aria-labelledby="mapa-titulo" className="space-y-3">
      <h2 id="mapa-titulo" className="font-bold">Mapa de predios</h2>

      {puntos.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-600">
          No hay predios con coordenadas para mostrar.
        </p>
      ) : (
        <>
          {aviso ? (
            <p role="status" data-testid="aviso-mapa" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {aviso} Se muestra la lista de predios con sus coordenadas.
            </p>
          ) : null}
          {estado === "cargando" ? <p role="status" className="text-sm text-slate-600">Cargando el mapa…</p> : null}

          {/* el contenedor existe siempre para que el mapa pueda montarse; se oculta si no se carga */}
          <div
            ref={contenedor}
            role="region"
            aria-label="Mapa interactivo de predios"
            data-testid="mapa"
            className={`${altura} w-full overflow-hidden rounded-xl border bg-slate-100 ${hayMapa ? "" : "hidden"}`}
          />

          {elegido ? (
            <div data-testid="ficha-mapa" className="rounded-xl border bg-white p-4 text-sm">
              <p className="font-semibold">{elegido.codigo} · {elegido.nombre}</p>
              <p className="text-slate-600">
                Sector {elegido.sectorNombre} · {formato(elegido.superficieHa)} ha · {formato(elegido.lat)}, {formato(elegido.lng)}
              </p>
              <Link href={`/predios/${elegido.id}`} className="mt-1 inline-block text-teal-800 underline">Ver ficha del predio</Link>
            </div>
          ) : null}

          <div className="relative overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Predios con coordenadas</caption>
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2">Predio</th>
                  <th scope="col" className="px-4 py-2">Sector</th>
                  <th scope="col" className="px-4 py-2">Coordenadas</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {puntos.map((p) => (
                  <tr key={p.id} className={p.id === seleccionado ? "bg-teal-50" : undefined}>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => setSeleccionado(p.id)} aria-pressed={p.id === seleccionado} className="text-left font-semibold text-teal-800 underline">
                        {p.codigo} · {p.nombre}
                      </button>
                    </td>
                    <td className="px-4 py-2">{p.sectorNombre}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formato(p.lat)}, {formato(p.lng)}</td>
                    <td className="px-4 py-2 text-right">
                      <a href={enlaceGoogle(p)} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">
                        Abrir en Google Maps<span className="sr-only"> ({p.codigo})</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
