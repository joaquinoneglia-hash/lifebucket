import { addDays, fromKey, toKey, type DateKey } from "./dates";
import type { MoodEntry } from "./store";

/** Las emociones para elegir: primero las que hacen bien, después las que cuestan. */
export const FEELINGS = [
  { id: "feliz", label: "Feliz", emoji: "😊", color: "#f2b705" },
  { id: "tranquilo", label: "Tranquilo", emoji: "😌", color: "#3fa7a0" },
  { id: "agradecido", label: "Agradecido", emoji: "🙏", color: "#e5508a" },
  { id: "energia", label: "Con energía", emoji: "⚡", color: "#2e9e63" },
  { id: "cansado", label: "Cansado", emoji: "🥱", color: "#9aa3b2" },
  { id: "ansioso", label: "Ansioso", emoji: "😬", color: "#e08a2e" },
  { id: "triste", label: "Triste", emoji: "😢", color: "#4f7bd9" },
  { id: "angustiado", label: "Angustiado", emoji: "😣", color: "#7c5cd6" },
  { id: "enojado", label: "Enojado", emoji: "😠", color: "#d64545" },
  { id: "frustrado", label: "Frustrado", emoji: "😤", color: "#a8613a" },
] as const;

export const feelingOf = (id: string) => FEELINGS.find((f) => f.id === id) ?? { id, label: id, emoji: "•", color: "#9aa3b2" };

export type MoodPeriod = "semana" | "mes";

/** Los registros de una semana (lunes a domingo) o de un mes, y cuántas veces apareció cada emoción. */
export function moodRange(moods: MoodEntry[], period: MoodPeriod, anchor: Date) {
  let start: Date;
  let end: Date;
  if (period === "semana") {
    start = addDays(anchor, -((anchor.getDay() + 6) % 7));
    end = addDays(start, 6);
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  }
  const from = toKey(start);
  const to = toKey(end);
  const entries = moods.filter((m) => m.date >= from && m.date <= to && (m.feelings.length || m.text.trim())).sort((a, b) => a.date.localeCompare(b.date));
  const counts = new Map<string, number>();
  for (const e of entries) for (const f of e.feelings) counts.set(f, (counts.get(f) ?? 0) + 1);
  const mix = [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  return { from, to, entries, mix };
}

const SHORT = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const MONTH = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
export function periodLabel(period: MoodPeriod, from: DateKey, to: DateKey) {
  if (period === "mes") return MONTH.format(fromKey(from)).replace(/^./, (c) => c.toUpperCase());
  return `${SHORT.format(fromKey(from))} – ${SHORT.format(fromKey(to))}`;
}
