import { toKey } from "./dates";
import { isRoutine, QUADRANTS, quadrantRecord, type QuadrantRecord } from "./quadrants";
import type { Block } from "./store";
import { nowMinutes } from "./time";

/**
 * Dos conceptos distintos, siempre separados:
 * - Distribución: cómo repartiste tu 100% al agendar, contra tu objetivo ("¿armé bien la semana?").
 * - Cumplimiento: de lo agendado que ya pasó, cuánto hiciste ("¿lo sostuve?").
 */
export interface BalanceStats {
  /** Minutos agendados por cuadrante (todo, hecho o no). */
  planned: QuadrantRecord<number>;
  plannedTotal: number;
  /** % de lo agendado que va a cada cuadrante (la distribución). */
  plan: QuadrantRecord<number>;
  /** 0–100: qué tan cerca está la distribución agendada del objetivo. Null sin nada agendado. */
  planScore: number | null;

  /** Minutos agendados que ya pasaron (se podían haber hecho). */
  due: QuadrantRecord<number>;
  dueTotal: number;
  /** Minutos cumplidos. */
  done: QuadrantRecord<number>;
  doneTotal: number;
  /** De lo que ya pasó, cuánto se hizo (0–1). Null si todavía no pasó nada. */
  completion: number | null;
  rate: QuadrantRecord<number | null>;

  /** % de lo cumplido que fue a cada cuadrante (cómo se repartió lo que de verdad hiciste). */
  real: QuadrantRecord<number>;
  /** 0–100: qué tan cerca está lo cumplido del objetivo. Null sin nada cumplido. */
  score: number | null;
}

const closeness = (share: QuadrantRecord<number>, targets: QuadrantRecord<number>) =>
  Math.round(100 - QUADRANTS.reduce((acc, q) => acc + Math.abs(share[q.id] - targets[q.id]), 0) / 2);

export function computeBalance(
  blocks: Block[],
  targets: QuadrantRecord<number>,
  now: Date = new Date(),
): BalanceStats {
  const today = toKey(now);
  const minute = nowMinutes(now);
  const planned = quadrantRecord(0);
  const due = quadrantRecord(0);
  const done = quadrantRecord(0);
  let plannedTotal = 0;
  let dueTotal = 0;
  let doneTotal = 0;
  /** Cumplido sin contar Libre ni Trabajo (para el % de cumplimiento: solo lo que se marca). */
  let doneCommitted = 0;

  for (const b of blocks) {
    planned[b.quadrant] += b.minutes;
    plannedTotal += b.minutes;
    const isPast = b.date < today || (b.date === today && b.start + b.minutes <= minute);

    // Libre y Trabajo no se marcan: cuando pasa, ya pasó. No tienen check-in.
    if (isRoutine(b.quadrant)) {
      if (isPast) {
        done[b.quadrant] += b.minutes;
        doneTotal += b.minutes;
      }
      continue;
    }

    // Lo marcado como hecho cuenta como "ya pasó" aunque sea temprano.
    if (isPast || b.status === "done") {
      due[b.quadrant] += b.minutes;
      dueTotal += b.minutes;
    }
    if (b.status === "done") {
      done[b.quadrant] += b.minutes;
      doneTotal += b.minutes;
      doneCommitted += b.minutes;
    } else if (b.status === "skipped" && isPast) {
      // No existe "no hacer nada": ese tiempo se fue a Libre.
      done.libre += b.minutes;
      doneTotal += b.minutes;
    }
  }

  const plan = quadrantRecord(0);
  const real = quadrantRecord(0);
  const rate = quadrantRecord<number | null>(null);
  for (const q of QUADRANTS) {
    if (plannedTotal > 0) plan[q.id] = (planned[q.id] / plannedTotal) * 100;
    if (doneTotal > 0) real[q.id] = (done[q.id] / doneTotal) * 100;
    rate[q.id] = due[q.id] > 0 ? done[q.id] / due[q.id] : null;
  }

  return {
    planned,
    plannedTotal,
    plan,
    planScore: plannedTotal > 0 ? closeness(plan, targets) : null,
    due,
    dueTotal,
    done,
    doneTotal,
    completion: dueTotal > 0 ? doneCommitted / dueTotal : null,
    rate,
    real,
    score: doneTotal > 0 ? closeness(real, targets) : null,
  };
}

/** Horas que faltan (+) o sobran (−) en lo agendado para llegar al objetivo de cada cuadrante. */
export function planGap(stats: BalanceStats, targets: QuadrantRecord<number>): QuadrantRecord<number> {
  const gap = quadrantRecord(0);
  for (const q of QUADRANTS) {
    gap[q.id] = Math.round((targets[q.id] / 100) * stats.plannedTotal - stats.planned[q.id]);
  }
  return gap;
}
