import { addDays, startOfWeek, toKey } from "./dates";
import { QUADRANTS, quadrantRecord, type QuadrantId, type QuadrantRecord } from "./quadrants";
import { nextDateFor } from "./setup";
import { awakeWindow, type SleepSettings } from "./sleep";
import { newId, usePlanner, type Job, type RoutineBlock } from "./store";

export type { RoutineBlock };

export type TimeOfDay = "mañana" | "tarde" | "noche";

/** Lo que contás de una actividad: "gimnasio, 3 veces por semana, 1 h, a la mañana". */
export interface ActivitySpec {
  quadrant: QuadrantId;
  name: string;
  perWeek: number;
  minutes: number;
  timeOfDay?: TimeOfDay;
  /** Días puntuales si los dijo ("los viernes"); si no, se reparten. */
  days?: number[];
}

/** Lunes primero. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Ventana despierto de un día de la semana con tu horario habitual (sin excepciones puntuales). */
export function awakeFor(dow: number, sleep: SleepSettings) {
  const monday = startOfWeek(new Date());
  const date = toKey(addDays(monday, WEEK_ORDER.indexOf(dow)));
  return awakeWindow(date, { ...sleep, overrides: undefined });
}

export function awakeWeek(sleep: SleepSettings) {
  return WEEK_ORDER.reduce((acc, d) => {
    const { wake, bed } = awakeFor(d, sleep);
    return acc + (bed - wake);
  }, 0);
}

/** Minutos por semana de cada cuadrante; Libre es lo que sobra de tu tiempo despierto. */
export function routineMinutes(template: RoutineBlock[], sleep: SleepSettings): QuadrantRecord<number> {
  const out = quadrantRecord(0);
  for (const b of template) out[b.quadrant] += b.minutes * b.days.length;
  const used = QUADRANTS.reduce((acc, q) => (q.id === "libre" ? acc : acc + out[q.id]), 0);
  out.libre += Math.max(0, awakeWeek(sleep) - used);
  return out;
}

/** % de tu tiempo despierto (enteros que suman 100). */
export function routineShares(template: RoutineBlock[], sleep: SleepSettings): QuadrantRecord<number> {
  return sharesOf(routineMinutes(template, sleep));
}

/** Minutos por semana → % enteros que suman 100. */
export function sharesOf(minutes: QuadrantRecord<number>): QuadrantRecord<number> {
  const total = QUADRANTS.reduce((acc, q) => acc + minutes[q.id], 0) || 1;
  const exact = QUADRANTS.map((q) => ({ id: q.id, v: (minutes[q.id] / total) * 100 }));
  const out = quadrantRecord(0);
  for (const e of exact) out[e.id] = Math.floor(e.v);
  let left = 100 - QUADRANTS.reduce((acc, q) => acc + out[q.id], 0);
  for (const e of [...exact].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break;
    out[e.id]++;
    left--;
  }
  return out;
}

/** Qué días, repartidos en la semana: 3 veces = lunes, miércoles y viernes. */
export function spreadDays(n: number): number[] {
  const table: Record<number, number[]> = {
    1: [3],
    2: [2, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 0],
  };
  return table[Math.max(1, Math.min(7, Math.round(n)))];
}

const WINDOWS: Record<TimeOfDay, [number, number]> = {
  mañana: [6 * 60, 12 * 60],
  tarde: [12 * 60, 19 * 60],
  noche: [19 * 60, 24 * 60],
};

const DEFAULT_MOMENT: Partial<Record<QuadrantId, TimeOfDay>> = { cuerpo: "mañana", mente: "noche", alma: "mañana", vinculos: "noche" };

const busy = (template: RoutineBlock[], dow: number, start: number, minutes: number) =>
  template.some((b) => b.days.includes(dow) && start < b.start + b.minutes && start + minutes > b.start);

function fits(template: RoutineBlock[], sleep: SleepSettings, dow: number, start: number, minutes: number) {
  const { wake, bed } = awakeFor(dow, sleep);
  return start >= wake && start + minutes <= bed && !busy(template, dow, start, minutes);
}

/**
 * Ubica una actividad en tu semana: busca una misma hora libre en todos sus días (en el momento
 * que prefieras); si no hay, cada día en su primer hueco. Devuelve uno o más bloques.
 */
export function placeActivity(template: RoutineBlock[], sleep: SleepSettings, spec: ActivitySpec): RoutineBlock[] {
  const days = spec.days?.length ? spec.days : spreadDays(spec.perWeek);
  // Sin momento elegido, uno razonable para cada parte de la vida.
  // Lo vincular (amigos, familia, pareja) suele ser a la noche, aunque esté en Alma.
  const social = /amig|famil|pareja|novi|cita|salid|asado|cena/i.test(spec.name);
  const moment = spec.timeOfDay ?? (social ? "noche" : DEFAULT_MOMENT[spec.quadrant]);
  const ranges: [number, number][] = moment ? [WINDOWS[moment], [5 * 60, 26 * 60]] : [[8 * 60, 22 * 60], [5 * 60, 26 * 60]];
  for (const [i, [from, to]] of ranges.entries()) {
    for (let start = from; start + spec.minutes <= to; start += 30) {
      if (days.every((d) => fits(template, sleep, d, start, spec.minutes))) {
        return [{ id: newId(), quadrant: spec.quadrant, name: spec.name, days, start, minutes: spec.minutes }];
      }
    }
    // En el momento elegido, aunque no sea a la misma hora todos los días.
    if (i === 0 && moment) {
      const perDay = days.map((d) => {
        for (let start = from; start + spec.minutes <= to; start += 30) if (fits(template, sleep, d, start, spec.minutes)) return { d, start };
        return null;
      });
      if (perDay.every(Boolean)) {
        const byStart = new Map<number, number[]>();
        for (const p of perDay as { d: number; start: number }[]) byStart.set(p.start, [...(byStart.get(p.start) ?? []), p.d]);
        return [...byStart.entries()].map(([start, ds]) => ({ id: newId(), quadrant: spec.quadrant, name: spec.name, days: ds, start, minutes: spec.minutes }));
      }
    }
  }
  // Sin una hora común: cada día donde entre.
  const out: RoutineBlock[] = [];
  for (const d of days) {
    const { wake, bed } = awakeFor(d, sleep);
    for (let start = wake; start + spec.minutes <= bed; start += 30) {
      if (fits([...template, ...out], sleep, d, start, spec.minutes)) {
        out.push({ id: newId(), quadrant: spec.quadrant, name: spec.name, days: [d], start, minutes: spec.minutes });
        break;
      }
    }
  }
  return out;
}

/** Sin nombre, el tipo hace de nombre. */
export const jobName = (j: Job) => j.name.trim() || (j.kind === "emprendimiento" ? "Emprendimiento" : j.kind === "proyecto" ? "Proyecto" : "Trabajo");

export const jobBlocks = (jobs: Job[]): RoutineBlock[] =>
  jobs
    .filter((j) => j.days.length && j.end > j.start)
    .map((j) => ({ id: newId(), quadrant: "trabajo" as const, name: jobName(j), days: [...j.days], start: j.start, minutes: j.end - j.start }));

/** Arma una semana desde cero: trabajos primero (son fijos) y después cada actividad. */
export function buildRoutine(jobs: Job[], specs: ActivitySpec[], sleep: SleepSettings): RoutineBlock[] {
  let template = jobBlocks(jobs);
  for (const spec of specs) if (spec.perWeek > 0) template = [...template, ...placeActivity(template, sleep, spec)];
  return template;
}

/** Cuántas veces y cuánto dura cada actividad (para mostrar y para la IA). */
export function routineSummary(template: RoutineBlock[]): string {
  const byName = new Map<string, { quadrant: QuadrantId; times: number; minutes: number }>();
  for (const b of template) {
    const key = `${b.quadrant}:${b.name}`;
    const cur = byName.get(key) ?? { quadrant: b.quadrant, times: 0, minutes: b.minutes };
    cur.times += b.days.length;
    byName.set(key, cur);
  }
  return [...byName.entries()]
    .map(([key, v]) => `${key.split(":")[1]} (${v.quadrant}): ${v.times} veces por semana, ${v.minutes} min`)
    .join("; ");
}

/**
 * Tu semana ideal pasa a ser tu rutina: reemplaza lo que se repetía antes (desde hoy) por estos
 * bloques, crea las actividades que falten y deja el objetivo (tu meta, o el % de esta semana).
 */
export function applyRoutine(template: RoutineBlock[], sleep: SleepSettings, targets?: QuadrantRecord<number>) {
  const store = usePlanner.getState();
  // Lo que se repetía antes se reemplaza (en cuentas de antes de la rutina, todo lo que se repite).
  const old = store.routineSeries.length ? store.routineSeries : store.series.filter((x) => !x.until).map((x) => x.id);
  for (const id of old) store.removeSeries(id);
  const created: string[] = [];
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  for (const b of template) {
    const activity = store.addActivity(b.quadrant, b.name);
    // Arranca en la próxima vez que todavía no pasó (si hoy ya terminó, desde mañana).
    const today = nextDateFor(b.days, now);
    const date = today === toKey(now) && b.start + b.minutes <= minute ? nextDateFor(b.days, addDays(now, 1)) : today;
    store.addBlock(
      { title: activity.name, quadrant: b.quadrant, activityId: activity.id, minutes: b.minutes, date, start: b.start },
      b.days,
    );
    const series = usePlanner.getState().series.at(-1);
    if (series) created.push(series.id);
  }
  store.setRoutine(template, created);
  store.setTargets(targets ?? routineShares(template, sleep));
}

/** Las actividades de una semana tipo, agrupadas por nombre (sin el trabajo). */
export function specsOf(template: RoutineBlock[]): ActivitySpec[] {
  const out: ActivitySpec[] = [];
  for (const b of template) {
    if (b.quadrant === "trabajo") continue;
    const cur = out.find((s) => s.name.toLowerCase() === b.name.toLowerCase());
    if (cur) cur.perWeek += b.days.length;
    else out.push({ quadrant: b.quadrant, name: b.name, perWeek: b.days.length, minutes: b.minutes });
  }
  return out;
}

/**
 * Aplica a una semana tipo los cambios de la lista de actividades: lo que se sacó se va, lo nuevo
 * o lo que cambió (veces, duración, momento) se vuelve a ubicar. El resto no se toca.
 */
export function applySpecs(template: RoutineBlock[], before: ActivitySpec[], after: ActivitySpec[], sleep: SleepSettings): RoutineBlock[] {
  const key = (s: ActivitySpec) => `${s.quadrant}|${s.perWeek}|${s.minutes}|${s.timeOfDay ?? ""}`;
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  let next = template.filter((b) => b.quadrant === "trabajo" || after.some((s) => same(s.name, b.name)));
  for (const s of after) {
    const prev = before.find((p) => same(p.name, s.name));
    if (prev && key(prev) === key(s)) continue;
    next = next.filter((b) => !same(b.name, s.name));
    next = [...next, ...placeActivity(next, sleep, s)];
  }
  return next;
}

/**
 * Mete un bloque en la semana cortando lo que tenga abajo: si pisa a otro (en los días que comparten),
 * ese otro se parte en lo que queda antes y después. Ej.: Brandtag 9–18 + una media hora a las 13
 * = Brandtag 9–13, el nuevo, y Brandtag 13:30–18. En los días que no se pisan, no cambia nada.
 */
export function carve(routine: RoutineBlock[], block: RoutineBlock): RoutineBlock[] {
  const end = block.start + block.minutes;
  const out: RoutineBlock[] = [];
  for (const x of routine) {
    if (x.id === block.id) continue;
    const xEnd = x.start + x.minutes;
    const overlaps = x.start < end && xEnd > block.start;
    const shared = overlaps ? x.days.filter((d) => block.days.includes(d)) : [];
    if (!shared.length) {
      out.push(x);
      continue;
    }
    // Los días que no se tocan quedan como estaban.
    const untouched = x.days.filter((d) => !shared.includes(d));
    if (untouched.length) out.push({ ...x, days: untouched });
    // En los días compartidos, lo que sobra antes y después del nuevo.
    if (x.start < block.start) out.push({ ...x, id: newId(), days: shared, minutes: block.start - x.start });
    if (xEnd > end) out.push({ ...x, id: newId(), days: shared, start: end, minutes: xEnd - end });
  }
  return [...out, block];
}
