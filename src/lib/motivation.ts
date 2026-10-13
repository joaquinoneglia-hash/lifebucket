import { play, type Sfx } from "./sfx";

/**
 * El acompañante: frases cortas y cálidas (con su sonido) para cada cosa que hacés en LifeBucket. Sin
 * exigir ni retar: celebrar lo que hiciste y animar lo que falta.
 */
export type CheerKind =
  | "check"
  | "allChecks"
  | "uncheck"
  | "diary"
  | "diaryNote"
  | "goalDone"
  | "goalAdded"
  | "goalPostponed"
  | "routine"
  | "setupStep"
  | "welcome";

const PHRASES: Record<CheerKind, string[]> = {
  check: ["¡Uno más! Así se construye un hábito.", "Bien ahí. Paso a paso.", "Tildado. Tu yo de mañana te lo agradece.", "Eso. Lo pequeño, todos los días.", "Sumaste. Seguí así."],
  allChecks: ["¡Día completo! Todos tus no negociables.", "¡Pleno! Hoy cumpliste todo lo que te propusiste.", "Día perfecto. Disfrutalo."],
  uncheck: ["Sin drama: mañana es otra oportunidad."],
  diary: ["Anotado en tu historia. Eso también es vivir.", "Se suma a tu balde. ¡Bien ahí!", "Tu mes se va llenando de cosas lindas.", "Eso cuenta. Y mucho."],
  diaryNote: ["Guardado en tu diario. Lo vas a disfrutar releerlo.", "Anotado. Los pequeños momentos también cuentan."],
  goalDone: ["¡Meta cumplida! Esto sí te cambia.", "¡Lo hiciste! Celebralo como se merece.", "Una meta menos, una versión tuya más."],
  goalAdded: ["Meta en marcha. Empezá por un primer paso chiquito.", "Anotada. Lo importante es que la tengas a la vista."],
  goalPostponed: ["Está bien moverla. Lo importante es no soltarla.", "Postergar no es fallar: elegí un primer paso más chico."],
  routine: ["Tu rutina toma forma.", "Un bloque más en tu semana."],
  setupStep: ["¡Listo! Un paso menos.", "Muy bien. Seguimos.", "Perfecto. Ya casi."],
  welcome: ["Bienvenido a tu dashboard de vida."],
};

const SOUNDS: Record<CheerKind, Sfx | null> = {
  check: "pop",
  allChecks: "fanfare",
  uncheck: null,
  diary: "paper",
  diaryNote: "paper",
  goalDone: "complete",
  goalAdded: "pop",
  goalPostponed: "open",
  routine: null,
  setupStep: "complete",
  welcome: "complete",
};

export const CHEER_EVENT = "lb:cheer";
const last: Partial<Record<CheerKind, number>> = {};

/** Una frase al azar (sin repetir la última de ese tipo). */
export function phrase(kind: CheerKind) {
  const list = PHRASES[kind];
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[kind]) i = (i + 1) % list.length;
  last[kind] = i;
  return list[i];
}

/** Celebra: suena y muestra la frase un momento abajo de la pantalla. */
export function cheer(kind: CheerKind, text?: string) {
  const sound = SOUNDS[kind];
  if (sound) play(sound);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHEER_EVENT, { detail: { kind, text: text ?? phrase(kind) } }));
}

/** Frases para el saludo de cada momento del día. */
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Buen día";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}
