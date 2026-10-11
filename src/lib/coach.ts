import type { MissionsPlan, TargetsAnswers, TargetsProposal } from "./ai-schemas";
import { buildContext } from "./assistant";
import { computeBalance } from "./balance";
import { addDays, fromKey, startOfWeek, toKey, type DateKey } from "./dates";
import { ruleMissions, weekDaysOf, type MissionDraft } from "./missions";
import { QUADRANT_BY_ID, QUADRANTS, type QuadrantId, type QuadrantRecord } from "./quadrants";
import { periodBlocks } from "./report";
import { usePlanner, type Mission } from "./store";
import { awakeWindow } from "./sleep";
import { nowMinutes, STEP } from "./time";

export type Source = "ai" | "rules";

let aiStatus: Promise<boolean> | null = null;
/** Si la IA está configurada en el servidor (se consulta una sola vez por sesión). */
export function aiEnabled(): Promise<boolean> {
  aiStatus ??= fetch("/api/ai/status")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => !!d.enabled)
    .catch(() => false);
  return aiStatus;
}

// ---------- Objetivo recomendado ----------


/** Redondea a múltiplos de 5 que sumen 100 (método del mayor resto). */
export function roundTo5(raw: QuadrantRecord<number>): QuadrantRecord<number> {
  const total = QUADRANTS.reduce((acc, q) => acc + Math.max(0, raw[q.id]), 0) || 1;
  const units = QUADRANTS.map((q) => ({ id: q.id, exact: (Math.max(0, raw[q.id]) / total) * 20 }));
  const out = Object.fromEntries(units.map((u) => [u.id, Math.floor(u.exact)])) as QuadrantRecord<number>;
  let left = 20 - QUADRANTS.reduce((acc, q) => acc + out[q.id], 0);
  for (const u of [...units].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left <= 0) break;
    out[u.id]++;
    left--;
  }
  for (const q of QUADRANTS) out[q.id] *= 5;
  return out;
}

const sumsTo100 = (t: QuadrantRecord<number>) =>
  QUADRANTS.every((q) => Number.isInteger(t[q.id]) && t[q.id] >= 0 && t[q.id] % 5 === 0) &&
  QUADRANTS.reduce((acc, q) => acc + t[q.id], 0) === 100;

/** Recomendación sin IA: Trabajo sale de tus horas reales; el resto se reparte, con más peso a lo que priorizás. */
export function ruleTargets(a: TargetsAnswers): TargetsProposal {
  const workShare = a.awakeMinutes > 0 ? (a.workMinutes / a.awakeMinutes) * 100 : 0;
  const work = Math.min(70, Math.max(a.workMinutes > 0 ? 5 : 0, workShare + (a.priorities.includes("trabajo") ? 5 : 0)));
  const libre = 15;
  const others = QUADRANTS.filter((q) => q.id !== "trabajo" && q.id !== "libre");
  const weight = (id: QuadrantId) => 1 + (a.priorities.includes(id) ? 0.6 : 0);
  const totalWeight = others.reduce((acc, q) => acc + weight(q.id), 0);
  const raw = { trabajo: work, libre } as QuadrantRecord<number>;
  for (const q of others) raw[q.id] = (Math.max(0, 100 - work - libre) * weight(q.id)) / totalWeight;
  const targets = roundTo5(raw);

  const boosted = others.filter((q) => weight(q.id) > 1).map((q) => q.name);
  return {
    targets,
    explanation: `Partí de tus horas de trabajo (${targets.trabajo}% de tu tiempo despierto), dejé ${targets.libre}% Libre y repartí el resto${
      boosted.length ? `, con un poco más para ${boosted.join(" y ")}` : " en partes parecidas"
    }. Es un punto de partida: lo vamos ajustando con cómo te va cada semana.`,
  };
}

/** Cómo viene el usuario en las últimas semanas, en texto (para la IA). */
export function historySummary(weeks = 4, now = new Date()): string {
  const { blocks, targets } = usePlanner.getState();
  const lines: string[] = [];
  for (let i = weeks; i >= 1; i--) {
    const start = addDays(startOfWeek(now), -7 * i);
    const stats = computeBalance(periodBlocks(blocks, { start: toKey(start), end: toKey(addDays(start, 6)) }), targets, now);
    if (!stats.plannedTotal) continue;
    const parts = QUADRANTS.map(
      (q) => `${q.name} agendado ${Math.round(stats.plan[q.id])}% / cumplido ${stats.rate[q.id] === null ? "—" : Math.round((stats.rate[q.id] ?? 0) * 100) + "%"} (obj ${targets[q.id]}%)`,
    );
    lines.push(`Semana del ${toKey(start)}: ${parts.join("; ")}.`);
  }
  return lines.join("\n");
}

export async function recommendTargets(answers: TargetsAnswers): Promise<TargetsProposal & { source: Source }> {
  if (!(await aiEnabled())) return { ...ruleTargets(answers), source: "rules" };
  try {
    const res = await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, history: historySummary() }),
    });
    if (res.ok) {
      const data = (await res.json()) as TargetsProposal;
      const targets = sumsTo100(data.targets) ? data.targets : roundTo5(data.targets);
      return { targets, explanation: data.explanation, source: "ai" };
    }
  } catch {
    // Sin conexión: seguimos con las reglas.
  }
  return { ...ruleTargets(answers), source: "rules" };
}

// ---------- Misiones ----------

/** Valida los horarios que propone la IA contra lo que ya está agendado. */
function validSlots(drafts: MissionsPlan["missions"], week: DateKey, now = new Date()): MissionDraft[] {
  const { blocks, activities, sleep } = usePlanner.getState();
  const days = new Set(weekDaysOf(week));
  const today = toKey(now);
  const taken = blocks.filter((b) => days.has(b.date) && b.status !== "skipped").map((b) => ({ date: b.date, start: b.start, end: b.start + b.minutes }));
  const out: MissionDraft[] = [];

  for (const m of drafts.slice(0, 4)) {
    if (!QUADRANT_BY_ID[m.quadrant] || !m.title?.trim()) continue;
    const minutes = [30, 60, 120, 180, 240].includes(m.minutes) ? m.minutes : 60;
    const slots = [];
    for (const s of m.slots ?? []) {
      const start = Math.round(s.start / STEP) * STEP;
      if (!days.has(s.date) || s.date < today) continue;
      const { wake, bed } = awakeWindow(s.date, sleep);
      if (start < wake || start + minutes > bed) continue;
      if (s.date === today && start <= nowMinutes(now)) continue;
      const clash = taken.some((t) => t.date === s.date && start < t.end && start + minutes > t.start);
      if (clash) continue;
      slots.push({ date: s.date, start });
      taken.push({ date: s.date, start, end: start + minutes });
    }
    const act = activities.find((a) => a.quadrant === m.quadrant && a.name.toLowerCase() === m.activityName.trim().toLowerCase());
    // Las misiones de corte (por ejemplo de trabajo) no llevan horarios; las demás necesitan al menos uno.
    if (!slots.length && m.quadrant !== "trabajo") continue;
    out.push({
      quadrant: m.quadrant,
      activityName: act?.name ?? m.activityName.trim(),
      activityId: act?.id,
      title: m.title.trim(),
      why: m.why.trim(),
      minutes,
      slots,
    });
  }
  return out;
}

export async function proposeMissions(week: DateKey): Promise<{ intro: string; missions: MissionDraft[]; source: Source }> {
  const { blocks, targets, activities } = usePlanner.getState();
  try {
    if (!(await aiEnabled())) throw new Error("sin IA");
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week, context: `${buildContext()}\n\nCómo vino las últimas semanas:\n${historySummary()}` }),
    });
    if (res.ok) {
      const data = (await res.json()) as MissionsPlan;
      const missions = validSlots(data.missions, week);
      if (missions.length) return { intro: data.intro, missions, source: "ai" };
    }
  } catch {
    // Sin conexión: seguimos con las reglas.
  }
  const missions = ruleMissions(week, blocks, targets, activities, usePlanner.getState().sleep);
  return {
    intro: missions.length
      ? "Mirando cómo está armada tu semana, te propongo esto para acercarte a tu balance."
      : "Tu semana ya está bien repartida. No hace falta sumar nada: a disfrutarla.",
    missions,
    source: "rules",
  };
}

/** Acepta la misión: crea la actividad si hace falta y agenda un bloque por cada horario. */
export function scheduleMission(draft: MissionDraft, week: DateKey, slots = draft.slots): Mission {
  const store = usePlanner.getState();
  const activity = store.addActivity(draft.quadrant, draft.activityName);
  const blockIds = slots
    .map((s) =>
      store.addBlock({
        title: activity.name,
        quadrant: activity.quadrant,
        activityId: activity.id,
        minutes: draft.minutes,
        date: s.date,
        start: s.start,
      }),
    )
    .filter((id): id is string => !!id);
  return store.addMission({
    week,
    quadrant: draft.quadrant,
    activityId: activity.id,
    title: draft.title,
    why: draft.why,
    count: Math.max(1, slots.length),
    minutes: draft.minutes,
    status: blockIds.length ? "scheduled" : "later",
    blockIds,
  });
}

/** "Lo agendo después": queda como tarea pendiente arriba de la semana. */
export function deferMission(draft: MissionDraft, week: DateKey): Mission {
  const store = usePlanner.getState();
  const activity = store.addActivity(draft.quadrant, draft.activityName);
  return store.addMission({
    week,
    quadrant: draft.quadrant,
    activityId: activity.id,
    title: draft.title,
    why: draft.why,
    count: Math.max(1, draft.slots.length),
    minutes: draft.minutes,
    status: "later",
    blockIds: [],
  });
}

/** Progreso de una misión: cuántas de sus veces ya se cumplieron. */
export function missionProgress(m: Mission): { done: number; scheduled: number } {
  const { blocks } = usePlanner.getState();
  const mine = blocks.filter((b) => m.blockIds.includes(b.id));
  return { done: mine.filter((b) => b.status === "done").length, scheduled: mine.length };
}

// ---------- Ajuste del objetivo ----------

export interface TargetAdjustment {
  quadrant: QuadrantId;
  from: number;
  to: number;
  /** Cuadrante que absorbe la diferencia para seguir sumando 100. */
  giveTo: QuadrantId;
  weeks: number;
}

/**
 * Si un cuadrante viene bastante por debajo de su objetivo varias semanas seguidas
 * (en lo agendado), propone un escalón intermedio más alcanzable.
 */
export function suggestAdjustment(now = new Date()): TargetAdjustment | null {
  const { blocks, targets } = usePlanner.getState();
  const weeks = [1, 2, 3].map((i) => {
    const start = addDays(startOfWeek(now), -7 * i);
    return computeBalance(periodBlocks(blocks, { start: toKey(start), end: toKey(addDays(start, 6)) }), targets, now);
  });
  if (weeks.some((w) => w.plannedTotal === 0)) return null;

  const lagging = QUADRANTS.filter((q) => q.id !== "trabajo" && targets[q.id] >= 10)
    .map((q) => ({ id: q.id, avg: weeks.reduce((acc, w) => acc + w.plan[q.id], 0) / weeks.length }))
    .filter((q) => weeks.every((w) => w.plan[q.id] < targets[q.id] - 7))
    .sort((a, b) => targets[b.id] - b.avg - (targets[a.id] - a.avg))[0];
  if (!lagging) return null;

  const surplus = QUADRANTS.filter((q) => q.id !== lagging.id)
    .map((q) => ({ id: q.id, extra: weeks.reduce((acc, w) => acc + w.plan[q.id], 0) / weeks.length - targets[q.id] }))
    .sort((a, b) => b.extra - a.extra)[0];

  return {
    quadrant: lagging.id,
    from: targets[lagging.id],
    to: Math.max(5, targets[lagging.id] - 5),
    giveTo: surplus.id,
    weeks: weeks.length,
  };
}

export function applyAdjustment(adj: TargetAdjustment) {
  const { targets, setTargets } = usePlanner.getState();
  const diff = adj.from - adj.to;
  setTargets({ ...targets, [adj.quadrant]: adj.to, [adj.giveTo]: targets[adj.giveTo] + diff });
}

/** Semana del ritual pendiente que corresponde abrir sola ahora, o null. */
export function pendingRitualWeek(now = new Date()): DateKey | null {
  const { ritual, ritualLog, onboarded } = usePlanner.getState();
  if (!ritual.enabled || !onboarded) return null;
  // El momento del ritual de esta semana (lunes = 0 … domingo = 6 desde el lunes).
  const monday = startOfWeek(now);
  const offset = (ritual.day + 6) % 7;
  let moment = addDays(monday, offset);
  moment.setHours(ritual.hour, 0, 0, 0);
  if (moment > now) moment = addDays(moment, -7);
  const week = weekToPlanFrom(moment);
  // Solo si no se hizo (u omitió) y a la semana le queda más de hoy: armar una semana que termina hoy no sirve.
  if (ritualLog[week] || toKey(addDays(fromKey(week), 6)) <= toKey(now)) return null;
  return week;
}

/** Igual que weekToPlan pero a partir del momento del ritual. */
function weekToPlanFrom(moment: Date): DateKey {
  const dow = moment.getDay();
  const monday = startOfWeek(moment);
  return toKey(dow === 0 || dow === 6 ? addDays(monday, 7) : monday);
}
