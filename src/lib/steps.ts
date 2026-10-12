import { awakeFor, carve, WEEK_ORDER } from "./routine";
import type { SleepSettings } from "./sleep";
import { sleepStats } from "./sleep-stats";
import { newId, type RoutineBlock } from "./store";
import type { Cat } from "./steps-store";
import { weekMinutes, type Part } from "./week-shares";

const FROM = 5 * 60;
const TO = 24 * 60;

/** Las horas despierto de un día dentro del calendario (05:00 a 24:00). */
const awake = (d: number, sleep: SleepSettings) => {
  const w = awakeFor(d, sleep);
  return { start: Math.max(FROM, w.wake), end: Math.min(TO, w.bed) };
};

/** Lo que queda sin asignar en un día: tramos de al menos `min` minutos. */
export function freeSlots(routine: RoutineBlock[], sleep: SleepSettings, day: number, min = 60): { start: number; end: number }[] {
  const { start, end } = awake(day, sleep);
  const busy = routine
    .filter((b) => b.days.includes(day))
    .map((b) => ({ s: b.start, e: b.start + b.minutes }))
    .sort((a, b) => a.s - b.s);
  const out: { start: number; end: number }[] = [];
  let at = start;
  for (const b of busy) {
    if (b.s - at >= min) out.push({ start: at, end: Math.min(b.s, end) });
    at = Math.max(at, b.e);
    if (at >= end) break;
  }
  if (end - at >= min) out.push({ start: at, end });
  return out.filter((g) => g.end - g.start >= min);
}

export type Gap = { key: string; start: number; end: number; days: number[] };

/** Los huecos de la semana, juntando los que se repiten igual en varios días ("de lunes a viernes de 18 a 20"). */
export function findGaps(routine: RoutineBlock[], sleep: SleepSettings): Gap[] {
  const map = new Map<string, Gap>();
  for (const d of WEEK_ORDER) {
    for (const g of freeSlots(routine, sleep, d)) {
      const id = `${g.start}-${g.end}`;
      const cur = map.get(id) ?? { key: "", start: g.start, end: g.end, days: [] };
      cur.days.push(d);
      map.set(id, cur);
    }
  }
  return [...map.values()]
    .map((g) => ({ ...g, key: `${g.start}-${g.end}-${g.days.join("")}` }))
    .sort((a, b) => b.days.length - a.days.length || b.end - b.start - (a.end - a.start) || a.start - b.start);
}

/** Minutos por semana de cada parte (sin momentos: en los pasos se arma solo la semana). */
export const stepMinutes = (routine: RoutineBlock[], sleep: SleepSettings) => weekMinutes(routine, [], sleep);

export type Advice = { part: Part; tone: "alert" | "tip" | "ok"; title: string; text: string };

/** El informe: qué está flojo, qué está de más, y una idea concreta para cada cosa. */
export function advice(routine: RoutineBlock[], sleep: SleepSettings): Advice[] {
  const m = stepMinutes(routine, sleep);
  const h = (p: Part) => m[p] / 60;
  const perNight = sleepStats(sleep).perNight;
  const out: Advice[] = [];

  if (perNight < 7)
    out.push({ part: "sueno", tone: "alert", title: "Dormís poco", text: `Son ${fmt(perNight)} por noche y lo recomendado es entre 7 y 9. Probá adelantar media hora la hora de acostarte: cansado, todo lo demás rinde menos.` });
  else if (perNight > 9.5) out.push({ part: "sueno", tone: "tip", title: "Dormís bastante", text: `Son ${fmt(perNight)} por noche. Si te levantás cansado igual, puede valer la pena revisarlo; si no, ese tiempo de más puede ir a algo que te guste.` });

  if (h("cuerpo") === 0)
    out.push({ part: "cuerpo", tone: "alert", title: "Tu cuerpo no tiene lugar", text: "No hay nada de movimiento en tu semana. La OMS recomienda al menos 2 h 30 por semana: tres caminatas de 50 minutos ya lo cumplen." });
  else if (h("cuerpo") < 2.5) out.push({ part: "cuerpo", tone: "tip", title: "Un poco más de movimiento", text: `Tenés ${fmt(h("cuerpo"))} por semana. Con una hora más (o caminar parte de un traslado) llegás a lo recomendado.` });

  if (h("mente") === 0)
    out.push({ part: "mente", tone: "alert", title: "Nada para tu cabeza", text: "No hay tiempo para aprender, leer o pensar. Probá 20 minutos de lectura antes de dormir o un podcast en el viaje: son más de 2 horas por semana." });
  else if (h("mente") < 2) out.push({ part: "mente", tone: "tip", title: "Mente, apenas", text: `Tenés ${fmt(h("mente"))} por semana. Un bloque fijo de una hora (un curso, un idioma, un libro) hace la diferencia.` });

  if (h("alma") === 0)
    out.push({ part: "alma", tone: "alert", title: "Sin tiempo para disfrutar", text: "No hay nada de lo que te gusta: hobbies, música, salir. Reservá aunque sea un bloque por semana solo para eso." });
  else if (h("alma") < 3) out.push({ part: "alma", tone: "tip", title: "Poco disfrute", text: `Tenés ${fmt(h("alma"))} por semana para lo que te gusta. Sumarle un bloque el fin de semana suele cambiar cómo se siente la semana entera.` });

  if (h("trabajo") > 50) out.push({ part: "trabajo", tone: "alert", title: "Mucho trabajo", text: `Son ${fmt(h("trabajo"))} por semana. Más de 50 horas sostenidas se paga en sueño, cuerpo y vínculos. ¿Hay algo que se pueda cortar o delegar?` });

  if (h("libre") < 10) out.push({ part: "libre", tone: "tip", title: "Casi sin margen", text: "Te quedan menos de 10 horas sin plan en toda la semana. Dejá algo de aire: los imprevistos y el descanso también necesitan lugar." });
  else if (h("libre") > 45)
    out.push({ part: "libre", tone: "tip", title: "Mucho tiempo sin plan", text: `Tenés ${fmt(h("libre"))} libres por semana. No está mal, pero si sentís que el tiempo se te escapa, ahí hay lugar para lo que querés sumar.` });

  if (!out.length) out.push({ part: "libre", tone: "ok", title: "Tu semana está bastante equilibrada", text: "No hay ninguna parte en cero ni ninguna que se lleve todo. Si algo no te cierra, lo podés ajustar en el paso siguiente." });
  return out;
}

const fmt = (hours: number) => `${(Math.round(hours * 10) / 10).toLocaleString("es-AR")} h`;

/** Dónde conviene poner cada categoría (franjas en minutos, en orden de preferencia). */
const WINDOWS: Record<Cat, [number, number][]> = {
  cuerpo: [
    [7 * 60, 9 * 60],
    [18 * 60, 21 * 60],
  ],
  mente: [
    [20 * 60, 23 * 60],
    [7 * 60, 9 * 60],
  ],
  alma: [
    [19 * 60, 23 * 60],
    [10 * 60, 19 * 60],
  ],
  trabajo: [[9 * 60, 18 * 60]],
  libre: [[12 * 60, 15 * 60]],
};
export const DEFAULT_NAME: Record<Cat, string> = { cuerpo: "Ejercicio", mente: "Lectura", alma: "Hobby", trabajo: "Trabajo", libre: "Descanso" };
const SPREAD = [1, 3, 5, 2, 4, 6, 0];

/**
 * Propone dónde sumar las horas que querés de más: primero en los huecos libres (en la franja que mejor
 * le queda a cada cosa) y, si no alcanza, sobre bloques de Libre (descanso, etc.). Bloques de una hora,
 * repartidos en la semana; los que caen a la misma hora se juntan en un solo bloque de varios días.
 */
export function propose(routine: RoutineBlock[], sleep: SleepSettings, goals: Partial<Record<Cat, number>>) {
  let week = [...routine];
  const added: RoutineBlock[] = [];
  const missing: Partial<Record<Cat, number>> = {};

  for (const cat of Object.keys(goals) as Cat[]) {
    let need = Math.round((goals[cat] ?? 0) * 60);
    let guard = 0;
    while (need > 0 && guard++ < 40) {
      const len = Math.min(60, need);
      const slot = pickSlot(week, sleep, cat, len, added);
      if (!slot) break;
      const block: RoutineBlock = { id: newId(), quadrant: cat, name: DEFAULT_NAME[cat], days: [slot.day], start: slot.start, minutes: len };
      week = carve(week, block);
      added.push(block);
      need -= len;
    }
    if (need > 0) missing[cat] = need / 60;
  }
  return { routine: mergeSame(week, added), added: mergeSame(added, added), missing };
}

/** El mejor lugar para un bloque: un hueco libre en su franja; si no, cualquier hueco; si no, encima de un bloque de Libre. */
function pickSlot(week: RoutineBlock[], sleep: SleepSettings, cat: Cat, len: number, added: RoutineBlock[]) {
  // Repartir: primero los días que todavía no tienen nada nuevo de esta categoría.
  const used = new Set(added.filter((b) => b.quadrant === cat).flatMap((b) => b.days));
  const days = [...SPREAD.filter((d) => !used.has(d)), ...SPREAD.filter((d) => used.has(d))];
  for (const win of [...WINDOWS[cat], [FROM, TO] as [number, number]]) {
    for (const day of days) {
      for (const g of freeSlots(week, sleep, day, len)) {
        const s = Math.max(g.start, win[0]);
        if (s + len <= Math.min(g.end, win[1])) return { day, start: Math.ceil(s / 30) * 30 > g.end - len ? s : Math.ceil(s / 30) * 30 };
      }
    }
  }
  // Sin huecos: sobre un bloque de Libre (el descanso cede su lugar).
  for (const day of days) {
    const b = week.find((x) => x.quadrant === "libre" && x.days.includes(day) && x.minutes >= len);
    if (b) return { day, start: b.start };
  }
  return null;
}

/** Junta bloques iguales (misma categoría, nombre, hora y duración) de distintos días en uno solo. */
function mergeSame(week: RoutineBlock[], added: RoutineBlock[]): RoutineBlock[] {
  const isNew = new Set(added.map((b) => b.id));
  const keep = week.filter((b) => !isNew.has(b.id));
  const groups = new Map<string, RoutineBlock>();
  for (const b of week.filter((x) => isNew.has(x.id))) {
    const k = `${b.quadrant}|${b.name}|${b.start}|${b.minutes}`;
    const g = groups.get(k);
    if (g) g.days = [...new Set([...g.days, ...b.days])];
    else groups.set(k, { ...b, days: [...b.days] });
  }
  return [...keep, ...groups.values()];
}
