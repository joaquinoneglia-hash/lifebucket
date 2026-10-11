import type { CSSProperties } from "react";

/**
 * Las seis partes del tiempo despierto: los cinco cuadrantes de la vida y Libre
 * (descanso, ocio sin plan, traslados, casa). El sueño queda afuera: es el marco del día.
 */
export const QUADRANTS = [
  { id: "cuerpo", name: "Cuerpo", hint: "Salud, deporte, comidas" },
  { id: "mente", name: "Mente", hint: "Estudio, lectura, aprender" },
  { id: "alma", name: "Disfrute", hint: "Hobbies, arte, música, lo que te gusta" },
  { id: "vinculos", name: "Vínculos", hint: "Pareja, amigos, familia" },
  { id: "trabajo", name: "Trabajo", hint: "Lo laboral" },
  { id: "libre", name: "Libre", hint: "Descanso, ocio, traslados, casa" },
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
export const CHART_ORDER = ["mente", "vinculos", "libre", "alma", "cuerpo", "trabajo"] as const;

export const QUADRANT_BY_ID = Object.fromEntries(
  QUADRANTS.map((q) => [q.id, q]),
) as QuadrantRecord<Quadrant>;

export function quadrantRecord<T>(value: T): QuadrantRecord<T> {
  return { cuerpo: value, mente: value, alma: value, vinculos: value, trabajo: value, libre: value };
}

// Objetivo inicial; el usuario lo ajusta en el onboarding o en Balance.
export const DEFAULT_TARGETS: QuadrantRecord<number> = {
  cuerpo: 15,
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
