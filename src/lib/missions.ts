import { computeBalance, planGap } from "./balance";
import { addDays, fromKey, startOfWeek, toKey, type DateKey } from "./dates";
import { formatMinutes } from "./format";
import { QUADRANT_BY_ID, QUADRANTS, type QuadrantId, type QuadrantRecord } from "./quadrants";
import { inPeriod, periodBlocks } from "./report";
import type { Activity, Block } from "./store";
import { awakeWindow, type SleepSettings } from "./sleep";
import { nowMinutes, STEP } from "./time";

export interface MissionSlot {
  date: DateKey;
  start: number;
}

/** Una misión propuesta (todavía no aceptada). */
export interface MissionDraft {
  quadrant: QuadrantId;
  activityName: string;
  activityId?: string;
  title: string;
  why: string;
  minutes: number;
  slots: MissionSlot[];
}

/** Franjas donde cada cuadrante suele entrar mejor (en minutos desde la medianoche). */
const PREFERRED: QuadrantRecord<[number, number][]> = {
  cuerpo: [[7 * 60, 9 * 60], [18 * 60, 20 * 60]],
  interior: [[7 * 60, 8 * 60], [21 * 60, 22 * 60]],
  mente: [[19 * 60, 22 * 60], [8 * 60, 10 * 60]],
  alma: [[7 * 60, 8 * 60 + 30], [21 * 60, 22 * 60 + 30]],
  vinculos: [[20 * 60, 22 * 60 + 30], [13 * 60, 16 * 60]],
  trabajo: [[9 * 60, 18 * 60]],
  libre: [[18 * 60, 22 * 60]],
};

/** La semana a planificar: el fin de semana se arma la que viene; el resto de los días, la actual. */
export function weekToPlan(now = new Date()): DateKey {
  const dow = now.getDay();
  const monday = startOfWeek(now);
  return toKey(dow === 0 || dow === 6 ? addDays(monday, 7) : monday);
}

export const weekDaysOf = (monday: DateKey) => Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(monday), i)));

/** Primer horario libre del día dentro de las franjas preferidas (o en cualquier momento despierto). */
export function findFreeSlot(
  blocks: Block[],
  date: DateKey,
  minutes: number,
  quadrant: QuadrantId,
  sleep: SleepSettings,
  notBefore = 0,
): number | null {
  const { wake, bed } = awakeWindow(date, sleep);
  const busy = blocks.filter((b) => b.date === date && b.status !== "skipped");
  const free = (s: number) =>
    s >= notBefore && s >= wake && s + minutes <= bed && busy.every((b) => s + minutes <= b.start || s >= b.start + b.minutes);
  for (const [from, to] of [...PREFERRED[quadrant], [wake, bed] as [number, number]]) {
    for (let s = Math.max(from, wake); s + minutes <= Math.min(to + minutes, bed); s += STEP) if (free(s)) return s;
  }
  return null;
}

/** La actividad que más usás de un cuadrante (o la primera que tengas). */
function favoriteActivity(quadrant: QuadrantId, activities: Activity[], blocks: Block[]): Activity | undefined {
  const mine = activities.filter((a) => a.quadrant === quadrant);
  const uses = (a: Activity) => blocks.filter((b) => b.activityId === a.id || b.title === a.name).length;
  return [...mine].sort((a, b) => uses(b) - uses(a))[0];
}

const TIMES = (n: number) => (n === 1 ? "una vez" : `${n} veces`);

/** Duración habitual de una actividad (la más usada en tu historial). */
function typicalMinutes(activity: Activity | undefined, blocks: Block[], fallback: number): number {
  if (!activity) return fallback;
  const counts = new Map<number, number>();
  for (const b of blocks) if (b.activityId === activity.id || b.title === activity.name) counts.set(b.minutes, (counts.get(b.minutes) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : fallback;
}

/**
 * Lo que le falta (+) o sobra (−) a cada cuadrante en una semana, en minutos redondeados a 30.
 * Si la semana está casi vacía, la referencia es la semana anterior (mínimo 20 h), así los
 * números tienen sentido: con 4 h agendadas, "sobran 2 h 54" no le sirve a nadie.
 */
export function weekGap(week: DateKey, allBlocks: Block[], targets: QuadrantRecord<number>, now = new Date()) {
  const days = weekDaysOf(week);
  const range = { start: days[0], end: days[6] };
  // Para buscar huecos: solo los bloques reales. Para medir: con el Libre que completa cada día.
  const weekBlocks = inPeriod(allBlocks, range);
  const stats = computeBalance(periodBlocks(allBlocks, range), targets, now);
  const reference = stats.plannedTotal;
  const raw = planGap(stats, targets);
  const gap = Object.fromEntries(QUADRANTS.map((q) => [q.id, Math.round(raw[q.id] / STEP) * STEP])) as QuadrantRecord<number>;
  return { stats, weekBlocks, reference, gap };
}

/** Misiones calculadas sin IA: lo que le falta a cada cuadrante para llegar a tu objetivo esa semana. */
export function ruleMissions(
  week: DateKey,
  allBlocks: Block[],
  targets: QuadrantRecord<number>,
  activities: Activity[],
  sleep: SleepSettings,
  now = new Date(),
): MissionDraft[] {
  const days = weekDaysOf(week);
  const { weekBlocks, gap } = weekGap(week, allBlocks, targets, now);

  const today = toKey(now);
  const usableDays = days.filter((d) => d >= today);
  const scheduled = [...weekBlocks];
  const out: MissionDraft[] = [];

  const candidates = QUADRANTS.filter((q) => q.id !== "trabajo" && q.id !== "libre" && gap[q.id] >= 60).sort((a, b) => gap[b.id] - gap[a.id]);

  for (const q of candidates.slice(0, 3)) {
    const act = favoriteActivity(q.id, activities, allBlocks);
    const name = act?.name ?? q.name;
    const minutes = typicalMinutes(act, allBlocks, q.id === "alma" || q.id === "mente" ? 30 : 60);
    const count = Math.max(1, Math.min(3, Math.round(gap[q.id] / minutes)));

    // Repartimos las veces en los días menos cargados.
    const load = (d: DateKey) => scheduled.filter((b) => b.date === d).reduce((acc, b) => acc + b.minutes, 0);
    const slots: MissionSlot[] = [];
    for (const d of [...usableDays].sort((a, b) => load(a) - load(b))) {
      if (slots.length >= count) break;
      const start = findFreeSlot(scheduled, d, minutes, q.id, sleep, d === today ? nowMinutes(now) + 30 : 0);
      if (start === null) continue;
      slots.push({ date: d, start });
      scheduled.push({ id: `tmp-${d}-${start}`, title: name, quadrant: q.id, minutes, date: d, start, status: "pending", order: 0 });
    }
    if (!slots.length) continue;
    slots.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));

    out.push({
      quadrant: q.id,
      activityName: name,
      activityId: act?.id,
      title: `${name} ${TIMES(slots.length)} esta semana`,
      why: `A ${QUADRANT_BY_ID[q.id].name} le faltan ${formatMinutes(gap[q.id])} para llegar a tu ${targets[q.id]}%.`,
      minutes,
      slots,
    });
  }
  return out;
}

