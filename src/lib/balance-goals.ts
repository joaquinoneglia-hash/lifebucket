import type { Part } from "./week-shares";

/**
 * Tu balde ideal: cuántas horas por semana para cada cosa que es para vos. Los valores por defecto salen de la
 * investigación (se pueden ajustar):
 * - Deporte: la OMS recomienda 150–300 min de actividad moderada por semana y fuerza 2 días → 3 h.
 * - Mente y Espíritu: 10–20 min por día ya tienen beneficios medibles; pesa más la constancia → 2 h.
 * - Vínculos: ver a la gente cercana unas 2 veces por semana (en promedio, 9–11 h con amigos) → 6 h.
 * - Hobbies: parte de las 2–5 h diarias de tiempo propio que se asocian a más bienestar → 4 h.
 * - Intelecto y Cognitivo: sin un estándar científico; ~30 min por día como punto de partida → 3 h.
 * En total, unas 18 h por semana (≈ 2,5 h por día): dentro del rango de 2 a 5 h diarias.
 */
export const IDEAL_PARTS = ["cuerpo", "interior", "alma", "mente", "vinculos"] as const satisfies readonly Part[];
export type IdealPart = (typeof IDEAL_PARTS)[number];
export const DEFAULT_IDEAL: Record<IdealPart, number> = { cuerpo: 3, interior: 2, alma: 4, mente: 3, vinculos: 6 };

/** Por qué cada meta (en una línea, para mostrar al ajustarla). */
export const IDEAL_WHY: Record<IdealPart, string> = {
  cuerpo: "La OMS recomienda 150–300 min por semana, y fuerza 2 días.",
  interior: "Con 10–20 min por día ya se notan los beneficios.",
  alma: "Parte de las 2 a 5 h diarias de tiempo propio que dan más bienestar.",
  mente: "Unos 30 min por día de aprender algo nuevo.",
  vinculos: "Ver a los tuyos unas 2 veces por semana.",
};

export const idealOf = (custom: Partial<Record<string, number>> | undefined): Record<IdealPart, number> => ({ ...DEFAULT_IDEAL, ...(custom ?? {}) } as Record<IdealPart, number>);

/** El avance de cada cosa hacia su meta (las metas son por semana; `weeks` escala a un mes). */
export function idealProgress(minutes: Record<Part, number>, ideal: Record<IdealPart, number>, weeks = 1) {
  const rows = IDEAL_PARTS.map((p) => {
    const goal = ideal[p] * 60 * weeks;
    return { p, minutes: minutes[p], goal, pct: goal ? Math.round((minutes[p] / goal) * 100) : 0 };
  });
  const goal = rows.reduce((a, r) => a + r.goal, 0);
  const got = rows.reduce((a, r) => a + Math.min(r.minutes, r.goal), 0);
  return { rows, goal, total: rows.reduce((a, r) => a + r.minutes, 0), pct: goal ? Math.round((got / goal) * 100) : 0 };
}
