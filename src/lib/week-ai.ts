import { awakeFor, carve, WEEK_ORDER } from "./routine";
import type { SleepSettings } from "./sleep";
import { newId, type Moment, type RoutineBlock, type TaskKind, type YearTask } from "./store";
import { formatTime } from "./time";
import type { WeekAction } from "./week-ai-schema";

const DAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const FROM = 5 * 60;
const TO = 24 * 60;
const pad = (n: number) => String(n).padStart(2, "0");

/** El estado actual en texto, para que el asistente sepa qué hay (con los ids para poder cambiarlo). */
export function buildContext(routine: RoutineBlock[], sleep: SleepSettings): string {
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const blocks = [...routine]
    .sort((a, b) => a.start - b.start)
    .map((b) => {
      const days = WEEK_ORDER.filter((d) => b.days.includes(d)).map((d) => `${d}(${DAY[d]})`).join(",");
      return `- id=${b.id} · ${b.name} · ${b.quadrant} · días ${days} · ${formatTime(b.start)} a ${formatTime(b.start + b.minutes)} (start ${b.start}, minutes ${b.minutes})`;
    });
  const awake = WEEK_ORDER.map((d) => {
    const w = awakeFor(d, sleep);
    return `${DAY[d]} ${formatTime(Math.max(FROM, w.wake))} a ${formatTime(Math.min(TO, w.bed))}`;
  });
  return [
    `Hoy: ${today} (${DAY[now.getDay()]}). Mes actual: ${today.slice(0, 7)}.`,
    `Despierto (fuera de esto duerme): ${awake.join(" · ")}.`,
    blocks.length ? `Bloques de la semana:\n${blocks.join("\n")}` : "La semana está vacía (no hay bloques).",
  ].join("\n");
}

type Effects = {
  addMoment: (m: Omit<Moment, "id">) => void;
  addTask: (t: Omit<YearTask, "id" | "done">) => void;
};

const clampBlock = (start: number, minutes: number) => {
  const s = Math.max(FROM, Math.min(TO - 30, Math.round(start / 30) * 30));
  const m = Math.max(30, Math.min(TO - s, Math.round(minutes / 30) * 30));
  return { start: s, minutes: m };
};

/**
 * Aplica los cambios propuestos sobre la semana (devuelve la nueva) y suma momentos u objetivos.
 * Como en el calendario: lo que se agrega encima de otro bloque, lo parte.
 */
export function applyWeekActions(routine: RoutineBlock[], actions: WeekAction[], fx: Effects): RoutineBlock[] {
  let week = [...routine];
  const thisMonth = new Date().toISOString().slice(0, 7);
  for (const a of actions) {
    switch (a.kind) {
      case "add_block": {
        if (!a.name || !a.days?.length || a.start == null) break;
        const { start, minutes } = clampBlock(a.start, a.minutes ?? 60);
        week = carve(week, { id: newId(), name: a.name, quadrant: a.quadrant ?? "libre", days: [...new Set(a.days)].filter((d) => d >= 0 && d <= 6), start, minutes });
        break;
      }
      case "update_block": {
        const b = week.find((x) => x.id === a.blockId);
        // Si habla de un día que ese bloque no tiene, no se toca nada (mejor eso que cambiar todos).
        if (!b || (a.onlyDay != null && !b.days.includes(a.onlyDay))) break;
        const { start, minutes } = clampBlock(a.start ?? b.start, a.minutes ?? b.minutes);
        const patch = { name: a.name ?? b.name, quadrant: a.quadrant ?? b.quadrant, start, minutes };
        if (a.onlyDay != null && b.days.length > 1 && b.days.includes(a.onlyDay)) {
          // Solo ese día: se separa del resto.
          const rest = week.map((x) => (x.id === b.id ? { ...x, days: x.days.filter((d) => d !== a.onlyDay) } : x));
          week = carve(rest, { ...b, ...patch, id: newId(), days: a.days?.length === 1 ? a.days : [a.onlyDay] });
        } else {
          week = carve(week, { ...b, ...patch, days: a.days?.length ? a.days : b.days });
        }
        break;
      }
      case "remove_block": {
        const b = week.find((x) => x.id === a.blockId);
        if (!b || (a.onlyDay != null && !b.days.includes(a.onlyDay))) break;
        if (a.onlyDay != null && b.days.length > 1) week = week.map((x) => (x.id === b.id ? { ...x, days: x.days.filter((d) => d !== a.onlyDay) } : x));
        else week = week.filter((x) => x.id !== b.id);
        break;
      }
      case "clear_week":
        week = [];
        break;
      case "add_moment": {
        if (!a.momentKind) break;
        fx.addMoment({ kind: a.momentKind, month: a.month ?? thisMonth, text: a.name?.trim() || "Momento", hours: a.hours ?? undefined });
        break;
      }
      case "add_task": {
        if (!a.name) break;
        const month = a.month ?? a.date?.slice(0, 7) ?? thisMonth;
        fx.addTask({ title: a.name, month, date: a.date && a.date.startsWith(month) ? a.date : undefined, kind: (a.taskKind ?? "otro") as TaskKind });
        break;
      }
    }
  }
  return week.filter((b) => b.days.length > 0);
}
