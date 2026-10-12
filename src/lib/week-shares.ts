import { addDays, fromKey, startOfWeek, toKey, type DateKey } from "./dates";
import type { SleepSettings } from "./sleep";
import { sleepStats } from "./sleep-stats";
import type { Logro, RoutineBlock } from "./store";

/** El calendario va de 05:00 a 24:00 (19 h por día). */
export const DAY_MINUTES = 19 * 60;
/** Los % son sobre la semana entera (168 h): el sueño es una parte más. */
export const WEEK_MINUTES = 168 * 60;

export type Part = "trabajo" | "cuerpo" | "interior" | "alma" | "mente" | "vinculos" | "libre" | "sueno";
export const PARTS: { id: Part; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "cuerpo", label: "Deporte" },
  { id: "interior", label: "Mente y Alma" },
  { id: "alma", label: "Hobbies y disfrute" },
  { id: "mente", label: "Habilidades" },
  { id: "vinculos", label: "Vínculos" },
  { id: "libre", label: "Libre" },
  { id: "sueno", label: "Sueño" },
];
/** Lo que se trabaja y se juega (la base es Trabajo, Libre y Sueño). */
export const ACTIVE_PARTS: Part[] = ["cuerpo", "interior", "alma", "mente", "vinculos"];

const empty = (): Record<Part, number> => ({ trabajo: 0, cuerpo: 0, interior: 0, alma: 0, mente: 0, vinculos: 0, libre: 0, sueno: 0 });

/** Suma bloques (repetidos `factor` veces), logros y sueño; lo que queda despierto es Libre. */
function fill(routine: RoutineBlock[], logros: Logro[], sleepMinutes: number, total: number, factor: number): Record<Part, number> {
  const out = empty();
  out.sueno = sleepMinutes;
  for (const b of routine) if (b.quadrant !== "libre") out[b.quadrant] += b.minutes * b.days.length * factor;
  for (const l of logros) out[l.category] += l.minutes;
  const used = out.trabajo + ACTIVE_PARTS.reduce((acc, p) => acc + out[p], 0);
  out.libre = Math.max(0, total - out.sueno - used);
  for (const p of Object.keys(out) as Part[]) out[p] = Math.round(out[p]);
  return out;
}

/**
 * Minutos de cada parte en una semana (168 h): la semana tipo (los bloques que se repiten) más los logros
 * que cargaste esa semana. El Sueño sale de tu horario de dormir; Libre es todo lo que queda despierto.
 */
export function weekMinutes(routine: RoutineBlock[], logros: Logro[], sleep?: SleepSettings, monday: DateKey = thisMonday()): Record<Part, number> {
  const end = toKey(addDays(fromKey(monday), 6));
  const inWeek = logros.filter((l) => l.date >= monday && l.date <= end);
  return fill(routine, inWeek, sleep ? sleepStats(sleep).weekHours * 60 : 0, WEEK_MINUTES, 1);
}

/** Lo mismo para un mes ("2026-10"): la semana tipo se repite en sus semanas y se suman los logros del mes. */
export function monthMinutes(routine: RoutineBlock[], logros: Logro[], sleep: SleepSettings | undefined, month: string): { minutes: Record<Part, number>; total: number } {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const total = days * 24 * 60;
  const factor = days / 7;
  const inMonth = logros.filter((l) => l.date.startsWith(month));
  return { minutes: fill(routine, inMonth, sleep ? sleepStats(sleep).weekHours * 60 * factor : 0, total, factor), total };
}

/** Lo mismo en % de la semana (enteros). */
export function weekShares(routine: RoutineBlock[], logros: Logro[], sleep?: SleepSettings, monday?: DateKey): Record<Part, number> {
  const m = weekMinutes(routine, logros, sleep, monday);
  return Object.fromEntries(PARTS.map((p) => [p.id, Math.round((m[p.id] / WEEK_MINUTES) * 100)])) as Record<Part, number>;
}

/** El color de cada parte (Libre en gris, Sueño en azul noche). */
export const partColor = (p: Part) => (p === "libre" ? "#aab1be" : p === "sueno" ? "var(--color-sleep)" : `var(--color-${p})`);

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
