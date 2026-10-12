import type { CSSProperties } from "react";

/**
 * Las partes de tu tiempo. Lo que se trabaja y se juega: Deporte, Mente y Alma, Hobbies y disfrute,
 * Habilidades y Vínculos. La base: Trabajo y Libre (más el Sueño, que va aparte).
 * (Los ids son los de siempre para no perder datos: `cuerpo` es Deporte, `mente` es Habilidades,
 * `alma` es Hobbies y disfrute; `interior` es Mente y Alma.)
 */
export const QUADRANTS = [
  { id: "cuerpo", name: "Deporte", hint: "Entrenamiento, correr, bici" },
  { id: "interior", name: "Mente y Alma", hint: "Meditar, terapia, lo que te ordena por dentro" },
  { id: "alma", name: "Hobbies y disfrute", hint: "Lo que hacés por gusto, sin fin económico: ajedrez, música" },
  { id: "mente", name: "Habilidades", hint: "Aprender algo nuevo: un idioma, una habilidad intelectual" },
  { id: "vinculos", name: "Vínculos", hint: "Pareja, amigos, familia" },
  { id: "trabajo", name: "Trabajo", hint: "Lo laboral" },
  { id: "libre", name: "Libre", hint: "Descanso, comidas, traslados, casa" },
] as const;

export type Quadrant = (typeof QUADRANTS)[number];
export type QuadrantId = Quadrant["id"];
export type QuadrantRecord<T> = Record<QuadrantId, T>;

/**
 * Lo que no se marca: Libre se vive y Trabajo se respeta en su horario. Cuando su tiempo pasa,
 * cuenta como vivido; no tiene check, no entra en el % de cumplimiento ni en el check-in.
 * Lo que hay que marcar y buscar que se cumpla son Cuerpo, Mente, Alma y Vínculos.
 */
export const isRoutine = (id: string) => id === "libre" || id === "trabajo";

/** Libre no es un "cuadrante de vida" con compromisos: no tiene check-in ni misiones. */
export const LIFE_QUADRANTS = QUADRANTS.filter((q) => q.id !== "libre");

/**
 * Orden para gráficos (anillo y barras apiladas). Validado con el script de dataviz:
 * ningún par vecino se confunde con daltonismo (Mente y Alma no van juntos; Libre entre Vínculos y Alma).
 */
export const CHART_ORDER = ["mente", "vinculos", "libre", "alma", "interior", "cuerpo", "trabajo"] as const;

export const QUADRANT_BY_ID = Object.fromEntries(
  QUADRANTS.map((q) => [q.id, q]),
) as QuadrantRecord<Quadrant>;

export function quadrantRecord<T>(value: T): QuadrantRecord<T> {
  return { cuerpo: value, interior: value, mente: value, alma: value, vinculos: value, trabajo: value, libre: value };
}

// Objetivo inicial; el usuario lo ajusta en el onboarding o en Balance.
export const DEFAULT_TARGETS: QuadrantRecord<number> = {
  cuerpo: 15,
  interior: 0,
  mente: 10,
  alma: 10,
  vinculos: 15,
  trabajo: 35,
  libre: 15,
};

/** Expone el color del cuadrante como --q (pleno) y --q-soft (fondo). */
export function quadrantStyle(id: QuadrantId): CSSProperties {
  return {
    "--q": `var(--color-${id})`,
    "--q-soft": `var(--color-${id}-soft)`,
  } as CSSProperties;
}

/** Qué entra en cada categoría, en una línea (para que se entienda al elegir). */
export const QUADRANT_HINT: Record<QuadrantId, string> = {
  cuerpo: "Moverte: entrenar, correr, nadar, yoga, caminar.",
  interior: "Cuidar tu cabeza y tu alma: meditar, terapia, respirar, rezar.",
  alma: "Lo que hacés por gusto, sin fin económico: música, ajedrez, cocinar, dibujar.",
  mente: "Estudiar o aprender algo nuevo: un idioma, un curso, leer, programar.",
  vinculos: "Tiempo con los tuyos: pareja, familia, amigos.",
  trabajo: "Tu empleo, tu emprendimiento o tus proyectos pagos.",
  libre: "Comidas, descanso, traslados y lo de la casa.",
};
