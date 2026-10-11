import { SUGGESTED_ACTIVITIES, normalize } from "./activities";
import type { QuadrantId } from "./quadrants";
import type { ActivitySpec, TimeOfDay } from "./routine";
import type { SleepSettings } from "./sleep";
import type { Job } from "./store";

/**
 * Lectura por reglas de lo que contás con tus palabras (escrito o dictado), para cuando no hay IA.
 * Entiende lo común: "voy al gimnasio 3 veces por semana a la mañana", "trabajo de 9 a 18 de lunes
 * a viernes", "me acuesto a las 23 y me levanto a las 7". Lo raro lo resuelve la IA.
 */

/** Palabras que apuntan a una actividad (raíz sin acentos → cuadrante y nombre). */
const KEYWORDS: [string, QuadrantId, string][] = [
  ["gim", "cuerpo", "Gimnasio"],
  ["gym", "cuerpo", "Gimnasio"],
  ["entren", "cuerpo", "Entrenar"],
  ["corr", "cuerpo", "Correr"],
  ["running", "cuerpo", "Correr"],
  ["camin", "cuerpo", "Caminar"],
  ["yoga", "cuerpo", "Yoga"],
  ["pilates", "cuerpo", "Pilates"],
  ["futbol", "cuerpo", "Fútbol"],
  ["padel", "cuerpo", "Pádel"],
  ["tenis", "cuerpo", "Tenis"],
  ["nad", "cuerpo", "Natación"],
  ["natac", "cuerpo", "Natación"],
  ["bici", "cuerpo", "Bici"],
  ["crossfit", "cuerpo", "Crossfit"],
  ["box", "cuerpo", "Boxeo"],
  ["le", "mente", "Leer"],
  ["libro", "mente", "Leer"],
  ["estudi", "mente", "Estudiar"],
  ["curso", "mente", "Curso"],
  ["idioma", "mente", "Idiomas"],
  ["ingles", "mente", "Inglés"],
  ["podcast", "mente", "Podcast"],
  ["medit", "alma", "Meditar"],
  ["terapia", "alma", "Terapia"],
  ["dibuj", "alma", "Dibujar"],
  ["pint", "alma", "Pintar"],
  ["music", "alma", "Música"],
  ["guitarra", "alma", "Música"],
  ["piano", "alma", "Música"],
  ["cant", "alma", "Cantar"],
  ["arte", "alma", "Arte"],
  ["diario", "alma", "Escribir un diario"],
  ["escrib", "alma", "Escribir"],
  ["fotograf", "alma", "Fotografía"],
  ["naturaleza", "alma", "Naturaleza"],
  ["rez", "alma", "Rezar"],
  ["pareja", "vinculos", "Pareja"],
  ["novi", "vinculos", "Pareja"],
  ["amig", "vinculos", "Amigos"],
  ["famil", "vinculos", "Familia"],
  ["hij", "vinculos", "Familia"],
  ["padres", "vinculos", "Familia"],
  ["vieja", "vinculos", "Familia"],
  ["salid", "vinculos", "Salida"],
  ["asado", "vinculos", "Asado"],
  ["cita", "vinculos", "Cita"],
];

const NUMBER_WORDS: Record<string, number> = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };

/** ¿Dijo que no hace nada de esto? */
export function saysNone(text: string): boolean {
  const t = normalize(text);
  return /^(no|nada|ninguna?o?|nunca|tampoco)\b/.test(t) || /\b(no hago nada|nada de eso|ninguna)\b/.test(t);
}

function perWeekOf(t: string): number | null {
  if (/todos los dias|todas las (noches|mananas|tardes)|diari|cada dia|cada noche|cada manana/.test(t)) return 7;
  if (/lunes a viernes|dias de semana|entre semana/.test(t)) return 5;
  if (/fin(es)? de semana|finde/.test(t)) return 2;
  const m = t.match(/(\d+|una|un|dos|tres|cuatro|cinco|seis|siete)\s*(vez|veces|x|por semana|a la semana|dias)/);
  if (m) return Math.min(7, NUMBER_WORDS[m[1]] ?? Number(m[1]));
  if (/una vez|1 vez/.test(t)) return 1;
  return null;
}

function minutesOf(t: string): number | null {
  if (/media hora/.test(t)) return 30;
  if (/hora y media/.test(t)) return 90;
  const h = t.match(/(\d+(?:[.,]\d+)?|una|dos|tres|cuatro)\s*(h|hs|hora|horas)\b/);
  if (h) return Math.round((NUMBER_WORDS[h[1]] ?? Number(h[1].replace(",", "."))) * 60);
  const m = t.match(/(\d+)\s*(min|minutos)\b/);
  if (m) return Number(m[1]);
  return null;
}

function timeOfDayOf(t: string): TimeOfDay | undefined {
  if (/manana|temprano/.test(t)) return "mañana";
  if (/tarde|mediodia/.test(t)) return "tarde";
  if (/noche/.test(t)) return "noche";
  return undefined;
}

/** Las actividades de lo que contaste. Si viene un cuadrante, solo de ese. */
export function parseActivities(text: string, only?: QuadrantId): ActivitySpec[] {
  const out: ActivitySpec[] = [];
  // Cada parte de la frase con lo suyo: "gimnasio 3 veces, y corro los domingos".
  // "los martes y jueves" no se corta: la "y" entre días es parte de la misma actividad.
  for (const clause of normalize(text).split(/[,.;]|\sy\s(?!(?:los\s)?(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?))|\stambien\s/)) {
    const words = clause.split(/\s+/);
    const found = KEYWORDS.find(([stem, q]) => (!only || q === only) && words.some((w) => (stem.length <= 2 ? w === "leo" || w === "leer" : w.startsWith(stem))));
    // También las sugerencias por nombre exacto ("juegos de mesa").
    const suggestion = !found
      ? (Object.entries(SUGGESTED_ACTIVITIES) as [QuadrantId, string[]][])
          .filter(([q]) => (!only || q === only) && q !== "trabajo" && q !== "libre")
          .flatMap(([q, names]) => names.map((n) => [q, n] as const))
          .find(([, n]) => clause.includes(normalize(n)))
      : undefined;
    const quadrant = found?.[1] ?? suggestion?.[0];
    const name = found?.[2] ?? suggestion?.[1];
    if (!quadrant || !name || out.some((o) => o.name === name)) continue;
    // "los viernes" = ese día; "todos los días" no cuenta como días puntuales.
    const days = /todos los dias/.test(clause) ? null : parseDays(clause);
    out.push({
      quadrant,
      name,
      perWeek: days?.length ?? perWeekOf(clause) ?? 2,
      minutes: minutesOf(clause) ?? 0,
      timeOfDay: timeOfDayOf(clause),
      days: days ?? undefined,
    });
  }
  // La duración dicha para todo ("gimnasio 3 veces, una hora") vale si hay una sola actividad.
  for (const o of out) if (!o.minutes) o.minutes = (out.length === 1 ? minutesOf(normalize(text)) : null) ?? 60;
  if (out.length === 1 && !out[0].days && perWeekOf(normalize(text))) out[0].perWeek = perWeekOf(normalize(text))!;
  return out;
}

/** "de 9 a 18", "9:30 a 17.30", "de 9hs a 18hs" → minutos. */
export function parseTimeRange(text: string): { start: number; end: number } | null {
  const m = normalize(text).match(/(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?)?\s*(?:a|-|hasta)\s*(?:las\s*)?(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2] ?? 0);
  let end = Number(m[3]) * 60 + Number(m[4] ?? 0);
  if (end <= start && end < 12 * 60) end += 12 * 60; // "de 9 a 6" = hasta las 18
  return end > start ? { start, end } : null;
}

const DAY_NAMES: [string, number][] = [
  ["lunes", 1],
  ["martes", 2],
  ["miercoles", 3],
  ["jueves", 4],
  ["viernes", 5],
  ["sabado", 6],
  ["domingo", 0],
];

export function parseDays(text: string): number[] | null {
  const t = normalize(text);
  if (/todos los dias/.test(t)) return [1, 2, 3, 4, 5, 6, 0];
  const range = t.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s*a\s*(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
  if (range) {
    const order = DAY_NAMES.map(([n]) => n);
    const a = order.indexOf(range[1]);
    const b = order.indexOf(range[2]);
    return order.slice(a, b + 1).map((n) => DAY_NAMES.find(([x]) => x === n)![1]);
  }
  const list = DAY_NAMES.filter(([n]) => t.includes(n)).map(([, d]) => d);
  return list.length ? list : null;
}

/** Uno o dos trabajos ("empleo de 9 a 18 de lunes a viernes y un emprendimiento martes y jueves de 19 a 21"). */
export function parseJobs(text: string): Job[] | null {
  if (saysNone(text)) return [];
  const parts = normalize(text).split(/\s(?:y|ademas|tambien)\s(?=(?:un|mi|el)?\s*(?:emprend|freelance|negocio|segundo|otro))/);
  const jobs: Job[] = [];
  for (const part of parts.slice(0, 2)) {
    const range = parseTimeRange(part);
    if (!range) continue;
    const name = /emprend/.test(part) ? "Emprendimiento" : /freelance/.test(part) ? "Freelance" : /negocio/.test(part) ? "Negocio propio" : "Empleo";
    jobs.push({ name, days: parseDays(part) ?? [1, 2, 3, 4, 5], start: range.start, end: range.end });
  }
  return jobs.length ? jobs : null;
}

/** "me acuesto a las 23 y me levanto a las 7" (y opcionalmente el finde). */
export function parseSleep(text: string, current: SleepSettings): SleepSettings | null {
  const t = normalize(text);
  const hour = (re: RegExp) => {
    const m = t.match(re);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2] ?? 0);
  };
  const bedRaw = hour(/(?:acuesto|duermo|me voy a dormir|a dormir)[^\d]*(\d{1,2})(?:[:.](\d{2}))?/);
  const wake = hour(/(?:levanto|despierto)[^\d]*(\d{1,2})(?:[:.](\d{2}))?/);
  if (bedRaw === null && wake === null) return null;
  // Acostarse a las 0, 1 o 2 es después de medianoche.
  const bed = bedRaw === null ? null : bedRaw < 5 * 60 ? bedRaw + 24 * 60 : bedRaw < 12 * 60 ? bedRaw + 12 * 60 : bedRaw;
  const weekday = { bed: bed ?? current.weekday.bed, wake: wake ?? current.weekday.wake };
  return { ...current, weekday };
}

/** El nombre: "soy Joaquín", "me llamo Ana", o directamente "Joaquín". */
export function parseName(text: string): string {
  const m = text.match(/(?:soy|me llamo|mi nombre es)\s+([\p{L}]+)/iu);
  const raw = (m?.[1] ?? text.trim().split(/\s+/)[0] ?? "").replace(/[^\p{L}]/gu, "");
  return raw ? raw[0].toUpperCase() + raw.slice(1) : "";
}

/**
 * Algo que no reconocemos ("cerámica los sábados 2 horas"): sacamos el nombre limpio y lo demás
 * (días, veces, duración, momento) para no perderlo. La categoría se la preguntamos al usuario.
 */
export function parseLoose(text: string): { name: string; days?: number[]; perWeek: number; minutes: number; timeOfDay?: TimeOfDay } {
  const t = normalize(text);
  const days = parseDays(t);
  // Se limpia sobre el texto sin acentos (para que los patrones sean simples) y se recupera el original por posición.
  const words = text.trim().split(/\s+/);
  const plain = words.map((w) => normalize(w));
  const drop = new Set<number>();
  const DAY = /^(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?|dias|noches|mananas|tardes|semana|finde)$/;
  const FILLER = /^(los|las|el|la|todos|todas|por|a|y|de|al)$/;
  const NUMBER = /^(\d+([.,]\d+)?|una|un|dos|tres|cuatro|cinco|seis|siete|media)$/;
  const UNIT = /^(vez|veces|x|horas?|hs?|min|minutos|hora)$/;
  plain.forEach((w, i) => {
    if (DAY.test(w) || UNIT.test(w) || NUMBER.test(w) || /^(manana|tarde|noche)$/.test(w)) drop.add(i);
  });
  // Los conectores que quedan pegados a lo que sacamos ("los", "a la", "por") también se van.
  plain.forEach((w, i) => {
    if (FILLER.test(w) && (drop.has(i + 1) || drop.has(i - 1) || i === plain.length - 1)) drop.add(i);
  });
  const name = words.filter((_, i) => !drop.has(i)).join(" ").trim() || text.trim();
  return {
    name: name.replace(/^\p{L}/u, (c) => c.toUpperCase()).slice(0, 40),
    days: days && !/todos los dias/.test(t) ? days : undefined,
    perWeek: days?.length ?? perWeekOf(t) ?? 2,
    minutes: minutesOf(t) ?? 60,
    timeOfDay: timeOfDayOf(t),
  };
}
