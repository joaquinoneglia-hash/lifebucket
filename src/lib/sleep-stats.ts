import { awakeWeek } from "./routine";
import type { SleepSettings } from "./sleep";

/** Meta de sueño por noche (lo recomendado para adultos es entre 7 y 9 h). */
export const SLEEP_GOAL_HOURS = 8;
export const SLEEP_RANGE: [number, number] = [7, 9];

/** Cuánto dormís con tu horario: total de la semana y promedio por noche (en horas). */
export function sleepStats(sleep: SleepSettings) {
  const weekMinutes = 168 * 60 - awakeWeek(sleep);
  const perNight = weekMinutes / 7 / 60;
  const status: "ok" | "poco" | "mucho" = perNight < SLEEP_RANGE[0] ? "poco" : perNight > SLEEP_RANGE[1] ? "mucho" : "ok";
  return { weekHours: weekMinutes / 60, perNight, status };
}

export const hoursLabel = (h: number) => `${(Math.round(h * 10) / 10).toLocaleString("es-AR")} h`;
