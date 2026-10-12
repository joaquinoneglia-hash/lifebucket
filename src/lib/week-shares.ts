import { bondWeekMinutes, funWeekMinutes } from "./bonds";
import { addDays, startOfWeek, toKey, type DateKey } from "./dates";
import type { SleepSettings } from "./sleep";
import { sleepStats } from "./sleep-stats";
import type { Moment, RoutineBlock } from "./store";

/** El calendario va de 05:00 a 24:00 (19 h por día). */
export const DAY_MINUTES = 19 * 60;
/** Los % son sobre la semana entera (168 h): el sueño es una parte más. */
export const WEEK_MINUTES = 168 * 60;

export type Part = "trabajo" | "cuerpo" | "mente" | "alma" | "vinculos" | "libre" | "sueno";
export const PARTS: { id: Part; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "cuerpo", label: "Cuerpo" },
  { id: "mente", label: "Mente" },
  { id: "alma", label: "Disfrute" },
  { id: "vinculos", label: "Vínculos" },
  { id: "libre", label: "Espacio libre" },
  { id: "sueno", label: "Sueño" },
];

/**
 * Minutos por semana de cada parte, sobre las 168 h. El Sueño sale de tu horario de dormir; Trabajo,
 * Cuerpo, Mente y Disfrute, de los bloques; los planes de Disfrute y los Vínculos del mes se pasan a horas
 * por semana; Libre es todo lo que queda despierto.
 */
export function weekMinutes(routine: RoutineBlock[], moments: Moment[], sleep?: SleepSettings): Record<Part, number> {
  const out: Record<Part, number> = { trabajo: 0, cuerpo: 0, mente: 0, alma: 0, vinculos: 0, libre: 0, sueno: 0 };
  out.sueno = sleep ? Math.round(sleepStats(sleep).weekHours * 60) : 0;
  const awake = WEEK_MINUTES - out.sueno;
  for (const b of routine) {
    const q = b.quadrant === "vinculos" ? "alma" : b.quadrant;
    if (q === "trabajo" || q === "cuerpo" || q === "mente" || q === "alma") out[q] += b.minutes * b.days.length;
  }
  const used = out.trabajo + out.cuerpo + out.mente + out.alma;
  out.vinculos = Math.min(bondWeekMinutes(moments), Math.max(0, awake - used));
  const fun = Math.min(funWeekMinutes(moments).minutes, Math.max(0, awake - used - out.vinculos));
  out.alma += fun;
  out.libre = Math.max(0, awake - used - out.vinculos - fun);
  return out;
}

/** Lo mismo en % de la semana (enteros). */
export function weekShares(routine: RoutineBlock[], moments: Moment[], sleep?: SleepSettings): Record<Part, number> {
  const m = weekMinutes(routine, moments, sleep);
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
