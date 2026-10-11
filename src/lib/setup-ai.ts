import type { IdealEdit, SetupExtraction, SetupRequest, WeekReview } from "./ai-schemas";
import { AVERAGE_WEEK, WHO_ACTIVITY_MINUTES } from "./benchmarks";
import { aiEnabled, type Source } from "./coach";
import { normalize } from "./activities";
import { LIFE_QUADRANTS, QUADRANT_BY_ID, type QuadrantId, type QuadrantRecord } from "./quadrants";
import type { ActivitySpec, RoutineBlock } from "./routine";
import { parseActivities, parseJobs, parseName, parseSleep, saysNone } from "./setup-parse";
import type { SleepSettings } from "./sleep";
import type { Job } from "./store";

export type SetupStep = "name" | "sleep" | "work" | "cuerpo" | "mente" | "alma" | "vinculos" | "activities";

export interface Interpretation {
  name?: string;
  sleep?: SleepSettings;
  jobs?: Job[];
  activities: ActivitySpec[];
  none: boolean;
  reply: string;
  source: Source;
}

async function callSetup<T>(body: SetupRequest): Promise<T | null> {
  if (!(await aiEnabled())) return null;
  try {
    const res = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const hours = (m: number) => `${Math.round(m / 60)} h`;

/** Lo que contaste con tus palabras en una pregunta: con IA si hay, si no por reglas. */
export async function interpret(step: SetupStep, question: string, text: string, sleep: SleepSettings, context: string): Promise<Interpretation> {
  const ai = await callSetup<SetupExtraction>({ mode: "extract", question, text, context });
  if (ai) {
    return {
      name: ai.name ?? undefined,
      sleep: ai.sleep
        ? { ...sleep, weekday: { bed: ai.sleep.weekdayBed, wake: ai.sleep.weekdayWake }, weekend: { bed: ai.sleep.weekendBed, wake: ai.sleep.weekendWake } }
        : undefined,
      jobs: ai.jobs ?? undefined,
      activities: ai.activities.map((a) => ({ ...a, timeOfDay: a.timeOfDay ?? undefined, days: a.days ?? undefined })),
      none: ai.none,
      reply: ai.reply,
      source: "ai",
    };
  }

  // Por reglas.
  if (step === "name") {
    const name = parseName(text);
    return { name, activities: [], none: false, reply: name ? `¡Hola, ${name}!` : "", source: "rules" };
  }
  if (step === "sleep") {
    const parsed = parseSleep(text, sleep);
    return { sleep: parsed ?? undefined, activities: [], none: false, reply: parsed ? "Anotado tu horario de sueño." : "No me quedó claro. Usá los selectores de abajo.", source: "rules" };
  }
  if (step === "work") {
    const jobs = parseJobs(text);
    return {
      jobs: jobs ?? undefined,
      activities: [],
      none: jobs?.length === 0,
      reply: jobs === null ? "No me quedó claro el horario. Cargalo abajo." : jobs.length ? `Listo: ${jobs.map((j) => j.name).join(" y ")}.` : "Anotado: sin trabajo con horario fijo.",
      source: "rules",
    };
  }
  const none = saysNone(text);
  const activities = none ? [] : parseActivities(text, step === "activities" ? undefined : step);
  return {
    activities,
    none,
    reply: none
      ? "Anotado: nada de esto por ahora."
      : activities.length
        ? `Sumé ${activities.map((a) => a.name.toLowerCase()).join(", ")}.`
        : "No reconocí la actividad. Elegila de abajo o escribí su nombre en \"Otra\".",
    source: "rules",
  };
}

/** Cambios pedidos para la semana ideal ("quiero entrenar dos veces", "sacá correr"). */
export interface IdealChange {
  add: ActivitySpec[];
  remove: string[];
  reply: string;
  source: Source;
}

export async function editIdeal(text: string, template: RoutineBlock[], context: string): Promise<IdealChange> {
  const ai = await callSetup<IdealEdit>({ mode: "ideal", text, context });
  if (ai) return { add: ai.add.map((a) => ({ ...a, timeOfDay: a.timeOfDay ?? undefined, days: a.days ?? undefined })), remove: ai.remove, reply: ai.reply, source: "ai" };

  const t = normalize(text);
  const removing = /\b(saca|sacar|quita|quitar|borra|borrar|elimina|sin)\b/.test(t);
  const names = [...new Set(template.map((b) => b.name))];
  if (removing) {
    const remove = names.filter((n) => t.includes(normalize(n)));
    return { add: [], remove, reply: remove.length ? `Saqué ${remove.join(", ").toLowerCase()}.` : "No encontré esa actividad en tu semana.", source: "rules" };
  }
  const add = parseActivities(text);
  return {
    add,
    remove: [],
    reply: add.length
      ? `Sumé ${add.map((a) => `${a.name.toLowerCase()} ${a.perWeek} ${a.perWeek === 1 ? "vez" : "veces"} por semana`).join(" y ")}.`
      : "No entendí qué sumar. Probá con algo como \"gimnasio 2 veces por semana a la mañana\".",
    source: "rules",
  };
}

/** Comentario por reglas: lo mejor y lo que más se aleja de la referencia. */
export function ruleReview(minutes: QuadrantRecord<number>): string {
  const mine = (id: QuadrantId) => minutes[id] / 60;
  const life = LIFE_QUADRANTS.filter((q) => q.id !== "trabajo");
  const best = [...life].sort((a, b) => mine(b.id) / Math.max(1, AVERAGE_WEEK[b.id]) - mine(a.id) / Math.max(1, AVERAGE_WEEK[a.id]))[0];
  const parts: string[] = [];
  if (mine(best.id) > AVERAGE_WEEK[best.id]) {
    parts.push(`Le das a ${best.name} ${hours(minutes[best.id])} por semana, más que una persona promedio (${AVERAGE_WEEK[best.id]} h). Eso ya es una elección.`);
  }
  if (minutes.cuerpo < WHO_ACTIVITY_MINUTES) {
    parts.push(`Tu cuerpo tiene ${hours(minutes.cuerpo)}: la OMS recomienda al menos 2 h 30 por semana.`);
  }
  const work = mine("trabajo");
  if (work > 45) parts.push(`El trabajo se lleva ${hours(minutes.trabajo)}, más que el promedio (${AVERAGE_WEEK.trabajo} h).`);
  if (!parts.length) parts.push("Tu semana está bastante repartida. Lo interesante ahora es ver si así la querés.");
  return parts.slice(0, 3).join(" ");
}

export async function reviewWeek(minutes: QuadrantRecord<number>, context: string): Promise<{ comment: string; source: Source }> {
  const ai = await callSetup<WeekReview>({ mode: "review", context });
  return ai ? { comment: ai.comment, source: "ai" } : { comment: ruleReview(minutes), source: "rules" };
}

/** El contexto en texto para la IA: horas por cuadrante, la referencia y las actividades. */
export function weekContext(minutes: QuadrantRecord<number>, summary: string, extra = ""): string {
  const rows = (Object.keys(QUADRANT_BY_ID) as QuadrantId[]).map(
    (id) => `${QUADRANT_BY_ID[id].name}: ${hours(minutes[id])} (promedio ${AVERAGE_WEEK[id]} h)`,
  );
  return [`Horas por semana — ${rows.join("; ")}.`, summary ? `Actividades: ${summary}.` : "", extra].filter(Boolean).join("\n");
}
