import type { Moment, MomentKind } from "./store";

/**
 * Cuánto pesa cada momento (algo que no es rutina), en horas aproximadas: una cita o un encuentro
 * familiar suele llevar una tarde o una noche; una salida con amigos algo menos; un plan de disfrute
 * (salir a bailar, un bar, un recital) unas 3 h. Así suman a tu semana aunque no estén en el calendario.
 */
export const BOND_HOURS: Record<MomentKind, number> = { amor: 3, familia: 3, amigos: 2.5, disfrute: 3 };

/** Las categorías de Vínculos (Disfrute va aparte). */
export const BOND_KINDS: MomentKind[] = ["amor", "familia", "amigos"];

/** Semanas promedio de un mes. */
const WEEKS_PER_MONTH = 4.3;

export const monthKeyOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const weekly = (hours: number) => Math.round((hours * 60) / WEEKS_PER_MONTH);

/** Las horas de un momento: las que cargaste o, si no, las típicas de su tipo. */
export const hoursOf = (m: Moment) => m.hours ?? BOND_HOURS[m.kind];

/** Minutos por semana que suman los momentos de Vínculos del mes (el total del mes repartido en sus semanas). */
export function bondWeekMinutes(moments: Moment[], month = monthKeyOf()): number {
  return weekly(moments.filter((m) => m.month === month && BOND_KINDS.includes(m.kind)).reduce((acc, m) => acc + hoursOf(m), 0));
}

/** Minutos por semana que suman los planes de Disfrute del mes. */
export function funWeekMinutes(moments: Moment[], month = monthKeyOf()): { count: number; minutes: number } {
  const list = moments.filter((m) => m.month === month && m.kind === "disfrute");
  return { count: list.length, minutes: weekly(list.reduce((acc, m) => acc + hoursOf(m), 0)) };
}

/** Vínculos por categoría: cuántos momentos y cuántos minutos por semana suman. */
export function bondBreakdown(moments: Moment[], month = monthKeyOf()): { kind: MomentKind; count: number; minutes: number }[] {
  return BOND_KINDS.map((kind) => {
    const list = moments.filter((m) => m.month === month && m.kind === kind);
    return { kind, count: list.length, minutes: weekly(list.reduce((acc, m) => acc + hoursOf(m), 0)) };
  });
}
