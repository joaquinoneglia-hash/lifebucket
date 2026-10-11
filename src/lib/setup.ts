import { addDays, fromKey, startOfWeek, toKey, type DateKey } from "./dates";
import type { QuadrantId } from "./quadrants";
import { awakeWindow, libreFill, type SleepSettings } from "./sleep";
import { usePlanner, type Block, type Job, type RepeatDays } from "./store";

export interface Recurring {
  activityName: string;
  quadrant: QuadrantId;
  days: RepeatDays;
  start: number;
  minutes: number;
}

/** El primer día desde hoy que cae en alguno de esos días de la semana. */
export function nextDateFor(days: RepeatDays, from = new Date()): DateKey {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (days.includes(d.getDay())) return toKey(d);
  }
  return toKey(from);
}

/** Crea algo que se repite (y su actividad si no existe). */
export function addRecurring(r: Recurring) {
  const store = usePlanner.getState();
  const activity = store.addActivity(r.quadrant, r.activityName);
  store.addBlock(
    {
      title: activity.name,
      quadrant: activity.quadrant,
      activityId: activity.id,
      minutes: r.minutes,
      date: nextDateFor(r.days),
      start: r.start,
    },
    r.days,
  );
}

export const jobMinutes = (jobs: Job[]) => jobs.reduce((acc, j) => acc + Math.max(0, j.end - j.start) * j.days.length, 0);

/** Minutos despierto en una semana típica según tu horario de sueño. */
export function awakeWeekMinutes(sleep: SleepSettings, now = new Date()): number {
  const monday = startOfWeek(now);
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const { wake, bed } = awakeWindow(toKey(addDays(monday, i)), { ...sleep, overrides: undefined });
    total += bed - wake;
  }
  return total;
}

export interface Gap {
  date: DateKey;
  start: number;
  minutes: number;
}

/** Los espacios que quedaron vacíos (Libre) en esa semana, desde hoy, de al menos una hora. */
export function freeGaps(blocks: Block[], sleep: SleepSettings, week: DateKey, now = new Date()): Gap[] {
  const today = toKey(now);
  const monday = fromKey(week);
  const out: Gap[] = [];
  const minute = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < 7; i++) {
    const date = toKey(addDays(monday, i));
    if (date < today) continue;
    const dayBlocks = blocks.filter((b) => b.date === date);
    for (const f of libreFill(date, dayBlocks, sleep)) {
      // Hoy, solo lo que todavía no pasó.
      const start = date === today ? Math.max(f.start, Math.ceil(minute / 30) * 30) : f.start;
      const minutes = f.start + f.minutes - start;
      if (minutes >= 60) out.push({ date, start, minutes });
    }
  }
  return out;
}
