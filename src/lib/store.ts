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

/** De qué parte de tu vida es un objetivo. */
export type TaskKind = "trabajo" | "cuerpo" | "mente" | "alma" | "otro";

/** Un objetivo del año ("hacer un viaje"): por mes, con fecha opcional y sin horario. */
export interface YearTask {
  kind?: TaskKind;
  id: string;
  title: string;
  /** Mes al que pertenece: "2026-12". */
  month: string;
  date?: DateKey;
  done: boolean;
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

interface PlannerState {
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
  addMoment: (m: Omit<Moment, "id">) => void;
  removeMoment: (id: string) => void;
  updateMoment: (id: string, patch: Partial<Omit<Moment, "id">>) => void;
  removeTask: (id: string) => void;
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

/** Dónde se guardan los datos en el navegador. Antes se llamaba "lifeplan:v1". */
const STORAGE_KEY = "lifebucket:v1";
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
      setSleep: (sleep) => set((s) => ({ sleep: { ...sleep, overrides: sleep.overrides ?? s.sleep.overrides } })),
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
      addTask: (task) => set((s) => ({ tasks: [...s.tasks, { ...task, id: newId(), done: false }] })),
      addMoment: (m) => set((s) => ({ moments: [...s.moments, { ...m, id: newId() }] })),
      removeMoment: (id) => set((s) => ({ moments: s.moments.filter((m) => m.id !== id) })),
      updateMoment: (id, patch) => set((s) => ({ moments: s.moments.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      moveTask: (id, month) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id || t.month === month) return t;
            const [y, m] = month.split("-").map(Number);
            const day = t.date ? Math.min(Number(t.date.slice(8, 10)), new Date(y, m, 0).getDate()) : null;
            return { ...t, month, date: day ? `${month}-${String(day).padStart(2, "0")}` : undefined };
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
      name: STORAGE_KEY,
      version: 5,
      migrate: (persisted, version) => {
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
          return { ...state, blocks, series, seenRecaps: [], lastCheckInPrompt: "" };
        }
        return state as unknown as PlannerState;
      },
    },
  ),
);
