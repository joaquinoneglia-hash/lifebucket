import { addDays, fromKey, toKey, type DateKey } from "./dates";
import type { Block } from "./store";
import { STEP } from "./time";

/** Horario de sueño: a qué hora te acostás y a qué hora te levantás (minutos; acostarse puede pasar de 1440). */
export interface SleepWindow {
  bed: number;
  wake: number;
}

export interface SleepSettings {
  weekday: SleepWindow;
  weekend: SleepWindow;
  /** Cambios para un día puntual: a qué hora te levantás ese día y te acostás esa noche. */
  overrides?: Record<DateKey, SleepWindow>;
}

export const DEFAULT_SLEEP: SleepSettings = {
  weekday: { bed: 22 * 60, wake: 7 * 60 },
  weekend: { bed: 23 * 60, wake: 9 * 60 },
};

/** Cómo resultó una noche, según lo que marcás en el ritual. */
export type NightResult = "ok" | "late" | "short";

/**
 * Tu ventana despierto en un día: te levantás con el horario de ese día (finde si es sábado
 * o domingo) y te acostás con el de esa noche (finde si es viernes o sábado).
 */
export function awakeWindow(date: DateKey, s: SleepSettings): { wake: number; bed: number } {
  const custom = s.overrides?.[date];
  if (custom) return { wake: custom.wake, bed: Math.max(custom.bed, custom.wake + 60) };
  const dow = fromKey(date).getDay();
  const wake = dow === 0 || dow === 6 ? s.weekend.wake : s.weekday.wake;
  const bed = dow === 5 || dow === 6 ? s.weekend.bed : s.weekday.bed;
  return { wake, bed: Math.max(bed, wake + 60) };
}

/** Rango de la grilla: de la hora más temprana en que te levantás a la más tarde en que te acostás. */
export function gridRange(s: SleepSettings, days: DateKey[] = []): { start: number; end: number } {
  const custom = days.map((d) => s.overrides?.[d]).filter((w): w is SleepWindow => !!w);
  const wakes = [s.weekday.wake, s.weekend.wake, ...custom.map((w) => w.wake)];
  const beds = [s.weekday.bed, s.weekend.bed, ...custom.map((w) => w.bed)];
  const start = Math.max(0, Math.floor(Math.min(...wakes) / 60) * 60);
  const end = Math.min(26 * 60, Math.ceil(Math.max(...beds) / 60) * 60);
  return { start, end: Math.max(end, start + 8 * 60) };
}

export const sleepMinutes = (w: SleepWindow) => (w.wake + 24 * 60 - w.bed + 24 * 60) % (24 * 60);

/** Minutos de sueño de un período: lo que queda del día fuera de tu ventana despierto. */
export function sleepTotal(days: DateKey[], s: SleepSettings): number {
  return days.reduce((acc, d) => {
    const { wake, bed } = awakeWindow(d, s);
    return acc + Math.max(0, 24 * 60 - (bed - wake));
  }, 0);
}

export const isWeekendDay = (date: DateKey) => {
  const dow = fromKey(date).getDay();
  return dow === 0 || dow === 6;
};

export const LIBRE_PREFIX = "libre:";
export const isVirtual = (b: Block) => b.id.startsWith(LIBRE_PREFIX);

/**
 * Todo minuto despierto está asignado: lo que no es una actividad es Libre.
 * Devuelve los bloques Libre que llenan los huecos de un día.
 */
export function libreFill(date: DateKey, dayBlocks: Block[], s: SleepSettings): Block[] {
  const { wake, bed } = awakeWindow(date, s);
  const spans = dayBlocks
    .map((b) => [Math.max(b.start, wake), Math.min(b.start + b.minutes, bed)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: Block[] = [];
  let cursor = wake;
  const push = (from: number, to: number) => {
    // Los huecos se alinean a la grilla de 30 min.
    const start = Math.ceil(from / STEP) * STEP;
    const end = Math.floor(to / STEP) * STEP;
    if (end - start < STEP) return;
    out.push({
      id: `${LIBRE_PREFIX}${date}:${start}`,
      title: "Libre",
      quadrant: "libre",
      minutes: end - start,
      date,
      start,
      status: "pending",
      order: 0,
    });
  };
  for (const [a, b] of spans) {
    if (a > cursor) push(cursor, a);
    cursor = Math.max(cursor, b);
  }
  if (bed > cursor) push(cursor, bed);
  return out;
}

/** Los bloques de esos días más los Libre que completan cada día. */
export function withLibre(blocks: Block[], days: DateKey[], s: SleepSettings): Block[] {
  const byDay = new Map<DateKey, Block[]>();
  for (const b of blocks) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);
  return [...blocks, ...days.flatMap((d) => libreFill(d, byDay.get(d) ?? [], s))];
}

export function daysBetween(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = fromKey(start); toKey(d) <= end; d = addDays(d, 1)) out.push(toKey(d));
  return out;
}
