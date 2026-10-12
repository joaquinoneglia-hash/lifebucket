import type { CSSProperties } from "react";
import { quadrantStyle, type QuadrantId } from "./quadrants";

/**
 * Modo simple: la app es solo el calendario de la semana (sin arranque, balance, ritual, misiones,
 * resúmenes ni asistente). Todo eso sigue en el código; para volver a verlo, poné esto en false.
 */
export const SIMPLE_MODE = true;

/**
 * Libre en gris suave: es el tiempo sin agendar más lo que marques como libre (almuerzo, descanso).
 * `--q` es el gris de los puntos y barras, `--q-soft` el fondo de los bloques.
 */
export function partStyle(id: QuadrantId | "sueno"): CSSProperties {
  if (id === "sueno") return { "--q": "var(--color-sleep)", "--q-soft": "var(--color-sleep-soft)" } as CSSProperties;
  if (id !== "libre") return quadrantStyle(id);
  return { "--q": "#aab1be", "--q-soft": "#eceff3" } as CSSProperties;
}

/** En modo simple solo hay estas categorías. */
/** Lo que se puede poner en la semana tipo: lo que se trabaja y se juega, y la base (Trabajo, Libre). */
export const SIMPLE_QUADRANTS: QuadrantId[] = ["cuerpo", "interior", "alma", "mente", "vinculos", "trabajo", "libre"];

/** Actividades de arranque en modo simple (se crean si no hay ninguna). */
export const SIMPLE_ACTIVITIES: { quadrant: QuadrantId; name: string }[] = [
  { quadrant: "trabajo", name: "Trabajo" },
  { quadrant: "cuerpo", name: "Gimnasio" },
  { quadrant: "cuerpo", name: "Correr" },
  { quadrant: "mente", name: "Leer" },
  { quadrant: "mente", name: "Estudiar" },
  { quadrant: "mente", name: "Meditar" },
  { quadrant: "alma", name: "Música" },
  { quadrant: "alma", name: "Series" },
];
