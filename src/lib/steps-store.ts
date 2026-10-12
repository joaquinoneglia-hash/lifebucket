import { create } from "zustand";
import { persist } from "zustand/middleware";
import { carve } from "./routine";
import { DEFAULT_SLEEP, type SleepSettings } from "./sleep";
import { newId, type RoutineBlock } from "./store";

/** Los pasos, en orden. Cada categoría tiene su pantalla. */
export const STEPS = ["intro", "sleep", "trabajo", "cuerpo", "mente", "alma", "libre", "gaps", "result", "improve", "done"] as const;
export type StepId = (typeof STEPS)[number];
export type Cat = "trabajo" | "cuerpo" | "mente" | "alma" | "libre";

type StepsState = {
  step: StepId;
  sleep: SleepSettings;
  /** La semana que se va armando (copia aparte: no toca la de la app). */
  routine: RoutineBlock[];
  /** Huecos que la persona decidió dejar libres (clave: inicio-fin-días). */
  leftFree: string[];
  /** ¿Le gusta su semana? null hasta que responde. */
  happy: boolean | null;
  /** Cuántas horas más por semana quiere en cada categoría. */
  goals: Partial<Record<Cat, number>>;
  /** La semana como estaba antes de corregirla (para comparar antes y después). */
  before: RoutineBlock[] | null;
  go: (step: StepId) => void;
  setSleep: (sleep: SleepSettings) => void;
  addBlock: (b: Omit<RoutineBlock, "id">) => void;
  removeBlock: (id: string) => void;
  markFree: (key: string) => void;
  setHappy: (v: boolean) => void;
  setGoal: (cat: Cat, hours: number) => void;
  /** Usar la semana corregida (guarda la de antes para comparar). */
  applyProposal: (routine: RoutineBlock[]) => void;
  reset: () => void;
};

const INITIAL = {
  step: "intro" as StepId,
  sleep: DEFAULT_SLEEP,
  routine: [] as RoutineBlock[],
  leftFree: [] as string[],
  happy: null,
  goals: {},
  before: null,
};

export const useSteps = create<StepsState>()(
  persist(
    (set) => ({
      ...INITIAL,
      go: (step) => set({ step }),
      setSleep: (sleep) => set({ sleep }),
      addBlock: (b) => set((s) => ({ routine: carve(s.routine, { ...b, id: newId() }) })),
      removeBlock: (id) => set((s) => ({ routine: s.routine.filter((b) => b.id !== id) })),
      markFree: (key) => set((s) => ({ leftFree: [...new Set([...s.leftFree, key])] })),
      setHappy: (happy) => set({ happy }),
      setGoal: (cat, hours) => set((s) => ({ goals: { ...s.goals, [cat]: hours } })),
      // Las metas vuelven a cero: ya están en la semana (si no, se sumarían de nuevo).
      applyProposal: (routine) => set((s) => ({ before: s.before ?? s.routine, routine, goals: {} })),
      reset: () => set({ ...INITIAL }),
    }),
    { name: "lifebucket:pasos:v1", version: 1 },
  ),
);
