import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, fromKey, toKey, type DateKey } from "./dates";
import { DEFAULT_TARGETS, type QuadrantId, type QuadrantRecord } from "./quadrants";
import { DEFAULT_SLEEP, type NightResult, type SleepSettings, type SleepWindow } from "./sleep";
import { SLOT_DEFAULT_START, type SlotId } from "./slots";
import { clampStart, STEP } from "./time";

export type BlockStatus = "pending" | "done" | "skipped";
/** Días de la semana en que se repite (0 = domingo … 6 = sábado, como Date.getDay). */
export type RepeatDays = number[];

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** "todos los días", "de lunes a viernes", "los lun, mié y vie" */
export function describeRepeat(days: RepeatDays): string {
  const set = new Set(days);
  if (set.size === 7) return "todos los días";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "de lunes a viernes";
  if (set.size === 2 && set.has(0) && set.has(6)) return "los fines de semana";
  const names = MON_FIRST.filter((d) => set.has(d)).map((d) => WEEKDAY_SHORT[d]);
  return names.length === 1 ? `los ${names[0]}` : `los ${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}
/** Alcance de un cambio sobre un evento que se repite, como en Google Calendar. */
export type Scope = "this" | "following" | "all";

export interface Activity {
  id: string;
  quadrant: QuadrantId;
  name: string;
}

export interface Series {
  id: string;
  title: string;
  quadrant: QuadrantId;
  activityId?: string;
  minutes: number;
  /** Minutos desde la medianoche. */
  start: number;
  days: RepeatDays;
  startDate: DateKey;
  until?: DateKey;
  /** Días borrados con "solo este evento". */
  exceptions: DateKey[];
  order: number;
}

export interface Block {
  id: string;
  title: string;
  quadrant: QuadrantId;
  activityId?: string;
  minutes: number;
  date: DateKey;
  /** Minutos desde la medianoche. */
  start: number;
  status: BlockStatus;
  order: number;
  seriesId?: string;
  /** Día que le tocaba en la serie, aunque después se haya movido. */
  originDate?: DateKey;
}

export type BlockDraft = Pick<Block, "title" | "quadrant" | "activityId" | "minutes" | "date" | "start">;
type SharedFields = Omit<Partial<BlockDraft>, "date">;

// randomUUID solo existe en contextos seguros (no al abrir por IP local desde el celu).
export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Redondea porcentajes a múltiplos de 5 que suman 100 (mayor resto). */
function roundTargets(raw: QuadrantRecord<number>): QuadrantRecord<number> {
  const ids = Object.keys(raw) as QuadrantId[];
  const total = ids.reduce((acc, id) => acc + raw[id], 0) || 1;
  const exact = ids.map((id) => ({ id, u: (raw[id] / total) * 20 }));
  const out = Object.fromEntries(exact.map((e) => [e.id, Math.floor(e.u)])) as QuadrantRecord<number>;
  let left = 20 - ids.reduce((acc, id) => acc + out[id], 0);
  for (const e of [...exact].sort((a, b) => (b.u % 1) - (a.u % 1))) if (left-- > 0) out[e.id]++;
  for (const id of ids) out[id] *= 5;
  return out;
}

const prevDay = (key: DateKey) => toKey(addDays(fromKey(key), -1));

export function occursOn(series: Series, day: DateKey): boolean {
  if (day < series.startDate) return false;
  if (series.until && day > series.until) return false;
  if (series.exceptions.includes(day)) return false;
  return series.days.includes(fromKey(day).getDay());
}

function pickShared(patch: Partial<BlockDraft>): SharedFields {
  const shared: SharedFields = { ...patch };
  delete (shared as Partial<BlockDraft>).date;
  return shared;
}

/** Mover un bloque que no se hizo lo recupera: vuelve a quedar pendiente. */
function moved(b: Block, date: DateKey, start: number): Block {
  return {
    ...b,
    date,
    start,
    order: Date.now(),
    status: b.status === "skipped" ? "pending" : b.status,
  };
}

/** Un trabajo con horario fijo (hoy mucha gente tiene dos: empleo y emprendimiento). */
export interface Job {
  /** Cómo se llama: "Brandtag", "Mi estudio"… */
  name: string;
  /** Qué tipo de trabajo es. */
  kind?: "trabajo" | "emprendimiento" | "proyecto";
  days: RepeatDays;
  start: number;
  end: number;
}

/**
 * Una actividad de tu semana ideal, en concreto: "Gimnasio, 3 veces por semana, 1 h".
 * De acá sale el objetivo en % (Libre es lo que sobra).
 */
export interface IdealItem {
  quadrant: QuadrantId;
  name: string;
  /** Veces por semana (0.25 = una vez por mes, 0.5 = dos por mes). */
  perWeek: number;
  minutes: number;
}

/** Un bloque de tu semana tipo: qué, qué días y a qué hora. Sin fechas: se repite. */
export interface RoutineBlock {
  id: string;
  quadrant: QuadrantId;
  name: string;
  /** Días de la semana (Date.getDay()). */
  days: number[];
  start: number;
  minutes: number;
  /** «No hago nada»: un rato libre (cuenta aparte en el balde). */
  nada?: boolean;
}

/** Un momento con otros ("cena con amigos"): por mes, sin hora. */
export type MomentKind = "amor" | "familia" | "amigos" | "disfrute";
export interface Moment {
  id: string;
  kind: MomentKind;
  text: string;
  /** Cuánto duró, aproximado (si no se dijo, se usa el valor típico del tipo). */
  hours?: number;
  /** "2026-10" */
  month: string;
}

/**
 * Una entrada del diario ("salí a comer con amigos", "hoy me animé a hablar en la reunión"): lo que
 * destacás del día. Si trae una actividad con duración, tiene categoría y minutos y suma al balde; si no,
 * es solo una nota (category null, minutes 0).
 */
export type LogroCat = "cuerpo" | "interior" | "alma" | "mente" | "vinculos" | "trabajo";
export interface Logro {
  id: string;
  date: DateKey;
  text: string;
  category: LogroCat | null;
  minutes: number;
  /** A qué hora fue (si se dijo): se muestra en el calendario de esa semana. */
  start?: number;
}

/** De qué parte de tu vida es una meta. */
export type TaskKind = "trabajo" | "cuerpo" | "interior" | "mente" | "alma" | "vinculos" | "otro";

/** Un objetivo del año ("hacer un viaje"): por mes, con fecha opcional y sin horario. */
/** Listas personales: súper, notas, pendientes y dónde guardé las cosas. ("checklist" quedó de antes: pasa a Pendientes.) */
export type ListType = "super" | "notas" | "pendientes" | "checklist" | "lugares";
/** Cada cuánto se repite un pendiente: al completarlo, vuelve con la fecha siguiente. */
export type Repeat = "diaria" | "semanal" | "mensual" | "anual";
/** Tipo de recordatorio (cada uno con su color e ícono). Los feriados no se guardan: se calculan. */
export type ReminderKind = "tarea" | "cumple" | "aniversario" | "pago" | "salud" | "mascota" | "tramite";
export interface ListItem {
  id: string;
  text: string;
  done?: boolean;
  /** Súper: la sección; pendientes: la prioridad; lugares: dónde está. */
  meta?: string;
  /** Pendientes: para cuándo vence. */
  due?: DateKey;
  /** Pendientes: su grupo ("Personal", "Trabajo", "Con mi novia"…). */
  group?: string;
  /** Pendientes: se repite. */
  repeat?: Repeat;
  /** Recordatorios: de qué tipo es (sin tipo: tarea). Puede ser uno propio (id de `customKinds`). */
  kind?: ReminderKind | string;
  /** Recordatorios: a qué hora (minutos desde la medianoche), si importa. */
  at?: number;
  /** Recordatorios: cuánto antes avisar, en minutos (60 = una hora antes, 1440 = un día antes). */
  remind?: number;
  /** Cumpleaños y aniversarios: el año en que empezó (para decir cuántos cumple). */
  since?: number;
  /** Cuándo se completó. */
  doneAt?: DateKey;
}
/** Cómo se ordena la lista de pendientes. */
export type PendingSort = "prioridad" | "fecha" | "manual";
/** Un día en "¿Cómo te sentiste hoy?": las emociones (1 a 3) y unas líneas. No suma horas al balde. */
export interface MoodEntry {
  date: DateKey;
  feelings: string[];
  text: string;
}
export interface UserList {
  id: string;
  type: ListType;
  title: string;
  items: ListItem[];
  /** Pendientes: los grupos que armaste, cómo se ordena y si se ocultan los completados. */
  groups?: string[];
  sort?: PendingSort;
  hideDone?: boolean;
  /** Recordatorios: los tipos que no se muestran (incluye "feriado"). */
  hiddenKinds?: string[];
  /** Recordatorios: feriados y fechas que no querés ver ("Día del Niño" para siempre, "Día del Niño@2026-08-16" solo ese). */
  hiddenHolidays?: string[];
  /** Recordatorios: nombres propios para feriados y fechas especiales (por su nombre de siempre). */
  holidayNames?: Record<string, string>;
  /** Recordatorios: tipos propios, con su nombre, ícono y color. */
  customKinds?: { id: string; name: string; emoji: string; color: string }[];
  /** Oculta: no se ve en el tablero (se vuelve a mostrar desde «ocultas»). */
  hidden?: boolean;
}

/** Un objetivo de todos los días ("meditar", "no tomar alcohol"): se tilda cada día que se cumple. */
export interface DailyGoal {
  id: string;
  name: string;
}

export interface YearTask {
  kind?: TaskKind;
  id: string;
  title: string;
  /** Mes al que pertenece: "2026-12". */
  month: string;
  date?: DateKey;
  done: boolean;
  /** Cuándo se creó (para saber cuánto lleva abierta). */
  createdAt?: DateKey;
  /** Cuándo se cumplió. */
  doneAt?: DateKey;
  /** Los meses por los que pasó antes de postergarse (cada vez que se pasa a un mes posterior). */
  history?: string[];
}

/** Pasar una meta a otro mes: si es a uno posterior, cuenta como postergada (queda el mes de antes). */
function withMonth(t: YearTask, month: string): YearTask {
  if (t.month === month) return t;
  // Para atrás: se deshace la postergación (se borran los meses desde ese en adelante).
  if (month < t.month) return { ...t, month, history: (t.history ?? []).filter((h) => h < month) };
  return { ...t, month, history: !t.done ? [...(t.history ?? []), t.month] : t.history };
}

export interface TargetsChange {
  from: DateKey;
  targets: QuadrantRecord<number>;
}

/** El objetivo que regía en una fecha (el último cambio hecho antes o ese mismo día). */
export function targetsAt(
  history: TargetsChange[],
  current: QuadrantRecord<number>,
  date: DateKey,
): QuadrantRecord<number> {
  let found: QuadrantRecord<number> | undefined;
  for (const h of history) if (h.from <= date) found = h.targets;
  return found ?? current;
}

/**
 * Una misión de la semana, nacida del ritual: "Juntate 2 veces con amigos".
 * Se agenda en el momento (con bloques) o queda pendiente para agendarla después.
 */
export interface Mission {
  id: string;
  /** Lunes de la semana a la que pertenece. */
  week: DateKey;
  quadrant: QuadrantId;
  activityId?: string;
  title: string;
  why: string;
  count: number;
  minutes: number;
  status: "scheduled" | "later" | "dismissed";
  blockIds: string[];
}

export interface PlannerState {
  onboarded: boolean;
  userName: string;
  activities: Activity[];
  series: Series[];
  blocks: Block[];
  targets: QuadrantRecord<number>;
  lastQuadrant: QuadrantId;
  lastMinutes: number;
  /** Resúmenes de semana/mes ya vistos ("week:2026-10-05", "month:2026-09-01"). */
  seenRecaps: string[];
  /** Último día en que la app abrió sola el check-in. */
  lastCheckInPrompt: DateKey | "";
  /** Objetivos anteriores: cada cambio guarda desde cuándo rige, así los reportes viejos no cambian. */
  targetsHistory: TargetsChange[];
  /** Cuándo se abre solo el ritual de reprogramar (día 0–6, hora 0–23). */
  ritual: { day: number; hour: number; enabled: boolean };
  /** Semanas (lunes) ya reprogramadas u omitidas. */
  ritualLog: Record<DateKey, "done" | "skipped">;
  missions: Mission[];
  /** Horario de sueño (fijo, fuera del balance). */
  sleep: SleepSettings;
  /** Cómo resultó cada noche, marcado en el ritual. Clave: el día en que te acostaste. */
  sleepLog: Record<DateKey, NightResult>;
  /** Horarios de trabajo del onboarding (sirven para el objetivo y la IA). */
  work: Job[];
  /** Después del onboarding se abre "Armá tu semana base". */
  weekSetupPending: boolean;
  /** Tu semana ideal en actividades concretas (de donde sale el objetivo). */
  ideal: IdealItem[];
  /** Cómo era tu semana cuando arrancaste (el "fantasma" contra el que comparás). */
  baseline: RoutineBlock[];
  /** Tu semana tipo (ideal) y las series que se crearon desde ella. */
  routine: RoutineBlock[];
  routineSeries: string[];
  /** Objetivos del año, por mes. */
  tasks: YearTask[];
  /** Momentos con otros (vínculos), por mes. */
  moments: Moment[];
  /** El diario de logros: lo que hiciste cada día (suma a la semana y al mes). */
  logros: Logro[];
  lists: UserList[];
  addList: (type: ListType, title: string) => string;
  removeList: (id: string) => void;
  renameList: (id: string, title: string) => void;
  setListItems: (id: string, items: ListItem[]) => void;
  setListHidden: (id: string, hidden: boolean) => void;
  updateList: (id: string, patch: Partial<Omit<UserList, "id" | "type">>) => void;
  /** "¿Cómo te sentiste hoy?": un registro por día. */
  moods: MoodEntry[];
  setMood: (entry: MoodEntry) => void;
  /** Tu balde ideal: horas por semana para cada cosa que es para vos (si no se ajustó, los valores recomendados). */
  idealHours: Partial<Record<string, number>>;
  setIdealHours: (h: Partial<Record<string, number>>) => void;
  /** Cómo quedó la rutina de cada semana (la clave es el lunes): para volver a verla o replicarla. */
  weekRoutines: Record<string, RoutineBlock[]>;
  saveWeekRoutine: (monday: DateKey, routine: RoutineBlock[]) => void;
  /** Ya configuraste tu horario de sueño (hasta entonces el calendario no lo muestra). */
  sleepSet: boolean;
  setSleepSet: (v: boolean) => void;
  /** El arranque guiado (rutina, no negociables, metas, diario y recordatorios) ya se hizo. */
  setupDone: boolean;
  setSetupDone: (done: boolean) => void;
  /** Cuándo te pregunta la app por tu día: al abrir, o a partir de una hora (mañana, mediodía o noche). */
  reminder: { when: "abrir" | "manana" | "mediodia" | "noche"; hour: number } | null;
  setReminder: (r: PlannerState["reminder"]) => void;
  /** El último día en que la app te preguntó por tu día. */
  lastReminder: DateKey | "";
  setLastReminder: (d: DateKey) => void;
  /** Los no negociables de cada mes (ids): si un mes no tiene lista propia, vale la del último mes que tenga. */
  goalMonths: Record<string, string[]>;
  setGoalMonth: (month: string, ids: string[]) => void;
  /** El primer día que usaste la app: las métricas del mes arrancan acá. */
  startedAt: DateKey | "";
  setStartedAt: (date: DateKey) => void;
  /** País donde vivís (código ISO): define los feriados y fechas patrias. */
  country: string;
  setCountry: (country: string) => void;
  /** Objetivos diarios (la base son 5; se pueden sumar más). */
  dailyGoals: DailyGoal[];
  /** Qué objetivos diarios se cumplieron cada día: fecha → ids. */
  dailyChecks: Record<DateKey, string[]>;
  /** Semana a semana: el % de cada parte (la clave es el lunes de cada semana). */
  routineHistory: { date: DateKey; shares: Partial<Record<string, number>> }[];
  /** El lunes de la última semana que confirmaste (para preguntar al empezar una nueva). */
  weekSeen: DateKey;

  completeOnboarding: (name: string, activities: Omit<Activity, "id">[]) => void;
  addActivity: (quadrant: QuadrantId, name: string) => Activity;
  removeActivity: (id: string) => void;
  setTargets: (targets: QuadrantRecord<number>) => void;
  markRecapSeen: (key: string) => void;
  markCheckInPrompted: (date: DateKey) => void;
  setRitual: (patch: Partial<PlannerState["ritual"]>) => void;
  logRitual: (week: DateKey, status: "done" | "skipped") => void;
  addMission: (mission: Omit<Mission, "id">) => Mission;
  updateMission: (id: string, patch: Partial<Omit<Mission, "id">>) => void;
  setSleep: (sleep: SleepSettings) => void;
  setWork: (work: Job[]) => void;
  setWeekSetupPending: (pending: boolean) => void;
  setIdeal: (ideal: IdealItem[]) => void;
  setBaseline: (baseline: RoutineBlock[]) => void;
  setRoutine: (routine: RoutineBlock[], seriesIds: string[]) => void;
  addTask: (task: Omit<YearTask, "id" | "done">) => void;
  /** Guarda (o actualiza) los % de una semana. */
  logRoutine: (shares: Partial<Record<string, number>>, week: DateKey) => void;
  setWeekSeen: (week: DateKey) => void;
  toggleTask: (id: string) => void;
  addLogro: (l: Omit<Logro, "id">) => void;
  removeLogro: (id: string) => void;
  updateLogro: (id: string, patch: Partial<Omit<Logro, "id">>) => void;
  addDailyGoal: (name: string) => void;
  renameDailyGoal: (id: string, name: string) => void;
  removeDailyGoal: (id: string) => void;
  toggleDailyCheck: (date: DateKey, goalId: string) => void;
  addMoment: (m: Omit<Moment, "id">) => void;
  removeMoment: (id: string) => void;
  updateMoment: (id: string, patch: Partial<Omit<Moment, "id">>) => void;
  removeTask: (id: string) => void;
  /** Cambiar texto, tipo, fecha o mes de un objetivo. */
  updateTask: (id: string, patch: Partial<Omit<YearTask, "id">>) => void;
  /** Pasa un objetivo a otro mes (si tenía fecha, conserva el día si existe en ese mes). */
  moveTask: (id: string, month: string) => void;
  /** Borra algo que se repite: la serie y sus bloques que todavía no pasaron. */
  removeSeries: (id: string) => void;
  /** Horario de sueño de un día puntual (null vuelve al horario habitual). */
  setDaySleep: (date: DateKey, window: SleepWindow | null) => void;
  /** Vuelve a poner un bloque recién borrado (el "Deshacer"). */
  restoreBlock: (block: Block) => void;
  logNight: (date: DateKey, result: NightResult | null) => void;

  /** Con `repeat` (días de la semana) crea una serie; sin él, un bloque suelto. Devuelve el id del bloque creado. */
  addBlock: (draft: BlockDraft, repeat?: RepeatDays | null) => string | undefined;
  /** Crea las ocurrencias de las series que caen en estos días y todavía no existen. */
  materialize: (days: DateKey[]) => void;
  updateBlock: (id: string, patch: Partial<BlockDraft>, scope: Scope) => void;
  moveBlock: (id: string, date: DateKey, start: number) => void;
  setStatus: (id: string, status: BlockStatus) => void;
  removeBlock: (id: string, scope: Scope) => void;
}

import { testKey } from "./test-mode";

/** Dónde se guardan los datos en el navegador. Antes se llamaba "lifeplan:v1". */
const STORAGE_KEY = "lifebucket:v1";
/** Versión del formato de los datos (la usa también la nube). */
export const STORE_VERSION = 13;
const LEGACY_STORAGE_KEY = "lifeplan:v1";

// Migración del nombre: si hay datos con la clave vieja y todavía no con la nueva, se copian
// (la vieja queda como respaldo). Corre antes de que el store los lea.
if (typeof window !== "undefined") {
  try {
    const old = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (old && !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, old);
  } catch {
    // Sin acceso a localStorage (modo privado, etc.): se arranca de cero.
  }
}

// Por ahora los datos viven en el navegador. Cuando conectemos Supabase,
// estas acciones pasan a escribir en la base y el resto de la app no cambia.
export const usePlanner = create<PlannerState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      userName: "",
      activities: [],
      series: [],
      blocks: [],
      targets: DEFAULT_TARGETS,
      lastQuadrant: "cuerpo",
      lastMinutes: 60,
      seenRecaps: [],
      lastCheckInPrompt: "",
      targetsHistory: [],
      ritual: { day: 0, hour: 19, enabled: true },
      ritualLog: {},
      missions: [],
      sleep: DEFAULT_SLEEP,
      sleepLog: {},
      work: [],
      weekSetupPending: false,
      ideal: [],
      baseline: [],
      routine: [],
      routineSeries: [],
      tasks: [],
      moments: [],
      logros: [],
      // Pendientes aparece de entrada en el tablero.
      lists: [{ id: "pendientes", type: "pendientes", title: "Recordatorios", items: [] }],
      moods: [],
      setMood: (entry) =>
        set((s) => ({
          moods: [...s.moods.filter((m) => m.date !== entry.date), ...(entry.feelings.length || entry.text.trim() ? [entry] : [])].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      updateList: (id, patch) => set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      addList: (type, title) => {
        // Una sola lista por tipo: si ya está, se vuelve a mostrar.
        const had = get().lists.find((l) => l.type === type);
        if (had) {
          set((s) => ({ lists: s.lists.map((l) => (l.id === had.id ? { ...l, hidden: false } : l)) }));
          return had.id;
        }
        const id = newId();
        set((s) => ({ lists: [...s.lists, { id, type, title, items: [] }] }));
        return id;
      },
      removeList: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
      renameList: (id, title) => set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, title } : l)) })),
      setListHidden: (id, hidden) => set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, hidden } : l)) })),
      setListItems: (id, items) => set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, items } : l)) })),
      idealHours: {},
      setIdealHours: (idealHours) => set({ idealHours }),
      weekRoutines: {},
      saveWeekRoutine: (monday, routine) =>
        set((s) => {
          // Se guardan las últimas 60 semanas.
          const keys = Object.keys(s.weekRoutines).filter((k) => k !== monday).sort().slice(-59);
          return { weekRoutines: { ...Object.fromEntries(keys.map((k) => [k, s.weekRoutines[k]])), [monday]: routine } };
        }),
      sleepSet: false,
      setSleepSet: (sleepSet) => set({ sleepSet }),
      setupDone: false,
      setSetupDone: (setupDone) => set({ setupDone }),
      reminder: null,
      setReminder: (reminder) => set({ reminder }),
      lastReminder: "",
      setLastReminder: (lastReminder) => set({ lastReminder }),
      goalMonths: {},
      setGoalMonth: (month, ids) => set((s) => ({ goalMonths: { ...s.goalMonths, [month]: ids } })),
      startedAt: "",
      setStartedAt: (startedAt) => set({ startedAt }),
      country: "AR",
      setCountry: (country) => set({ country }),
      dailyGoals: [],
      dailyChecks: {},
      routineHistory: [],
      weekSeen: "",

      completeOnboarding: (name, activities) =>
        set({
          onboarded: true,
          userName: name.trim(),
          activities: activities.map((a) => ({ ...a, id: newId() })),
        }),

      addActivity: (quadrant, name) => {
        const clean = name.trim();
        const existing = get().activities.find(
          (a) => a.quadrant === quadrant && a.name.toLowerCase() === clean.toLowerCase(),
        );
        if (existing) return existing;
        const activity = { id: newId(), quadrant, name: clean };
        set((s) => ({ activities: [...s.activities, activity] }));
        return activity;
      },

      removeActivity: (id) => set((s) => ({ activities: s.activities.filter((a) => a.id !== id) })),

      setTargets: (targets) =>
        set((s) => {
          // Guardamos el objetivo que regía hasta ahora, con su fecha de inicio.
          const today = toKey(new Date());
          const history = s.targetsHistory.filter((h) => h.from !== today);
          const prevFrom = s.targetsHistory.at(-1)?.from;
          return {
            targets,
            targetsHistory: [...history, ...(prevFrom ? [] : [{ from: "0000-01-01", targets: s.targets }]), { from: today, targets }],
          };
        }),

      setRitual: (patch) => set((s) => ({ ritual: { ...s.ritual, ...patch } })),
      logRitual: (week, status) => set((s) => ({ ritualLog: { ...s.ritualLog, [week]: status } })),

      addMission: (mission) => {
        const m = { ...mission, id: newId() };
        set((s) => ({ missions: [...s.missions, m] }));
        return m;
      },
      setSleep: (sleep) => set((s) => ({ sleep: { ...sleep, overrides: sleep.overrides ?? s.sleep.overrides }, sleepSet: true })),
      setWork: (work) => set({ work }),
      setWeekSetupPending: (weekSetupPending) => set({ weekSetupPending }),
      setIdeal: (ideal) => set({ ideal }),
      setBaseline: (baseline) => set({ baseline }),
      setRoutine: (routine, routineSeries) => set({ routine, routineSeries }),
      logRoutine: (shares, week) =>
        set((s) => {
          const rest = s.routineHistory.filter((h) => h.date !== week);
          return { routineHistory: [...rest, { date: week, shares }].sort((a, b) => a.date.localeCompare(b.date)).slice(-104) };
        }),
      setWeekSeen: (weekSeen) => set({ weekSeen }),
      addTask: (task) => set((s) => ({ tasks: [...s.tasks, { ...task, id: newId(), done: false, createdAt: toKey(new Date()) }] })),
      addLogro: (l) => set((s) => ({ logros: [...s.logros, { ...l, id: newId() }] })),
      removeLogro: (id) => set((s) => ({ logros: s.logros.filter((l) => l.id !== id) })),
      updateLogro: (id, patch) => set((s) => ({ logros: s.logros.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      addDailyGoal: (name) =>
        set((s) => {
          const id = newId();
          const month = toKey(new Date()).slice(0, 7);
          const current = activeGoalIds(s, month);
          return {
            dailyGoals: [...s.dailyGoals, { id, name: name.trim() }],
            goalMonths: current ? { ...s.goalMonths, [month]: [...current, id] } : s.goalMonths,
          };
        }),
      renameDailyGoal: (id, name) => set((s) => ({ dailyGoals: s.dailyGoals.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)) })),
      // Al sacar un objetivo se borran también sus tildes.
      // Sacar un no negociable lo saca de este mes en adelante: los meses anteriores conservan su lista.
      removeDailyGoal: (id) =>
        set((s) => {
          const month = toKey(new Date()).slice(0, 7);
          const ids = (activeGoalIds(s, month) ?? s.dailyGoals.map((g) => g.id)).filter((x) => x !== id);
          // Si ya se usó en meses anteriores, se conserva para esos meses (con su lista congelada).
          const firstCheck = Object.keys(s.dailyChecks).filter((d) => d.slice(0, 7) < month && s.dailyChecks[d].includes(id)).sort()[0];
          const usedBefore = Object.entries(s.goalMonths).some(([m, l]) => m < month && l.includes(id)) || !!firstCheck;
          if (usedBefore) {
            const frozen = activeGoalIds(s, month) ? {} : { [firstCheck!.slice(0, 7)]: s.dailyGoals.map((g) => g.id) };
            return { goalMonths: { ...frozen, ...s.goalMonths, [month]: ids } };
          }
          return {
          goalMonths: { ...s.goalMonths, ...(activeGoalIds(s, month) ? { [month]: ids } : {}) },
          dailyGoals: s.dailyGoals.filter((g) => g.id !== id),
          dailyChecks: Object.fromEntries(
            Object.entries(s.dailyChecks)
              .map(([d, ids]) => [d, ids.filter((x) => x !== id)] as const)
              .filter(([, ids]) => ids.length > 0),
          ),
          };
        }),
      toggleDailyCheck: (date, goalId) =>
        set((s) => {
          const list = s.dailyChecks[date] ?? [];
          const next = list.includes(goalId) ? list.filter((x) => x !== goalId) : [...list, goalId];
          const rest = { ...s.dailyChecks };
          delete rest[date];
          return { dailyChecks: next.length ? { ...rest, [date]: next } : rest };
        }),
      addMoment: (m) => set((s) => ({ moments: [...s.moments, { ...m, id: newId() }] })),
      removeMoment: (id) => set((s) => ({ moments: s.moments.filter((m) => m.id !== id) })),
      updateMoment: (id, patch) => set((s) => ({ moments: s.moments.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : toKey(new Date()) } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...(patch.month ? withMonth(t, patch.month) : t), ...patch, history: patch.month ? withMonth(t, patch.month).history : t.history } : t)) })),
      moveTask: (id, month) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id || t.month === month) return t;
            const [y, m] = month.split("-").map(Number);
            const day = t.date ? Math.min(Number(t.date.slice(8, 10)), new Date(y, m, 0).getDate()) : null;
            return { ...withMonth(t, month), date: day ? `${month}-${String(day).padStart(2, "0")}` : undefined };
          }),
        })),
      removeSeries: (id) =>
        set((s) => {
          const today = toKey(new Date());
          return {
            series: s.series.filter((x) => x.id !== id),
            // Lo que ya pasó queda (es historia); lo que viene se va.
            blocks: s.blocks.filter((b) => !(b.seriesId === id && b.date >= today && b.status === "pending")),
          };
        }),
      setDaySleep: (date, window) =>
        set((s) => {
          const overrides = { ...(s.sleep.overrides ?? {}) };
          if (window) overrides[date] = window;
          else delete overrides[date];
          return { sleep: { ...s.sleep, overrides } };
        }),
      restoreBlock: (block) =>
        set((s) => ({
          blocks: s.blocks.some((b) => b.id === block.id) ? s.blocks : [...s.blocks, block],
          series: block.seriesId
            ? s.series.map((x) =>
                x.id === block.seriesId ? { ...x, exceptions: x.exceptions.filter((d) => d !== (block.originDate ?? block.date)) } : x,
              )
            : s.series,
        })),
      logNight: (date, result) =>
        set((s) => {
          const sleepLog = { ...s.sleepLog };
          if (result) sleepLog[date] = result;
          else delete sleepLog[date];
          return { sleepLog };
        }),

      updateMission: (id, patch) =>
        set((s) => ({ missions: s.missions.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      markRecapSeen: (key) =>
        set((s) => (s.seenRecaps.includes(key) ? s : { seenRecaps: [...s.seenRecaps, key] })),

      markCheckInPrompted: (date) => set({ lastCheckInPrompt: date }),

      addBlock: (draft, repeat) => {
        let createdId: string | undefined;
        set((s) => {
          const order = Date.now();
          const remember = { lastQuadrant: draft.quadrant, lastMinutes: draft.minutes };
          if (!repeat?.length) {
            createdId = newId();
            return {
              ...remember,
              blocks: [...s.blocks, { ...draft, id: createdId, status: "pending", order }],
            };
          }
          const series: Series = {
            id: newId(),
            title: draft.title,
            quadrant: draft.quadrant,
            activityId: draft.activityId,
            minutes: draft.minutes,
            start: draft.start,
            days: [...new Set(repeat)].sort(),
            startDate: draft.date,
            exceptions: [],
            order,
          };
          const first: Block[] = occursOn(series, draft.date)
            ? [{ ...draft, id: newId(), status: "pending", order, seriesId: series.id, originDate: draft.date }]
            : [];
          createdId = first[0]?.id;
          return { ...remember, series: [...s.series, series], blocks: [...s.blocks, ...first] };
        });
        return createdId;
      },

      materialize: (days) =>
        set((s) => {
          const existing = new Set(
            s.blocks.filter((b) => b.seriesId).map((b) => `${b.seriesId}|${b.originDate}`),
          );
          const created: Block[] = [];
          for (const ser of s.series) {
            for (const day of days) {
              if (!occursOn(ser, day) || existing.has(`${ser.id}|${day}`)) continue;
              created.push({
                id: newId(),
                title: ser.title,
                quadrant: ser.quadrant,
                activityId: ser.activityId,
                minutes: ser.minutes,
                date: day,
                start: ser.start,
                status: "pending",
                order: ser.order,
                seriesId: ser.id,
                originDate: day,
              });
            }
          }
          return created.length ? { blocks: [...s.blocks, ...created] } : s;
        }),

      updateBlock: (id, patch, scope) =>
        set((s) => {
          const block = s.blocks.find((b) => b.id === id);
          if (!block) return s;
          const shared = pickShared(patch);
          const series = block.seriesId ? s.series.find((x) => x.id === block.seriesId) : undefined;
          const thisOne = (b: Block): Block => {
            const date = patch.date ?? b.date;
            const start = patch.start ?? b.start;
            const next = { ...b, ...patch };
            return date !== b.date || start !== b.start ? moved(next, date, start) : next;
          };

          if (!series || scope === "this") {
            return { blocks: s.blocks.map((b) => (b.id === id ? thisOne(b) : b)) };
          }

          // El día solo se cambia en este bloque; el resto de los campos va a toda la serie.
          const applyTo = (b: Block, seriesId: string): Block =>
            b.id === id ? { ...thisOne(b), seriesId } : { ...b, ...shared, seriesId };

          const origin = block.originDate ?? block.date;
          if (scope === "all" || origin <= series.startDate) {
            return {
              series: s.series.map((x) => (x.id === series.id ? { ...x, ...shared } : x)),
              blocks: s.blocks.map((b) => (b.seriesId === series.id ? applyTo(b, series.id) : b)),
            };
          }

          // "Este y los siguientes": cortamos la serie y arrancamos una nueva desde acá.
          const next: Series = {
            ...series,
            ...shared,
            id: newId(),
            startDate: origin,
            exceptions: series.exceptions.filter((d) => d >= origin),
          };
          return {
            series: [
              ...s.series.map((x) =>
                x.id === series.id
                  ? { ...x, until: prevDay(origin), exceptions: x.exceptions.filter((d) => d < origin) }
                  : x,
              ),
              next,
            ],
            blocks: s.blocks.map((b) =>
              b.seriesId === series.id && (b.originDate ?? b.date) >= origin ? applyTo(b, next.id) : b,
            ),
          };
        }),

      moveBlock: (id, date, start) =>
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id && (b.date !== date || b.start !== start) ? moved(b, date, start) : b,
          ),
        })),

      setStatus: (id, status) =>
        set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? { ...b, status } : b)) })),

      removeBlock: (id, scope) =>
        set((s) => {
          const block = s.blocks.find((b) => b.id === id);
          if (!block) return s;
          const series = block.seriesId ? s.series.find((x) => x.id === block.seriesId) : undefined;
          const origin = block.originDate ?? block.date;

          if (!series || scope === "this") {
            return {
              blocks: s.blocks.filter((b) => b.id !== id),
              series: series
                ? s.series.map((x) =>
                    x.id === series.id ? { ...x, exceptions: [...x.exceptions, origin] } : x,
                  )
                : s.series,
            };
          }

          if (scope === "all" || origin <= series.startDate) {
            return {
              series: s.series.filter((x) => x.id !== series.id),
              blocks: s.blocks.filter((b) => b.seriesId !== series.id),
            };
          }

          return {
            series: s.series.map((x) => (x.id === series.id ? { ...x, until: prevDay(origin) } : x)),
            blocks: s.blocks.filter(
              (b) => !(b.seriesId === series.id && (b.originDate ?? b.date) >= origin),
            ),
          };
        }),
    }),
    {
      // En modo prueba, los datos van aparte (y no se sincronizan).
      name: testKey(STORAGE_KEY),
      version: STORE_VERSION,
      migrate: (persisted, version) => migratePlanner(persisted, version),
    },
  ),
);

/** Lleva datos guardados con una versión vieja al formato actual (del navegador o de la nube). */
export function migratePlanner(persisted: unknown, version: number): PlannerState {
  let state = migrateLegacy(persisted, version);
  if (version < 6) state = toV6(state);
  if (version < 7) state = { ...state, startedAt: state.startedAt || firstDay(state) };
  // v8: llega el arranque guiado; quien ya tenía su semana cargada no lo repite.
  if (version < 8) state = { ...state, setupDone: state.setupDone || (state.routine ?? []).length > 0 };
  // v9: el sueño se muestra recién cuando lo configurás; quien ya venía usando la app, ya lo tiene.
  if (version < 9) state = { ...state, sleepSet: state.sleepSet || state.setupDone || (state.routine ?? []).length > 0 };
  // v10: una sola lista por tipo; si había repetidas, sus ítems se juntan en la primera.
  if (version < 10) state = { ...state, lists: mergeListsByType(state.lists ?? []) };
  // v11: la checklist para repetir pasa a Pendientes (cada paso, como pendiente que se repite cada día) y
  // Pendientes está siempre; llega "¿Cómo te sentiste hoy?".
  if (version < 11) state = { ...state, lists: checklistToPending(state.lists ?? []), moods: state.moods ?? [] };
  // v12: Pendientes pasa a llamarse Recordatorios (con tipos: cumpleaños, pagos, salud…).
  if (version < 12) state = { ...state, lists: (state.lists ?? []).map((l) => (l.type === "pendientes" && l.title === "Pendientes" ? { ...l, title: "Recordatorios" } : l)) };
  // v13: el inicio no sale de lo anotado en el diario (los Momentos viejos quedaban el 1° del mes).
  if (version < 13 && state.startedAt) {
    const real = firstDay({ ...state, logros: [] });
    if (real > state.startedAt) state = { ...state, startedAt: real };
  }
  return state;
}

function checklistToPending(lists: UserList[]): UserList[] {
  const checks = lists.filter((l) => l.type === "checklist");
  let out = lists.filter((l) => l.type !== "checklist");
  const moved: ListItem[] = checks.flatMap((c) => c.items.map((i) => ({ ...i, done: false, repeat: "diaria" as const, group: c.title })));
  const pending = out.find((l) => l.type === "pendientes");
  if (pending) out = out.map((l) => (l === pending ? { ...l, items: [...l.items, ...moved], groups: [...new Set([...(l.groups ?? []), ...checks.map((c) => c.title)])] } : l));
  else out = [...out, { id: "pendientes", type: "pendientes", title: "Pendientes", items: moved, groups: checks.map((c) => c.title) }];
  return out;
}

function mergeListsByType(lists: UserList[]): UserList[] {
  const out: UserList[] = [];
  for (const l of lists) {
    const first = out.find((x) => x.type === l.type);
    if (first) first.items = [...first.items, ...l.items];
    else out.push({ ...l, items: [...l.items] });
  }
  return out;
}

/**
 * Los no negociables de un mes: su lista propia o la del último mes anterior que tenga una. null si nunca se
 * eligieron por mes (valen todos).
 */
export function activeGoalIds(s: Pick<PlannerState, "goalMonths">, month: string): string[] | null {
  const months = Object.keys(s.goalMonths ?? {})
    .filter((m) => m <= month)
    .sort();
  const last = months[months.length - 1];
  return last ? s.goalMonths[last] : null;
}

/** Los no negociables vigentes en un mes, en orden. */
export function goalsFor(s: Pick<PlannerState, "goalMonths" | "dailyGoals">, month: string): DailyGoal[] {
  const ids = activeGoalIds(s, month);
  if (!ids) return s.dailyGoals;
  return ids.map((id) => s.dailyGoals.find((g) => g.id === id)).filter(Boolean) as DailyGoal[];
}

/** El primer día con algo cargado (logros, tildes o semanas guardadas); si no hay nada, hoy. */
export function firstDay(state: Partial<PlannerState>): DateKey {
  const dates = [
    ...Object.keys(state.dailyChecks ?? {}),
    ...(state.routineHistory ?? []).map((h) => h.date),
  ].filter(Boolean) as DateKey[];
  return dates.length ? dates.sort()[0] : toKey(new Date());
}

/**
 * v6: los Momentos pasan a ser logros (con fecha: el primero de su mes) y lo que era meditar o terapia
 * en Mente pasa a Mente y Alma (Mente ahora es Intelecto y Cognitivo: aprender algo nuevo).
 */
function toV6(state: PlannerState): PlannerState {
  const HOURS: Record<MomentKind, number> = { amor: 3, familia: 3, amigos: 2.5, disfrute: 3 };
  const fromMoments: Logro[] = (state.moments ?? []).map((m) => ({
    id: newId(),
    date: `${m.month}-01` as DateKey,
    text: m.text,
    category: m.kind === "disfrute" ? "alma" : "vinculos",
    minutes: Math.round((m.hours ?? HOURS[m.kind]) * 60),
  }));
  const inner = /medit|terapia|psico|respir|reza|rezo|mindful/i;
  return {
    ...state,
    logros: [...(state.logros ?? []), ...fromMoments],
    moments: [],
    routine: (state.routine ?? []).map((b) => (b.quadrant === "mente" && inner.test(b.name) ? { ...b, quadrant: "interior" } : b)),
  };
}

function migrateLegacy(persisted: unknown, version: number): PlannerState {
  type Legacy<T> = Omit<T, "start" | "days"> & {
    start?: number;
    slot?: SlotId;
    days?: RepeatDays;
    repeat?: "daily" | "weekdays";
  };
  const state = persisted as Omit<Partial<PlannerState>, "blocks" | "series"> & {
    blocks?: Legacy<Block>[];
    series?: Legacy<Series>[];
  };
  if (version < 5) {
    // Llega Libre: reservamos 15% para el tiempo libre y escalamos el resto, y sumamos actividades de base.
    const old = (state.targets ?? DEFAULT_TARGETS) as Partial<QuadrantRecord<number>>;
    if (old.libre === undefined) {
      const raw = { ...DEFAULT_TARGETS };
      for (const id of ["cuerpo", "mente", "alma", "vinculos", "trabajo"] as const) raw[id] = ((old[id] ?? 0) * 85) / 100;
      raw.libre = 15;
      state.targets = roundTargets(raw);
    }
    if (!(state.activities ?? []).some((a) => a.quadrant === "libre")) {
      state.activities = [
        ...(state.activities ?? []),
        ...["Descanso", "Traslados", "Casa"].map((name) => ({ id: newId(), quadrant: "libre" as const, name })),
      ];
    }
  }
  if (version < 4) {
    // "Todos los días" / "lun a vie" pasan a ser listas de días elegidos.
    state.series = (state.series ?? []).map(({ repeat, ...x }) => ({
      ...x,
      days: x.days ?? (repeat === "weekdays" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]),
    }));
  }
  if (version < 2) {
    Object.assign(state, { onboarded: false, userName: "", activities: [], series: [] });
  }
  if (version < 3) {
    // De "momentos" a horarios: apilamos los bloques de cada momento desde una hora fija.
    const cursor: Record<string, number> = {};
    const blocks = [...(state.blocks ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(({ slot, ...b }) => {
        if (typeof b.start === "number") return b as Block;
        const s = slot ?? "manana";
        const key = `${b.date}|${s}`;
        const start = clampStart(cursor[key] ?? SLOT_DEFAULT_START[s], b.minutes);
        cursor[key] = start + Math.ceil(b.minutes / STEP) * STEP;
        return { ...b, start } as Block;
      });
    const series = (state.series ?? []).map(({ slot, ...x }) => ({
      ...x,
      start: x.start ?? SLOT_DEFAULT_START[slot ?? "manana"],
    })) as Series[];
    return { ...state, blocks, series, seenRecaps: [], lastCheckInPrompt: "" } as unknown as PlannerState;
  }
  return state as unknown as PlannerState;
}
