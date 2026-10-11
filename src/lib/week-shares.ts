import { bondWeekMinutes, funWeekMinutes } from "./bonds";
import { addDays, startOfWeek, toKey, type DateKey } from "./dates";
import type { Moment, RoutineBlock } from "./store";

/** La semana tipo va de 05:00 a 24:00: 19 h por día, 133 h por semana. */
export const DAY_MINUTES = 19 * 60;
export const WEEK_MINUTES = DAY_MINUTES * 7;

export type Part = "trabajo" | "cuerpo" | "mente" | "alma" | "vinculos" | "libre";
export const PARTS: { id: Part; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "cuerpo", label: "Cuerpo" },
  { id: "mente", label: "Mente" },
  { id: "alma", label: "Disfrute" },
  { id: "vinculos", label: "Vínculos" },
  { id: "libre", label: "Espacio libre" },
];

/**
 * Minutos por semana de cada parte. Trabajo, Cuerpo, Mente y Disfrute salen de los bloques; los planes
 * de Disfrute y los Vínculos del mes se pasan a horas por semana; Libre es todo lo que queda.
 */
export function weekMinutes(routine: RoutineBlock[], moments: Moment[]): Record<Part, number> {
  const out: Record<Part, number> = { trabajo: 0, cuerpo: 0, mente: 0, alma: 0, vinculos: 0, libre: 0 };
  for (const b of routine) {
    const q = b.quadrant === "vinculos" ? "alma" : b.quadrant;
    if (q === "trabajo" || q === "cuerpo" || q === "mente" || q === "alma") out[q] += b.minutes * b.days.length;
  }
  const used = out.trabajo + out.cuerpo + out.mente + out.alma;
  out.vinculos = Math.min(bondWeekMinutes(moments), Math.max(0, WEEK_MINUTES - used));
  const fun = Math.min(funWeekMinutes(moments).minutes, Math.max(0, WEEK_MINUTES - used - out.vinculos));
  out.alma += fun;
  out.libre = Math.max(0, WEEK_MINUTES - used - out.vinculos - fun);
  return out;
}

/** Lo mismo en % de la semana (enteros). */
export function weekShares(routine: RoutineBlock[], moments: Moment[]): Record<Part, number> {
  const m = weekMinutes(routine, moments);
  return Object.fromEntries(PARTS.map((p) => [p.id, Math.round((m[p.id] / WEEK_MINUTES) * 100)])) as Record<Part, number>;
}

/** El lunes de esta semana (la clave de cada semana en el reporte). */
export const thisMonday = (d = new Date()): DateKey => toKey(startOfWeek(d));

const fmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
/** "12 – 18 oct" */
export function weekRangeLabel(monday: DateKey): string {
  const start = new Date(`${monday}T00:00:00`);
  const end = addDays(start, 6);
  const a = fmt.format(start).replace(".", "");
  const b = fmt.format(end).replace(".", "");
  return start.getMonth() === end.getMonth() ? `${start.getDate()} – ${b}` : `${a} – ${b}`;
}
