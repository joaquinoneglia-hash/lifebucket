import { computeBalance, type BalanceStats } from "./balance";
import { addDays, formatWeekRange, fromKey, startOfWeek, toKey, type DateKey } from "./dates";
import { formatMinutes } from "./format";
import { isRoutine, LIFE_QUADRANTS, QUADRANT_BY_ID, QUADRANTS, quadrantRecord, type QuadrantId, type QuadrantRecord } from "./quadrants";
import { SLOTS, slotOf } from "./slots";
import { daysBetween, withLibre } from "./sleep";
import { usePlanner, type Activity, type Block } from "./store";

export type PeriodKind = "week" | "month" | "year";

export interface Period {
  kind: PeriodKind;
  start: DateKey;
  end: DateKey;
  anchor: Date;
}

const monthLong = new Intl.DateTimeFormat("es-AR", { month: "long" });
const monthShort = new Intl.DateTimeFormat("es-AR", { month: "short" });
const stripDots = (s: string) => s.replace(/\./g, "");

export function periodOf(kind: PeriodKind, anchor: Date): Period {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  if (kind === "week") {
    const s = startOfWeek(anchor);
    return { kind, start: toKey(s), end: toKey(addDays(s, 6)), anchor: s };
  }
  if (kind === "month") {
    return { kind, start: toKey(new Date(y, m, 1)), end: toKey(new Date(y, m + 1, 0)), anchor: new Date(y, m, 1) };
  }
  return { kind, start: toKey(new Date(y, 0, 1)), end: toKey(new Date(y, 11, 31)), anchor: new Date(y, 0, 1) };
}

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  const a = p.anchor;
  if (p.kind === "week") return periodOf("week", addDays(a, 7 * dir));
  if (p.kind === "month") return periodOf("month", new Date(a.getFullYear(), a.getMonth() + dir, 1));
  return periodOf("year", new Date(a.getFullYear() + dir, 0, 1));
}

export function periodLabel(p: Period): string {
  if (p.kind === "week") return formatWeekRange(p.anchor);
  if (p.kind === "month") return `${monthLong.format(p.anchor)} ${p.anchor.getFullYear()}`;
  return String(p.anchor.getFullYear());
}

/** "tu semana", "tu mes", "tu año" */
export const PERIOD_NOUN: Record<PeriodKind, string> = { week: "semana", month: "mes", year: "año" };

/** "esta semana", "este mes", "este año" */
export const THIS_PERIOD: Record<PeriodKind, string> = { week: "esta semana", month: "este mes", year: "este año" };

export const inPeriod = (blocks: Block[], p: { start: DateKey; end: DateKey }) =>
  blocks.filter((b) => b.date >= p.start && b.date <= p.end);

/** Los bloques del período más el Libre que completa cada día: todo el tiempo despierto queda asignado. */
export const periodBlocks = (blocks: Block[], p: { start: DateKey; end: DateKey }) =>
  withLibre(inPeriod(blocks, p), daysBetween(p.start, p.end), usePlanner.getState().sleep);

/** Bloques que ya pasaron y siguen sin marcar. */
export function overdueBlocks(blocks: Block[], today: DateKey, now: number): Block[] {
  return blocks
    .filter(
      (b) =>
        !isRoutine(b.quadrant) &&
        b.status === "pending" &&
        (b.date < today || (b.date === today && b.start + b.minutes <= now)),
    )
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
}

// ---------- Por cuadrante ----------

export interface QuadrantReport {
  id: QuadrantId;
  done: number;
  /** Lo que ya debería haber pasado (incluye "hoy no" y pendientes vencidos). */
  due: number;
  rate: number | null;
  real: number;
  target: number;
}

export function quadrantReports(
  blocks: Block[],
  stats: BalanceStats,
  targets: QuadrantRecord<number>,
  today: DateKey,
): QuadrantReport[] {
  const due = quadrantRecord(0);
  for (const b of blocks) if (b.date <= today) due[b.quadrant] += b.minutes;
  return QUADRANTS.map((q) => ({
    id: q.id,
    done: stats.done[q.id],
    due: due[q.id],
    rate: due[q.id] > 0 ? stats.done[q.id] / due[q.id] : null,
    real: stats.real[q.id],
    target: targets[q.id],
  }));
}

export function completionRate(blocks: Block[], today: DateKey): number | null {
  let due = 0;
  let done = 0;
  for (const b of blocks) {
    if (b.date > today) continue;
    due += b.minutes;
    if (b.status === "done") done += b.minutes;
  }
  return due > 0 ? done / due : null;
}

// ---------- Series para gráficos ----------

export interface Bucket {
  key: string;
  label: string;
  short: string;
  /** Minutos cumplidos por cuadrante. */
  values: QuadrantRecord<number>;
  total: number;
}

export function buckets(blocks: Block[], p: Period): Bucket[] {
  const make = (key: string, label: string, short: string): Bucket => ({
    key,
    label,
    short,
    values: quadrantRecord(0),
    total: 0,
  });
  let list: Bucket[];
  let keyOf: (b: Block) => string;

  if (p.kind === "year") {
    const y = p.anchor.getFullYear();
    list = Array.from({ length: 12 }, (_, m) => {
      const d = new Date(y, m, 1);
      return make(String(m), `${monthLong.format(d)}`, stripDots(monthShort.format(d)));
    });
    keyOf = (b) => String(fromKey(b.date).getMonth());
  } else {
    list = [];
    for (let d = fromKey(p.start); toKey(d) <= p.end; d = addDays(d, 1)) {
      const key = toKey(d);
      const wd = stripDots(new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(d));
      list.push(
        make(key, `${wd} ${d.getDate()}`, p.kind === "week" ? `${wd} ${d.getDate()}` : String(d.getDate())),
      );
    }
    keyOf = (b) => b.date;
  }

  const byKey = new Map(list.map((x) => [x.key, x]));
  for (const b of blocks) {
    if (b.status !== "done") continue;
    const bucket = byKey.get(keyOf(b));
    if (!bucket) continue;
    bucket.values[b.quadrant] += b.minutes;
    bucket.total += b.minutes;
  }
  return list;
}

export interface TrendPoint {
  key: DateKey;
  label: string;
  /** Balance real (cómo se repartió lo cumplido). */
  score: number | null;
  /** Distribución (cómo se repartió lo agendado). */
  planScore: number | null;
}

/** Puntaje de balance semana a semana. */
export function trend(
  all: Block[],
  targets: QuadrantRecord<number>,
  p: Period,
  today: DateKey,
): TrendPoint[] {
  const weeks: Date[] = [];
  if (p.kind === "week") {
    for (let i = 7; i >= 0; i--) weeks.push(addDays(p.anchor, -7 * i));
  } else {
    const last = p.end < today ? p.end : today;
    for (let w = startOfWeek(fromKey(p.start)); toKey(w) <= last; w = addDays(w, 7)) weeks.push(w);
  }
  return weeks.map((w) => {
    const range = { start: toKey(w), end: toKey(addDays(w, 6)) };
    const stats = computeBalance(periodBlocks(all, range), targets);
    return {
      key: range.start,
      label: `Semana del ${w.getDate()} ${stripDots(monthShort.format(w))}`,
      score: stats.score,
      planScore: stats.planScore,
    };
  });
}

// ---------- Logros ----------

export type AchievementIcon = "balance" | "five" | "calendar" | "check" | "work" | QuadrantId;

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
}

const ACTIVE_DAYS: Record<PeriodKind, number> = { week: 5, month: 18, year: 150 };

const QUADRANT_WIN: Record<Exclude<QuadrantId, "trabajo" | "libre">, string> = {
  cuerpo: "Cuerpo en movimiento",
  mente: "Mente despierta",
  alma: "Alma cuidada",
  vinculos: "Cerca de los tuyos",
};

export function achievements(
  blocks: Block[],
  stats: BalanceStats,
  targets: QuadrantRecord<number>,
  kind: PeriodKind,
  today: DateKey,
): Achievement[] {
  const out: Achievement[] = [];
  if (stats.doneTotal === 0) return out;

  if (stats.score !== null && stats.score >= 80) {
    out.push({ id: "balance", icon: "balance", title: "Vida en equilibrio", description: `Tu balance llegó a ${stats.score}.` });
  }
  if (LIFE_QUADRANTS.every((q) => stats.done[q.id] > 0)) {
    out.push({ id: "five", icon: "five", title: "Los cinco", description: "Le diste tiempo a todas las partes de tu vida." });
  }
  const activeDays = new Set(blocks.filter((b) => b.status === "done").map((b) => b.date)).size;
  if (activeDays >= ACTIVE_DAYS[kind]) {
    out.push({ id: "calendar", icon: "calendar", title: "Constancia", description: `Cumpliste algo en ${activeDays} días distintos.` });
  }
  const rate = completionRate(blocks, today);
  if (rate !== null && rate >= 0.8) {
    out.push({ id: "check", icon: "check", title: "Palabra cumplida", description: `Hiciste el ${Math.round(rate * 100)}% de lo que planificaste.` });
  }
  for (const id of ["cuerpo", "mente", "alma", "vinculos"] as const) {
    if (stats.done[id] > 0 && stats.real[id] >= targets[id]) {
      out.push({
        id,
        icon: id,
        title: QUADRANT_WIN[id],
        description: `${QUADRANT_BY_ID[id].name} llegó a su objetivo: ${Math.round(stats.real[id])}% (${formatMinutes(stats.done[id])}).`,
      });
    }
  }
  if (stats.done.trabajo > 0 && stats.real.trabajo <= targets.trabajo + 5) {
    out.push({ id: "work", icon: "work", title: "Trabajo en su lugar", description: "El trabajo no se comió el resto de tu vida." });
  }
  return out;
}

// ---------- Recomendaciones ----------

export interface Recommendation {
  id: string;
  quadrant?: QuadrantId;
  title: string;
  body: string;
  action?: { quadrant: QuadrantId; activityId?: string; minutes: number };
}

const pct = (n: number) => `${Math.round(n)}%`;

export function recommendations(
  blocks: Block[],
  reports: QuadrantReport[],
  activities: Activity[],
  today: DateKey,
): Recommendation[] {
  const out: Recommendation[] = [];
  const doneAny = reports.some((r) => r.done > 0);
  if (!doneAny) return out;

  const firstActivity = (q: QuadrantId) => activities.find((a) => a.quadrant === q);

  // 1. El cuadrante más por debajo de su objetivo (sin contar trabajo).
  const behind = reports
    .filter((r) => r.id !== "trabajo" && r.id !== "libre" && r.target - r.real >= 5)
    .sort((a, b) => b.target - b.real - (a.target - a.real))[0];
  if (behind) {
    const act = firstActivity(behind.id);
    const name = QUADRANT_BY_ID[behind.id].name;
    out.push({
      id: `behind-${behind.id}`,
      quadrant: behind.id,
      title: `Más ${name}`,
      body: `Quedó en ${pct(behind.real)} y tu objetivo es ${pct(behind.target)}. Sumá dos o tres bloques cortos${act ? ` de ${act.name}` : ""}: con 30 minutos alcanza para empezar.`,
      action: { quadrant: behind.id, activityId: act?.id, minutes: 30 },
    });
  }

  // 2. Trabajo pasado de su objetivo.
  const work = reports.find((r) => r.id === "trabajo");
  if (work && work.real - work.target >= 10) {
    out.push({
      id: "work-over",
      quadrant: "trabajo",
      title: "El trabajo se llevó de más",
      body: `Ocupó ${pct(work.real)} de tu tiempo cumplido (objetivo ${pct(work.target)}). Elegí una hora de corte y reservá lo que sigue para Vínculos o Cuerpo.`,
    });
  }

  // 3. Lo que más cuesta cumplir una vez planificado.
  const hard = reports
    .filter((r) => !isRoutine(r.id) && r.rate !== null && r.due >= 60 && r.rate < 0.6)
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0];
  if (hard) {
    const name = QUADRANT_BY_ID[hard.id].name;
    out.push({
      id: `hard-${hard.id}`,
      quadrant: hard.id,
      title: `${name} cuesta sostener`,
      body: `De lo que planificaste en ${name} cumpliste ${pct((hard.rate ?? 0) * 100)}. Probá bloques más cortos o pasalos al momento del día en que más cumplís.`,
    });
  }

  // 4. El momento del día que mejor te funciona.
  const bySlot = SLOTS.map((s) => {
    let due = 0;
    let done = 0;
    for (const b of blocks) {
      if (b.date > today || slotOf(b.start) !== s.id) continue;
      due += b.minutes;
      if (b.status === "done") done += b.minutes;
    }
    return { slot: s, due, rate: due > 0 ? done / due : 0 };
  }).filter((x) => x.due >= 60);
  if (bySlot.length >= 2) {
    const best = [...bySlot].sort((a, b) => b.rate - a.rate)[0];
    if (best.rate >= 0.5) {
      out.push({
        id: `slot-${best.slot.id}`,
        title: `Tus ${best.slot.plural} rinden más`,
        body: `Cumpliste ${pct(best.rate * 100)} de lo que pusiste a la ${best.slot.name.toLowerCase()}. Usá ese momento para lo que más te cuesta.`,
      });
    }
  }

  return out;
}
