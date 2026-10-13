import { addDays, fromKey, toKey, type DateKey } from "./dates";
import type { ListItem, PendingSort, Repeat } from "./store";

/** Prioridades de un pendiente, de la más urgente a la menos. */
export const PRIORITIES = [
  { id: "alta", name: "Alta", color: "#e5484d" },
  { id: "media", name: "Media", color: "#e3a008" },
  { id: "baja", name: "Baja", color: "#8e96a3" },
] as const;
/** Para elegir, de menor a mayor. */
export const PRIORITY_CHOICES = [...PRIORITIES].reverse();
export const priorityOf = (i: ListItem) => PRIORITIES.find((p) => p.id === i.meta) ?? PRIORITIES[1];

export const REPEATS: { id: Repeat; label: string }[] = [
  { id: "diaria", label: "Todos los días" },
  { id: "semanal", label: "Cada semana" },
  { id: "mensual", label: "Cada mes" },
  { id: "anual", label: "Cada año" },
];

/** ¿Hay que avisarlo ya? Lo vencido y lo de hoy; los cumpleaños y aniversarios, 3 días antes. */
export function isUrgent(i: ListItem, today = toKey(new Date()), now = new Date()): boolean {
  if (i.done || !i.due) return false;
  if (i.remind !== undefined) {
    const when = fromKey(i.due);
    when.setMinutes((i.at ?? 9 * 60) - i.remind);
    return now >= when;
  }
  const d = daysLeft(i, today)!;
  return d <= ((i.kind === "cumple" || i.kind === "aniversario") ? 3 : 0);
}

/** "Hoy 18:00", para mostrar la hora si la tiene. */
export const atLabel = (i: ListItem) => (i.at === undefined ? "" : `${String(Math.floor(i.at / 60)).padStart(2, "0")}:${String(i.at % 60).padStart(2, "0")}`);

/** "Cumple 34" (si se cargó el año). */
export function turning(i: ListItem): string | null {
  if (!i.since || !i.due || (i.kind !== "cumple" && i.kind !== "aniversario")) return null;
  const n = Number(i.due.slice(0, 4)) - i.since;
  if (n <= 0) return null;
  return i.kind === "cumple" ? `Cumple ${n}` : `${n} ${n === 1 ? "año" : "años"}`;
}

/** Días hasta que vence (negativo: ya venció). null si no tiene fecha. */
export function daysLeft(i: ListItem, today = toKey(new Date())): number | null {
  if (!i.due) return null;
  return Math.round((fromKey(i.due).getTime() - fromKey(today).getTime()) / 86_400_000);
}

export const isOverdue = (i: ListItem, today = toKey(new Date())) => !i.done && (daysLeft(i, today) ?? 0) < 0;

/** "vence hoy", "vence en 3 días", "venció hace 2 días". */
export function dueLabel(i: ListItem, today = toKey(new Date())): { text: string; tone: "late" | "soon" | "ok" } | null {
  const d = daysLeft(i, today);
  if (d === null) return null;
  if (i.done) return { text: DAY.format(fromKey(i.due!)), tone: "ok" };
  // Siempre con la fecha que se puso.
  const date = DAY.format(fromKey(i.due!));
  if (d < 0) return { text: `Vencida · hace ${-d} ${d === -1 ? "día" : "días"} (${date})`, tone: "late" };
  if (d === 0) return { text: `Vence hoy · ${date}`, tone: "late" };
  if (d === 1) return { text: `Vence mañana · ${date}`, tone: "soon" };
  return { text: `Vence en ${d} días · ${date}`, tone: d <= 3 ? "soon" : "ok" };
}
const DAY = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/** La próxima fecha de un pendiente que se repite. */
export function nextDue(i: ListItem, today = toKey(new Date())): DateKey {
  const base = fromKey(i.due && i.due > today ? i.due : today);
  // Cumpleaños, aniversarios: el año que viene (desde su fecha, no desde hoy).
  if (i.repeat === "anual") {
    let d = fromKey(i.due ?? today);
    do d = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
    while (toKey(d) <= today);
    return toKey(d);
  }
  if (i.repeat === "diaria") return toKey(addDays(base, 1));
  if (i.repeat === "semanal") return toKey(addDays(base, 7));
  return toKey(new Date(base.getFullYear(), base.getMonth() + 1, base.getDate()));
}

/** Ordena: por prioridad (y dentro, por fecha), por fecha (y dentro, por prioridad) o como los acomodaste. */
export function sortPending(items: ListItem[], sort: PendingSort): ListItem[] {
  if (sort === "manual") return [...items];
  const p = (i: ListItem) => PRIORITIES.findIndex((x) => x.id === priorityOf(i).id);
  const d = (i: ListItem) => i.due ?? "9999-99-99";
  return [...items].sort((a, b) => (sort === "prioridad" ? p(a) - p(b) || d(a).localeCompare(d(b)) : d(a).localeCompare(d(b)) || p(a) - p(b)));
}

const MONTH = new Intl.DateTimeFormat("es-AR", { month: "long" });
const MONTH_Y = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
/** Agrupa por mes de vencimiento ("Octubre", "Noviembre"…); lo vencido de meses anteriores, arriba; sin fecha, al final. */
export function byMonth(items: ListItem[], today = toKey(new Date())): { key: string; label: string; items: ListItem[] }[] {
  const thisMonth = today.slice(0, 7);
  const groups = new Map<string, ListItem[]>();
  for (const i of items) {
    const k = !i.due ? "zz" : i.due.slice(0, 7) < thisMonth && !i.done ? "00" : i.due.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups.keys()].sort().map((k) => ({
    key: k,
    label:
      k === "zz"
        ? "Sin fecha"
        : k === "00"
          ? "Vencidos de antes"
          : (k.slice(0, 4) === today.slice(0, 4) ? MONTH : MONTH_Y).format(fromKey(`${k}-01`)).replace(/^./, (c) => c.toUpperCase()) + (k === thisMonth ? " · este mes" : ""),
    items: groups.get(k)!,
  }));
}
