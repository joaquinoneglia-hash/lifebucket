import type { DateKey } from "./dates";
import type { DailyGoal } from "./store";

/** Los objetivos diarios arrancan con 5 lugares; se pueden sumar más. */
export const BASE_GOALS = 5;

const pad = (n: number) => String(n).padStart(2, "0");

/** Los días de un mes ("2026-10") como claves. */
export function monthDays(month: string): DateKey[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${month}-${pad(i + 1)}` as DateKey);
}

/** Cuántos objetivos se cumplieron un día (solo cuentan los que existen hoy). */
export function dayScore(goals: DailyGoal[], checks: Record<DateKey, string[]>, date: DateKey): number {
  const ids = new Set(checks[date] ?? []);
  return goals.filter((g) => ids.has(g.id)).length;
}

/**
 * Cómo va un mes: el % de cumplimiento (tildes sobre lo posible hasta hoy), el de cada objetivo y el puntaje
 * de cada día. Los días que todavía no llegaron no cuentan.
 */
export function monthStats(goals: DailyGoal[], checks: Record<DateKey, string[]>, month: string, today: DateKey, from: DateKey | "" = "") {
  return rangeStats(goals, checks, monthDays(month), today, from);
}

/** Lo mismo para cualquier lista de días (una semana, un mes). No cuentan los días antes de que empezaras. */
export function rangeStats(goals: DailyGoal[], checks: Record<DateKey, string[]>, all: DateKey[], today: DateKey, from: DateKey | "" = "") {
  const counts = (d: DateKey) => d <= today && (!from || d >= from);
  const days = all.filter(counts);
  const perDay = all.map((date) => ({ date, score: counts(date) ? dayScore(goals, checks, date) : null }));
  const perGoal = goals.map((g) => {
    const done = days.filter((d) => (checks[d] ?? []).includes(g.id)).length;
    return { goal: g, done, pct: days.length ? Math.round((done / days.length) * 100) : 0 };
  });
  const possible = goals.length * days.length;
  const done = perGoal.reduce((acc, g) => acc + g.done, 0);
  return { pct: possible ? Math.round((done / possible) * 100) : 0, done, possible, days: days.length, perGoal, perDay };
}
