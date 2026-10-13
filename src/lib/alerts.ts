import { DEFAULT_ALERTS } from "./alerts-config";
import { idealOf, idealProgress } from "./balance-goals";
import { addDays, toKey, type DateKey } from "./dates";
import { QUADRANT_BY_ID } from "./quadrants";
import { goalsFor, type PlannerState } from "./store";
import { testKey } from "./test-mode";
import { thisMonday, weekMinutes } from "./week-shares";

/**
 * Alertas (no son recordatorios): cuándo la app te recuerda completar tus cosas. Por ahora avisan dentro de la
 * app (al abrirla o mientras la usás); los avisos con la app cerrada quedan para más adelante.
 */
export { DEFAULT_ALERTS, type AlertSettings } from "./alerts-config";

export type AlertKind = "noneg-am" | "noneg-pm" | "rutina" | "balde" | "metas";
export type DueAlert = { id: string; kind: AlertKind; title: string; body: string; part?: string };

const SEEN_KEY = () => testKey("lb:alertas-vistas");
export function seenAlerts(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY()) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function markAlertSeen(id: string) {
  try {
    localStorage.setItem(SEEN_KEY(), JSON.stringify([...seenAlerts(), id].slice(-120)));
  } catch {}
}

const hrs = (m: number) => `${String(Math.round(m / 30) / 2).replace(".", ",")} h`;

/** La alerta que toca ahora (una por vez, la más importante primero), o null. */
export function dueAlert(s: PlannerState, now = new Date(), seen = seenAlerts()): DueAlert | null {
  const a = { ...DEFAULT_ALERTS, ...(s.alerts ?? {}) };
  const today = toKey(now);
  const min = now.getHours() * 60 + now.getMinutes();
  const out: DueAlert[] = [];

  // No negociables de hoy: a la mañana (al abrir) y a la noche (si faltan).
  const goals = goalsFor(s, today.slice(0, 7));
  const checked = (s.dailyChecks[today] ?? []).filter((id) => goals.some((g) => g.id === id)).length;
  const missing = goals.length - checked;
  if (goals.length && missing > 0) {
    if (a.nonegNight && min >= a.nonegNightAt)
      out.push({ id: `noneg-pm@${today}`, kind: "noneg-pm", title: "¿Cómo te fue hoy con tus no negociables?", body: missing === goals.length ? "Todavía no marcaste ninguno. Tomate un minuto: tildá los que hiciste." : `Te ${missing === 1 ? "falta 1" : `faltan ${missing}`} por marcar. ¿Los hiciste?` });
    else if (a.nonegMorning && min >= 5 * 60 && min < 12 * 60)
      out.push({ id: `noneg-am@${today}`, kind: "noneg-am", title: "Buen día. Hoy van tus no negociables", body: goals.map((g) => g.name).join(" · ") });
  }

  // Reconfirmar la rutina: la última vez que tocaba (en los últimos 2 días).
  if (a.routine) {
    for (let k = 0; k <= 2; k++) {
      const d = addDays(now, -k);
      if (d.getDay() !== a.routineDay) continue;
      if (k === 0 && min < a.routineAt) break;
      out.push({ id: `rutina@${toKey(d)}`, kind: "rutina", title: "¿Confirmamos tu semana?", body: "Arranca una semana nueva. ¿La repetimos igual o querés cambiar algo de tu rutina?" });
      break;
    }
  }

  if (a.progress && s.setupDone && s.startedAt && s.startedAt < today) {
    // A mitad de semana (desde el miércoles): cómo viene el balde y qué le falta.
    const dow = now.getDay();
    if (dow >= 3 || dow === 0) {
      const ideal = idealOf(s.idealHours);
      const prog = idealProgress(weekMinutes(s.routine, s.logros, s.sleep), ideal);
      const low = [...prog.rows].sort((x, y) => x.pct - y.pct)[0];
      if (low && prog.pct < 100)
        out.push({
          id: `balde@${thisMonday()}`,
          kind: "balde",
          part: low.p,
          title: `Tu balde va ${prog.pct}% de tu ideal de la semana`,
          body: `Llevás ${hrs(prog.total)} de «Tiempo para mí». Lo que más falta: ${QUADRANT_BY_ID[low.p].name} (${hrs(low.minutes)} de ${hrs(low.goal)}). ¿Le hacés un lugar esta semana?`,
        });
    }
    // Metas del mes: desde el 20, si ninguna está cumplida.
    const month = today.slice(0, 7);
    const metas = s.tasks.filter((t) => t.month === month);
    if (now.getDate() >= 20 && metas.length && !metas.some((t) => t.done))
      out.push({ id: `metas@${month}`, kind: "metas", title: "Tus metas importantes del mes", body: "Por ahora no completaste ninguna meta importante… No te preocupes, esto suele pasar. ¡Ánimo! Cualquier cosa, las pasamos al mes siguiente." });
  }

  return out.find((x) => !seen.includes(x.id)) ?? null;
}

/** El día siguiente a terminar la guía, si todavía no configuraste las alertas: se resalta la ruedita. */
export function shouldHighlightAlerts(s: PlannerState, today: DateKey = toKey(new Date())) {
  return s.setupDone && !(s.alerts?.configured ?? false) && !!s.startedAt && s.startedAt < today;
}
