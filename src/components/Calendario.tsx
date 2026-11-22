import Link from "next/link";
import {
  diasDelMes,
  formatoMes,
  mesAnterior,
  mesSiguiente,
  MESES,
  primerDiaLunesBase,
  type MesCalendario,
} from "@/lib/fechas";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export interface EventoDia {
  dia: number;
  titulo: string;
}

/** Calendario mensual de solo lectura; la navegación usa el parámetro ?mes=AAAA-MM. */
export function Calendario({
  mes,
  hoy,
  eventos,
  ruta,
}: {
  mes: MesCalendario;
  /** Día de hoy si el mes mostrado es el actual. */
  hoy?: number;
  eventos: EventoDia[];
  ruta: string;
}) {
  const total = diasDelMes(mes);
  const vacios = primerDiaLunesBase(mes);
  const celdas: (number | null)[] = [...Array(vacios).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const porDia = new Map<number, string[]>();
  for (const e of eventos) porDia.set(e.dia, [...(porDia.get(e.dia) ?? []), e.titulo]);

  const nombreMes = MESES[mes.mes - 1] ?? "";
  const titulo = `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} de ${mes.anio}`;
  const prev = `${ruta}?mes=${formatoMes(mesAnterior(mes))}`;
  const sig = `${ruta}?mes=${formatoMes(mesSiguiente(mes))}`;
  const enlace = "rounded-lg border px-2.5 py-1 text-sm hover:bg-slate-100";

  return (
    <section aria-labelledby="cal-titulo" className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="cal-titulo" className="font-bold">
          {titulo}
        </h2>
        <nav aria-label="Cambiar de mes" className="flex gap-2">
          <Link href={prev} className={enlace} aria-label="Mes anterior">
            ←
          </Link>
          <Link href={ruta} className={enlace}>
            Hoy
          </Link>
          <Link href={sig} className={enlace} aria-label="Mes siguiente">
            →
          </Link>
        </nav>
      </div>

      <table className="w-full table-fixed text-center text-sm">
        <caption className="sr-only">Calendario de {titulo}</caption>
        <thead>
          <tr>
            {DIAS.map((d, i) => (
              <th key={d} scope="col" abbr={DIAS_LARGOS[i]} className="py-1 text-xs font-semibold text-slate-600">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: celdas.length / 7 }, (_, fila) => (
            <tr key={fila}>
              {celdas.slice(fila * 7, fila * 7 + 7).map((dia, i) => {
                const evs = dia ? porDia.get(dia) : undefined;
                const esHoy = dia !== null && dia === hoy;
                return (
                  <td key={i} className="p-0.5">
                    {dia ? (
                      <div
                        title={evs?.join(", ")}
                        aria-current={esHoy ? "date" : undefined}
                        className={`mx-auto flex size-9 items-center justify-center rounded-lg ${
                          esHoy ? "bg-teal-700 font-bold text-white" : evs ? "bg-amber-100 font-semibold" : ""
                        }`}
                      >
                        {dia}
                        {evs ? <span className="sr-only">: {evs.join(", ")}</span> : null}
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {eventos.length === 0 ? (
        <p className="mt-3 text-xs text-slate-600">No hay eventos registrados en este mes.</p>
      ) : null}
    </section>
  );
}
