export const STEP = 30;

/**
 * Rango visible de la grilla, en minutos desde la medianoche del día. Sale del horario
 * de sueño (de la hora de levantarse más temprana a la de acostarse más tarde) y puede
 * pasar de las 24:00 si te acostás después de medianoche: el día termina cuando dormís.
 */
let range = { start: 6 * 60, end: 24 * 60 };

export const dayStart = () => range.start;
export const dayEnd = () => range.end;
export function setDayRange(start: number, end: number) {
  range = { start, end };
}

/** "23:30", y después de medianoche "00:30" (el mismo día de vida). */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeRange(start: number, minutes: number): string {
  return `${formatTime(start)} – ${formatTime(start + minutes)}`;
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Acomoda un inicio para que el bloque entre en la ventana (por defecto, el rango de la grilla). */
export function clampStart(start: number, minutes: number, from = range.start, to = range.end): number {
  return Math.min(Math.max(start, from), Math.max(from, to - minutes));
}

export function snap(minutes: number): number {
  return Math.round(minutes / STEP) * STEP;
}

/** Próxima media hora desde ahora, dentro de la grilla. */
export function nextHalfHour(minutes = 60, d = new Date()): number {
  return clampStart(Math.ceil(nowMinutes(d) / STEP) * STEP, minutes);
}

/** Horarios de inicio posibles para un bloque de esa duración dentro de la ventana. */
export function timeOptions(minutes: number, from = range.start, to = range.end): number[] {
  const out: number[] = [];
  for (let s = from; s <= to - minutes; s += STEP) out.push(s);
  return out;
}
