import type { PlanAction } from "./assistant-schema";
import { addDays, dayLabel, startOfWeek, toKey, type DateKey } from "./dates";
import { QUADRANTS, type QuadrantId } from "./quadrants";
import { computeBalance } from "./balance";
import { inPeriod, periodBlocks } from "./report";
import { describeRepeat, usePlanner, type Block } from "./store";
import { awakeWindow, sleepMinutes } from "./sleep";
import { clampStart, formatTime, formatTimeRange, nowMinutes, STEP } from "./time";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Lo que el asistente necesita saber: días, actividades, bloques y balance. */
export function buildContext(now = new Date()): string {
  const { activities, blocks, targets, series, sleep } = usePlanner.getState();
  const today = toKey(now);
  const monday = startOfWeek(now);
  const range = { start: toKey(monday), end: toKey(addDays(monday, 13)) };
  const weekStats = computeBalance(periodBlocks(blocks, { start: range.start, end: toKey(addDays(monday, 6)) }), targets);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(monday, i);
    return `${toKey(d)} (${WEEKDAYS[d.getDay()]}${toKey(d) === today ? ", HOY" : ""})`;
  });

  const byQuadrant = QUADRANTS.map(
    (q) =>
      `- ${q.name} [${q.id}]: ${activities.filter((a) => a.quadrant === q.id).map((a) => a.name).join(", ") || "(ninguna)"}`,
  );

  const listed = inPeriod(blocks, range)
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))
    .map((b) => {
      const repeats = b.seriesId ? series.find((s) => s.id === b.seriesId) : undefined;
      return `- id=${b.id} | ${b.date} ${formatTimeRange(b.start, b.minutes)} | ${b.title} [${b.quadrant}] | ${b.minutes} min | ${b.status}${repeats ? ` | se repite ${describeRepeat(repeats.days)}` : ""}`;
    });

  const balance = QUADRANTS.map(
    (q) => `${q.name}: ${Math.round(weekStats.real[q.id])}% (objetivo ${targets[q.id]}%)`,
  ).join(" · ");

  return [
    `Ahora: ${today} ${formatTime(Math.floor(nowMinutes(now) / STEP) * STEP)}.`,
    `Días disponibles (esta semana y la próxima):\n${days.join("\n")}`,
    `Actividades por cuadrante:\n${byQuadrant.join("\n")}`,
    `Bloques agendados (estado: pending = pendiente, done = cumplido, skipped = no se hizo):\n${listed.join("\n") || "(ninguno)"}`,
    `Balance cumplido esta semana: ${balance}.`,
    `Horario de sueño (fijo, no se agenda nada ahí): lunes a viernes de ${formatTime(sleep.weekday.wake)} a ${formatTime(sleep.weekday.bed)} despierto (${Math.round(sleepMinutes(sleep.weekday) / 60)} h de sueño); fin de semana de ${formatTime(sleep.weekend.wake)} a ${formatTime(sleep.weekend.bed)}. Las horas después de las 24:00 se escriben como 1440+ (ej. 00:30 = 1470) y pertenecen al mismo día.`,
    "Todo el tiempo despierto sin actividad cuenta como Libre automáticamente (descanso, ocio, traslados, casa). No hace falta agendar Libre salvo que el usuario lo pida con nombre (por ejemplo una siesta).",
  ].join("\n\n");
}

/** Un cambio ya validado contra el estado actual, listo para mostrar y aplicar. */
export interface ResolvedAction {
  action: PlanAction;
  quadrant: QuadrantId;
  label: string;
  detail: string;
}

const isDateKey = (s: string | null): s is DateKey => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const normMinutes = (m: number | null | undefined, fallback: number) =>
  [30, 60, 120].includes(m ?? -1) ? (m as number) : fallback;
/** Inicio válido dentro de la ventana despierto de ese día (el sueño no se toca). */
const normStart = (date: DateKey, s: number | null | undefined, minutes: number, fallback: number) => {
  const { wake, bed } = awakeWindow(date, usePlanner.getState().sleep);
  const base = typeof s === "number" ? Math.round(s / STEP) * STEP : fallback;
  return clampStart(base, minutes, wake, bed);
};

const when = (date: DateKey, start: number, minutes: number) => {
  const label = dayLabel(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${formatTimeRange(start, minutes)}`;
};

/** Descarta lo que no se puede aplicar (ids que no existen, fechas inválidas) y arma el texto de cada cambio. */
export function resolvePlan(actions: PlanAction[]): ResolvedAction[] {
  const { blocks } = usePlanner.getState();
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const out: ResolvedAction[] = [];

  for (const a of actions) {
    if (a.kind === "add") {
      if (!a.activityName?.trim() || !a.quadrant || !isDateKey(a.date)) continue;
      const minutes = normMinutes(a.minutes, 60);
      const start = normStart(a.date, a.start, minutes, 9 * 60);
      const repeat = a.repeatDays?.filter((d) => d >= 0 && d <= 6) ?? [];
      out.push({
        action: { ...a, minutes, start, repeatDays: repeat.length ? repeat : null },
        quadrant: a.quadrant,
        label: a.activityName.trim(),
        detail: `${when(a.date, start, minutes)}${repeat.length ? ` · se repite ${describeRepeat(repeat)}` : ""}`,
      });
      continue;
    }

    const block = a.blockId ? byId.get(a.blockId) : undefined;
    if (!block) continue;

    if (a.kind === "move") {
      const date = isDateKey(a.date) ? a.date : block.date;
      const start = normStart(date, a.start, block.minutes, block.start);
      if (date === block.date && start === block.start) continue;
      out.push({ action: { ...a, date, start }, quadrant: block.quadrant, label: block.title, detail: `Pasa a ${when(date, start, block.minutes).toLowerCase()}` });
    } else if (a.kind === "update") {
      const minutes = normMinutes(a.minutes, block.minutes);
      out.push({
        action: { ...a, minutes },
        quadrant: a.quadrant ?? block.quadrant,
        label: a.activityName?.trim() || block.title,
        detail: `${a.activityName && a.activityName !== block.title ? `Antes: ${block.title} · ` : ""}${when(block.date, clampStart(block.start, minutes), minutes)}`,
      });
    } else if (a.kind === "remove") {
      out.push({ action: a, quadrant: block.quadrant, label: block.title, detail: `Se borra · ${when(block.date, block.start, block.minutes).toLowerCase()}` });
    } else if (a.kind === "mark" && a.status) {
      const text = { done: "Cumplido", skipped: "No se hizo", pending: "Pendiente" }[a.status];
      out.push({ action: a, quadrant: block.quadrant, label: block.title, detail: `${text} · ${when(block.date, block.start, block.minutes).toLowerCase()}` });
    }
  }
  return out;
}

/** Aplica los cambios confirmados. Devuelve cuántos se aplicaron. */
export function applyPlan(resolved: ResolvedAction[]): number {
  const store = usePlanner.getState();
  let applied = 0;

  for (const { action: a } of resolved) {
    const block: Block | undefined = a.blockId ? usePlanner.getState().blocks.find((b) => b.id === a.blockId) : undefined;

    if (a.kind === "add" && a.activityName && a.quadrant && a.date) {
      const activity = store.addActivity(a.quadrant, a.activityName);
      store.addBlock(
        {
          title: activity.name,
          quadrant: activity.quadrant,
          activityId: activity.id,
          minutes: a.minutes ?? 60,
          date: a.date,
          start: a.start ?? 9 * 60,
        },
        a.repeatDays,
      );
      applied++;
    } else if (block && a.kind === "move" && a.date && a.start !== null) {
      store.moveBlock(block.id, a.date, a.start);
      applied++;
    } else if (block && a.kind === "update") {
      const activity = a.activityName && a.quadrant ? store.addActivity(a.quadrant, a.activityName) : undefined;
      const minutes = a.minutes ?? block.minutes;
      store.updateBlock(
        block.id,
        {
          ...(activity ? { title: activity.name, quadrant: activity.quadrant, activityId: activity.id } : {}),
          minutes,
          start: clampStart(block.start, minutes),
        },
        "this",
      );
      applied++;
    } else if (block && a.kind === "remove") {
      store.removeBlock(block.id, "this");
      applied++;
    } else if (block && a.kind === "mark" && a.status) {
      store.setStatus(block.id, a.status);
      applied++;
    }
  }
  return applied;
}

/** Primer día que toca el plan, para mostrarle esa semana al usuario después de aplicar. */
export const firstDayOfPlan = (resolved: ResolvedAction[]): DateKey | undefined =>
  resolved.map((r) => r.action.date).filter(isDateKey).sort()[0];
