"use client";

import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Eraser, ListChecks, Music, Pencil, PieChart, Target, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addDays, fromKey, toKey, weekNumber } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { formatTime } from "@/lib/time";
import { useMediaQuery } from "@/lib/hooks";
import { partStyle, SIMPLE_QUADRANTS } from "@/lib/mode";
import type { QuadrantId } from "@/lib/quadrants";
import { isMuted, play, setMuted } from "@/lib/sfx";
import { carve, emptyMinutes, WEEK_ORDER } from "@/lib/routine";
import { PARTS, thisMonday, weekRangeLabel, weekShares } from "@/lib/week-shares";
import { firstDay, newId, usePlanner, type RoutineBlock } from "@/lib/store";
import { BrandMark } from "./BrandMark";
import { BucketCard } from "./Bucket";
import { Book, RecapBook } from "./RecapBook";
import type { DiaryItem } from "@/lib/diary";
import { DiaryBox, DiaryComposer, DiaryMini, Story } from "./Diary";
import { BlockEditor } from "./setup/BlockEditor";
import { WeekTemplateGrid } from "./setup/WeekTemplateGrid";
import { SleepDialog } from "./Sleep";
import { RoutineSheet } from "./RoutineSheet";
import { PaletteSwitch, TOUR_EVENT, UserMenu } from "./UserMenu";
import { MAIN_TOUR, Tour } from "./Tour";
import { Welcome } from "./Welcome";
import { ScrollLock } from "./ScrollLock";
import { firstName, useUser } from "@/lib/supabase/use-user";
import { authConfigured } from "@/lib/supabase/config";
import { startCloudSync, useSync } from "@/lib/cloud-sync";
import { Setup } from "./Setup";
import { Reminder } from "./Reminder";
import { RoutineHint } from "./RoutineHint";
import { ListCard, ListsMenu } from "./Lists";
import { NudgeCenter, Nudges, type NudgeTarget } from "./Nudges";
import type { Nudge } from "@/lib/nudges";
import { CheerToast } from "./Cheer";
import { DailyGoals } from "./DailyGoals";
import { isZenPlaying, onZenChange, startZen, stopZen } from "@/lib/zen";
import { DashboardBoard, ModuleControls } from "./Modules";
import { YearGoals } from "./YearGoals";
import { SecondaryButton, Sheet } from "./ui";

/** La semana tipo va de 05:00 a 24:00, sin fechas. */
const RANGE: [number, number] = [5 * 60, 24 * 60];

const DAY_NAME: Record<number, string> = { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 0: "domingo" };
/** "de lunes a viernes", "todos los días" o "lunes, miércoles y viernes". */
function daysText(days: number[]) {
  const sorted = WEEK_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 7) return "todos los días";
  if (sorted.length === 5 && sorted.every((d) => d >= 1 && d <= 5)) return "de lunes a viernes";
  if (sorted.length === 2 && sorted.includes(6) && sorted.includes(0)) return "el fin de semana";
  const names = sorted.map((d) => DAY_NAME[d]);
  return `los ${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

type Section = "semana" | "logros" | "tablero" | "objetivos";
const TAB_KEY = "lb:tab";
/** Las pestañas del celular, en este orden. */
const TABS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "semana", label: "Rutina", icon: CalendarDays },
  { id: "objetivos", label: "Hoy", icon: ListChecks },
  { id: "logros", label: "Metas", icon: Target },
  { id: "tablero", label: "Balde", icon: PieChart },
];

/** Un cambio de un bloque que está en varios días: se pregunta si va solo para ese día o para todos. */
type Change = { block: RoutineBlock; day: number; patch: Partial<Omit<RoutineBlock, "id" | "days">>; toDay?: number; verb: "mover" | "cambiar" };

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

/**
 * LifeBucket: en la compu, todo a la vista. A la izquierda, cómo llenás tu balde (la torta de la semana
 * o del mes) y tus logros (el diario de cada día); en el centro, la semana tipo (los bloques que se
 * repiten); a la derecha, tus metas. En el celular, cada cosa en su pestaña.
 */
export function SimpleApp() {
  const routine = usePlanner((s) => s.routine);
  const setRoutine = usePlanner((s) => s.setRoutine);
  const logRoutine = usePlanner((s) => s.logRoutine);
  const [book, setBook] = useState(false);
  // Desde qué día cuentan las métricas: el primero con algo cargado (o hoy, si recién empezás).
  const startedAt = usePlanner((s) => s.startedAt);
  const setStartedAt = usePlanner((s) => s.setStartedAt);
  useEffect(() => {
    if (!startedAt) setStartedAt(firstDay(usePlanner.getState()));
  }, [startedAt, setStartedAt]);
  const logros = usePlanner((s) => s.logros);
  const sleepSettings = usePlanner((s) => s.sleep);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const weekSeen = usePlanner((s) => s.weekSeen);
  const setWeekSeen = usePlanner((s) => s.setWeekSeen);
  const history = usePlanner((s) => s.routineHistory);
  const save = (t: RoutineBlock[]) => setRoutine(t, []);

  // Las semanas: la primera vez se toma esta; cuando arranca una nueva, se pregunta (replicar o modificar).
  const monday = thisMonday();
  const newWeek = !!weekSeen && weekSeen !== monday;
  useEffect(() => {
    if (!weekSeen) setWeekSeen(monday);
  }, [weekSeen, monday, setWeekSeen]);
  // Mientras sea la semana confirmada, sus % se guardan solos con cada cambio (para el reporte semana a semana).
  useEffect(() => {
    if (weekSeen === monday) logRoutine(weekShares(routine, logros, sleepSettings), monday);
  }, [routine, logros, sleepSettings, weekSeen, monday, logRoutine]);

  // Un clic suave en cada botón (los sonidos propios de cada acción van aparte).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, [role=radio], input[type=checkbox], select")) play("click");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  const [editing, setEditing] = useState<{ block?: RoutineBlock; day: number; start: number; minutes?: number; draft?: { name: string; quadrant: QuadrantId; days: number[]; lock?: boolean; guided?: boolean } } | null>(null);
  const [askDelete, setAskDelete] = useState<{ block: RoutineBlock; day: number } | null>(null);
  const [askChange, setAskChange] = useState<Change | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);
  // Borrar: primero qué (la rutina, los eventos fuera de la rutina de esta semana o todo) y después confirmar.
  const [askClear, setAskClear] = useState<null | "pick" | "rutina" | "eventos" | "todo">(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  // Editar la rutina: el sueño, el trabajo y cada bloque, en una lista.
  const editButton = (
    <button
      type="button"
      data-tour="sueno"
      onClick={() => {
        play("open");
        setRoutineOpen(true);
      }}
      className="pressable inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      <Pencil aria-hidden className="size-4" />
      <span className="max-2xl:sr-only">Editar rutina</span>
    </button>
  );
  const weekEventIds = logros
    .filter((l) => l.start !== undefined && l.date >= thisMonday() && l.date <= toKey(addDays(fromKey(thisMonday()), 6)))
    .map((l) => l.id);
  const clearButton = (
    <button
      type="button"
      onClick={() => setAskClear("pick")}
      disabled={!routine.length && !weekEventIds.length}
      className="pressable inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-danger disabled:opacity-40"
    >
      <Eraser aria-hidden className="size-4" />
      <span className="max-2xl:sr-only">Borrar</span>
    </button>
  );

  // Primera vez de cada cuenta: bienvenida y después (si quiere) la guía. La guía se puede volver a ver desde la cuenta.
  const user = useUser();
  // Los datos de la cuenta en la nube: se traen al entrar y cada cambio se guarda solo.
  useEffect(() => {
    if (authConfigured && user && user.id !== "local") void startCloudSync(user.id);
  }, [user]);
  const [intro, setIntro] = useState<"none" | "welcome" | "tour">("none");
  const seenKey = user ? `lb:welcomed:${user.id}` : null;
  useEffect(() => {
    if (!seenKey) return;
    try {
      if (!localStorage.getItem(seenKey)) setIntro("welcome");
    } catch {}
  }, [seenKey]);
  useEffect(() => {
    const start = () => {
      // La guía arranca por la Semana (en el celular, la pestaña).
      setTab("semana");
      setIntro("tour");
    };
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, []);
  const markSeen = () => {
    try {
      if (seenKey) localStorage.setItem(seenKey, new Date().toISOString());
    } catch {}
  };

  const desktop = useMediaQuery("(min-width: 1024px)");
  const wide = useMediaQuery("(min-width: 768px)");

  // El arranque guiado: solo la primera vez (cuando ya se leyeron los datos de este navegador y de la nube).
  const setupDone = usePlanner((s) => s.setupDone);
  const sync = useSync((s) => s.status);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => window.setTimeout(() => setReady(true), 900);
    if (usePlanner.persist.hasHydrated()) {
      const t = go();
      return () => window.clearTimeout(t);
    }
    return usePlanner.persist.onFinishHydration(() => void go());
  }, []);
  // Atajo: ?intro en la dirección vuelve a mostrar la bienvenida y la configuración.
  useEffect(() => {
    if (!ready || !new URLSearchParams(window.location.search).has("intro")) return;
    usePlanner.getState().setSetupDone(false);
    window.history.replaceState(null, "", window.location.pathname);
  }, [ready]);
  const showSetup = ready && !setupDone && sync !== "loading";
  // Desde el balde desbordado (o cualquier botón que pida sumar un bloque): el editor, ya cargado.
  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number }>).detail;
      setEditing({ day: d.days[0] ?? 1, start: d.start, minutes: d.minutes, draft: { name: d.name, quadrant: d.quadrant, days: d.days } });
    };
    window.addEventListener("lb:add-block", open);
    return () => window.removeEventListener("lb:add-block", open);
  }, []);
  const [justSetUp, setJustSetUp] = useState(false);
  /** Desde el recordatorio: ir a cada parte (en la compu se destaca un momento; en el celular, su pestaña). */
  const goTo = (where: NudgeTarget, nudge?: Nudge) => {
    // Si el aviso trae un ejemplo, se abre el editor de la rutina ya cargado (o la configuración del sueño).
    if (nudge?.sleep) return setSleepOpen(true);
    if (nudge?.draft) {
      const d = nudge.draft;
      return setEditing({ day: d.days[0] ?? 1, start: d.start, minutes: d.minutes, draft: { name: d.name, quadrant: d.quadrant, days: d.days } });
    }
    if (phone) {
      setTab(where === "metas" ? "logros" : where === "semana" ? "semana" : where === "bucket" ? "tablero" : "objetivos");
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-module="${where}"]`);
    el?.animate([{ boxShadow: "0 0 0 0 rgba(37,40,54,0.35)" }, { boxShadow: "0 0 0 10px rgba(37,40,54,0)" }], { duration: 900, iterations: 2 });
    if (where === "diario") window.setTimeout(() => document.querySelector<HTMLElement>("#logro-text")?.focus(), 200);
  };
  // En el celular (y tablets angostas) cada sección es una pestaña: la Semana entra entera, sin scroll.
  const phone = !desktop;
  const [tab, setTab] = useState<Section>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Section | null;
      if (saved && TABS.some((t) => t.id === saved)) return saved;
    } catch {}
    return "semana";
  });
  const goTab = (t: Section) => {
    if (t === tab) return;
    play("click");
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };
  const remove = (block: RoutineBlock, day: number, all: boolean) => {
    play("delete");
    if (all || block.days.length === 1) save(routine.filter((b) => b.id !== block.id));
    else save(routine.map((b) => (b.id === block.id ? { ...b, days: b.days.filter((d) => d !== day) } : b)));
    setAskDelete(null);
  };

  /** Aplica un cambio a todos los días del bloque, o solo a ese día (lo separa en un bloque propio). */
  const apply = (c: Change, all: boolean) => {
    play("bubble");
    const target = c.toDay ?? c.day;
    if (all || c.block.days.length === 1) {
      const shift = WEEK_ORDER.indexOf(target) - WEEK_ORDER.indexOf(c.day);
      const days = shift ? c.block.days.map((d) => WEEK_ORDER[(WEEK_ORDER.indexOf(d) + shift + 7) % 7]) : c.block.days;
      // Lo que quede abajo del bloque cambiado se corta.
      save(carve(routine, { ...c.block, ...c.patch, days }));
    } else {
      const rest = routine.map((b) => (b.id === c.block.id ? { ...b, days: b.days.filter((d) => d !== c.day) } : b));
      save(carve(rest, { ...c.block, ...c.patch, id: newId(), days: [target] }));
    }
    setAskChange(null);
  };
  const change = (c: Change) => (c.block.days.length > 1 ? setAskChange(c) : apply(c, true));

  // Las semanas: numeradas y navegables. La actual se edita; las anteriores se ven como quedaron (y se pueden
  // volver a usar como rutina).
  const weekRoutines = usePlanner((s) => s.weekRoutines);
  const saveWeekRoutine = usePlanner((s) => s.saveWeekRoutine);
  const [viewWeek, setViewWeek] = useState(monday);
  const isCurrentWeek = viewWeek === monday;
  const pastRoutine = weekRoutines[viewWeek] ?? [];
  useEffect(() => {
    if (setupDone) saveWeekRoutine(monday, routine);
  }, [routine, monday, setupDone, saveWeekRoutine]);
  // Lo que anotaste en tu diario con hora en la semana que mirás: se ve en el calendario.
  const viewLogros = logros.filter((l) => l.start !== undefined && l.date >= viewWeek && l.date <= toKey(addDays(fromKey(viewWeek), 6)));
  const [replicating, setReplicating] = useState(false);
  useEffect(() => setReplicating(false), [viewWeek]);
  const replicate = (withEvents: boolean) => {
    save(pastRoutine.map((b) => ({ ...b, id: newId() })));
    if (withEvents) {
      // Los eventos fuera de la rutina pasan al mismo día de esta semana (sin repetir los que ya están).
      const shift = Math.round((fromKey(monday).getTime() - fromKey(viewWeek).getTime()) / 86_400_000);
      const st = usePlanner.getState();
      for (const l of viewLogros) {
        const date = toKey(addDays(fromKey(l.date), shift));
        if (st.logros.some((x) => x.date === date && x.start === l.start && x.text === l.text)) continue;
        st.addLogro({ text: l.text, category: l.category, minutes: l.minutes, date, start: l.start });
      }
    }
    setViewWeek(monday);
    cheer("routine", withEvents ? "Listo: replicaste esa semana, con sus eventos." : "Listo: replicaste la rutina de esa semana.");
  };
  // Mientras escribís en "¿Qué hiciste…?", lo que se entiende se dibuja en el calendario.
  const [preview, setPreview] = useState<DiaryItem[]>([]);
  useEffect(() => {
    const on = (e: Event) => setPreview((e as CustomEvent<DiaryItem[]>).detail);
    window.addEventListener("lb:diary-preview", on);
    return () => window.removeEventListener("lb:diary-preview", on);
  }, []);
  const weekEnd = toKey(addDays(fromKey(monday), 6));
  const previewThisWeek = isCurrentWeek ? preview.filter((it) => it.date >= monday && it.date <= weekEnd) : [];
  // Lo que se repite se dibuja en todos sus días.
  const previewExtras = (isCurrentWeek ? preview : [])
    .filter((it) => it.start !== undefined && (it.repeat?.length || (it.date >= monday && it.date <= weekEnd)))
    .flatMap((it, i) =>
      (it.repeat?.length ? it.repeat : [fromKey(it.date).getDay()]).map((day) => ({
        id: `preview-${i}-${day}`,
        day,
        start: it.start!,
        minutes: it.minutes || 60,
        name: it.text,
        quadrant: it.category ?? "libre",
        preview: true,
      })),
    );
  const previewDays = previewThisWeek.filter((it) => it.start === undefined).map((it) => fromKey(it.date).getDay());
  const weekExtras = viewLogros
    .map((l) => ({ id: l.id, day: fromKey(l.date).getDay(), start: l.start!, minutes: l.minutes || 60, name: l.text, quadrant: l.category ?? "libre" }));
  const empty = sleepSet ? emptyMinutes(routine, sleepSettings, RANGE[0], RANGE[1]) : 0;
  const shiftWeek = (by: number) => setViewWeek(toKey(addDays(fromKey(viewWeek), by * 7)));
  const weekNav = (
    <span className="flex items-center gap-0.5">
      <button type="button" aria-label="Semana anterior" onClick={() => shiftWeek(-1)} className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      <span className="min-w-[124px] text-center text-[12px] font-semibold tabular-nums">
        Semana {weekNumber(fromKey(viewWeek))} · <span className="font-normal text-ink-muted">{weekRangeLabel(viewWeek)}</span>
      </span>
      <button
        type="button"
        aria-label="Semana siguiente"
        disabled={isCurrentWeek}
        onClick={() => shiftWeek(1)}
        className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
      >
        <ChevronRight aria-hidden className="size-4" />
      </button>
      {!isCurrentWeek && (
        <button type="button" onClick={() => setViewWeek(monday)} className="pressable ml-1 h-7 rounded-full bg-surface-sunken px-2.5 text-[11.5px] font-semibold hover:bg-ink/10">
          Esta semana
        </button>
      )}
    </span>
  );
  const weekGrid = (h: number, fit?: boolean) =>
    !isCurrentWeek ? (
      <WeekTemplateGrid template={pastRoutine} sleep={usePlanner.getState().sleep} range={RANGE} showSleep={sleepSet} extras={weekExtras} height={h} fit={fit} />
    ) : (
    <WeekTemplateGrid
      template={routine}
      sleep={usePlanner.getState().sleep}
      range={RANGE}
      showSleep={sleepSet}
      markToday={viewWeek === monday}
      extras={[...weekExtras, ...previewExtras]}
      previewDays={previewDays}
      onExtraChange={(id, next) => {
        // El día de la semana pasa a la fecha de esta semana (lunes a domingo).
        const date = toKey(addDays(fromKey(monday), (next.day + 6) % 7));
        usePlanner.getState().updateLogro(id, { date, start: next.start, minutes: next.minutes });
        play("bubble");
      }}
      onExtraDelete={(id) => {
        usePlanner.getState().removeLogro(id);
        play("pop");
      }}
      onSleepClick={() => setSleepOpen(true)}
      onSleepResize={(dow, edge, minutes) => {
        // Como en la configuración: levantarse es de finde el sáb y dom; acostarse, el vie y sáb.
        const s = usePlanner.getState().sleep;
        const kind = edge === "wake" ? (dow === 0 || dow === 6 ? "weekend" : "weekday") : dow === 5 || dow === 6 ? "weekend" : "weekday";
        usePlanner.getState().setSleep({ ...s, [kind]: { ...s[kind], [edge]: minutes } });
        play("bubble");
      }}
      height={h}
      fit={fit}
      onChange={save}
      onCreateAt={(day, start, minutes) => setEditing({ day, start, minutes })}
      onOpen={(block, day) => setEditing({ block, day, start: block.start })}
      onDelete={(block, day) => (block.days.length > 1 ? setAskDelete({ block, day }) : remove(block, day, true))}
      onTrash={(block, day) => setAskDelete({ block, day })}
      onMove={(block, day, next) => change({ block, day, toDay: next.day, patch: { start: next.start, minutes: next.minutes }, verb: next.minutes !== block.minutes ? "cambiar" : "mover" })}
    />
  );
  const semanaPanel = (
    <Panel
      id="semana"
      title="Tu rutina semanal"
      hint={RUTINA_HINT}
      nav={weekNav}
      actions={
        isCurrentWeek ? (
          <>
            {editButton}
            {clearButton}
          </>
        ) : null
      }
    >
      {/* Siempre visible hasta que la rutina esté completa: no tiene que quedar ningún espacio vacío. */}
      {isCurrentWeek && setupDone && sleepSet && empty > 0 && (
        <div role="status" className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-[color-mix(in_oklab,#d99a00_13%,transparent)] px-3 py-2 text-[12.5px] text-[#8a6200]">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-[#d99a00]" />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">Terminá de completar tu rutina:</b> te quedan {formatMinutes(empty)} sin asignar en la semana. Arrastrá sobre los espacios en blanco y sumá qué hacés en ese rato.
          </span>
        </div>
      )}
      {isCurrentWeek && setupDone && sleepSet && empty === 0 && routine.length > 0 && (
        <div role="status" className="mb-2 rounded-xl bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] px-3 py-2 text-[12.5px] font-medium text-[color-mix(in_oklab,var(--color-success)_75%,var(--color-ink))]">
          ✓ ¡Rutina completa! Cada hora de tu semana tiene su lugar.
        </div>
      )}
      {!isCurrentWeek && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-[12.5px]">
          <span className="text-ink-muted">{pastRoutine.length ? "Así fue tu rutina esa semana (solo para ver)." : "No hay registro de esa semana."}</span>
          {pastRoutine.length > 0 && !replicating && (
            <button
              type="button"
              onClick={() => (viewLogros.length ? setReplicating(true) : replicate(false))}
              className="pressable h-8 rounded-full bg-ink px-3 text-[12px] font-semibold text-surface hover:bg-ink/90"
            >
              Replicarla en esta semana
            </button>
          )}
          {replicating && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-2">
              <span className="min-w-0 flex-1 text-[12.5px] font-medium">
                Esa semana tuvo {viewLogros.length === 1 ? "1 evento" : `${viewLogros.length} eventos`} fuera de la rutina. ¿Los copiamos también?
              </span>
              <button type="button" onClick={() => replicate(false)} className="pressable h-8 rounded-full bg-surface px-3 text-[12px] font-semibold ring-1 ring-line hover:bg-surface-sunken">
                Solo la rutina
              </button>
              <button type="button" onClick={() => replicate(true)} className="pressable h-8 rounded-full bg-ink px-3 text-[12px] font-semibold text-surface hover:bg-ink/90">
                Rutina y eventos
              </button>
            </div>
          )}
        </div>
      )}
      <FitHeight>{(h) => weekGrid(h, phone)}</FitHeight>
      {/* Lo que hiciste hoy fuera de la rutina: se anota acá y se guarda en tu diario. */}
      {isCurrentWeek && !phone && (
        <div className="mt-2 shrink-0">
          <DiaryComposer bar />
        </div>
      )}
    </Panel>
  );
  // En el celular, cada cosa en su pestaña: la rutina; Hoy (no negociables y diario); las metas; el balde y
  // cómo viene.
  const [storyMonth, setStoryMonth] = useState(new Date().toISOString().slice(0, 7));
  const phoneSections: Record<Section, React.ReactNode> = {
    semana: semanaPanel,
    objetivos: (
      <div data-tour="logros" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
        <DailyGoals className="shrink-0" />
        <DiaryBox className="shrink-0" />
        <Story month={storyMonth} setMonth={setStoryMonth} className="card shrink-0 overflow-visible" />
      </div>
    ),
    logros: (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
        <YearGoals className="shrink-0" />
      </div>
    ),
    tablero: (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
        <BucketCard showReport={false} className="shrink-0" />
        <Book className="card h-[80dvh] shrink-0 overflow-hidden" />
      </div>
    ),
  };

  // La música: un parlante (tachado si está apagada). Se lee el estado real al tocar.
  const [zen, setZen] = useState(false);
  useEffect(() => {
    setZen(isZenPlaying());
    return onZenChange(setZen);
  }, []);
  const zenButton = (
    <button
      type="button"
      data-zen-toggle
      onClick={(e) => {
        e.stopPropagation();
        if (isZenPlaying() || zen) stopZen();
        else void startZen();
      }}
      aria-pressed={zen}
      aria-label={zen ? "Apagar la música" : "Prender la música"}
      title={zen ? "Apagar la música" : "Prender la música"}
      className={cn("pressable relative grid size-10 place-items-center rounded-md hover:bg-surface/70 hover:text-ink", zen ? "text-ink" : "text-ink-muted")}
    >
      <Music aria-hidden className="size-4" />
      {/* Apagada: la nota, tachada. */}
      {!zen && <span aria-hidden className="absolute h-[2px] w-5 rotate-45 rounded-full bg-current" />}
    </button>
  );
  // Los sonidos de la app (clics, tildes, efectos): un parlante, tachado si están silenciados.
  const [mute, setMute] = useState(false);
  useEffect(() => setMute(isMuted()), []);
  const soundButton = (
    <button
      type="button"
      onClick={() => {
        setMuted(!mute);
        setMute(!mute);
        if (mute) play("pop");
      }}
      aria-pressed={!mute}
      aria-label={mute ? "Activar los sonidos" : "Silenciar los sonidos"}
      title={mute ? "Activar los sonidos" : "Silenciar los sonidos"}
      className={cn("pressable grid size-10 place-items-center rounded-md hover:bg-surface/70 hover:text-ink", mute ? "text-ink-muted" : "text-ink")}
    >
      {mute ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ScrollLock />
      {wide ? (
        // Arriba: el sueño a la izquierda, LifeBucket al centro y la cuenta a la derecha.
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 pt-4 pb-3 sm:px-6">
          <div className="flex items-center gap-2 justify-self-start">
              <button
              type="button"
              data-tour="libro"
              onClick={() => setBook(true)}
              className="pressable flex items-center gap-2 rounded-full bg-surface/80 px-3.5 py-2 text-[13px] font-medium whitespace-nowrap shadow-[var(--shadow-card)] hover:bg-surface"
            >
              <BarChart3 aria-hidden className="size-4 text-ink-muted" />
              Resumen general
            </button>
            <ListsMenu />
          </div>
          <h1 className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="text-[17px] font-semibold tracking-[0.18em]">LIFEBUCKET</span>
          </h1>
          <div className="flex items-center gap-2 justify-self-end">
            <div data-tour="cuenta" className="flex items-center gap-1">
              <NudgeCenter onGo={goTo} />
              <PaletteSwitch />
              {zenButton}
              {soundButton}
              <UserMenu />
            </div>
          </div>
          {book && <RecapBook range="mes" isMobile={false} onClose={() => setBook(false)} />}
        </header>
      ) : (
        // En el celular: LIFEBUCKET al centro, el sueño a la izquierda, la cuenta a la derecha y los % abajo.
        <header className="flex shrink-0 flex-col px-4 pt-3 pb-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div />
            <h1 className="flex items-center gap-1.5">
              <BrandMark size={22} />
              <span className="text-[14px] font-semibold tracking-[0.16em] max-[359px]:text-[12px] max-[359px]:tracking-[0.08em]">LIFEBUCKET</span>
            </h1>
            <div data-tour="cuenta" className="flex items-center gap-0.5 justify-self-end">
              <NudgeCenter onGo={goTo} compact />
              <PaletteSwitch />
              {zenButton}
              {soundButton}
              <UserMenu />
            </div>
          </div>
        </header>
      )}

      {phone ? (
        <>
          <main id="contenido" key={tab} className="animate-fade-up flex min-h-0 flex-1 flex-col px-3 pb-2">
            {phoneSections[tab]}
          </main>
          <nav
            data-tour="tabs"
            aria-label="Secciones"
            className="grid shrink-0 grid-cols-4 border-t border-line bg-surface/85 px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-xl"
          >
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-tour={on ? undefined : t.id}
                  aria-current={on ? "page" : undefined}
                  onClick={() => goTab(t.id)}
                  className={cn("pressable flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium", on ? "text-ink" : "text-ink-muted")}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-200", on && "bg-ink/[0.07]")}>
                    <t.icon aria-hidden className="size-[18px]" strokeWidth={on ? 2.2 : 1.8} />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </nav>
        </>
      ) : (
      // El dashboard de vida: la rutina arriba; abajo, tu balde y tus metas; a la derecha, los no negociables
      // y tu diario.
      <DashboardBoard
        render={(id) =>
          id === "semana" ? (
            semanaPanel
          ) : id === "bucket" ? (
            <BucketCard />
          ) : id === "metas" ? (
            <YearGoals />
          ) : id === "diarios" ? (
            <DailyGoals fit />
          ) : id === "diario" ? (
            <DiaryMini />
          ) : id.startsWith("list:") ? (
            <ListCard id={id.slice(5)} />
          ) : null
        }
      />
      )}

      {editing && (
        <BlockEditor
          block={editing.block}
          day={editing.day}
          start={editing.start}
          minutes={editing.minutes}
          draft={editing.draft}
          quadrants={SIMPLE_QUADRANTS}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            const prev = editing.block;
            setEditing(null);
            if (!prev) {
              play("pop");
              return save(carve(routine, b));
            }
            // Mismos días y cambió algo: como Google Calendar, ¿solo este día o todos?
            if (prev.days.length > 1 && sameDays(prev.days, b.days)) {
              return change({ block: prev, day: editing.day, patch: { name: b.name, quadrant: b.quadrant, start: b.start, minutes: b.minutes }, verb: "cambiar" });
            }
            save(carve(routine, b));
          }}
          onDelete={
            editing.block
              ? () => {
                  const b = editing.block!;
                  setEditing(null);
                  if (b.days.length > 1) setAskDelete({ block: b, day: editing.day });
                  else remove(b, editing.day, true);
                }
              : undefined
          }
        />
      )}

      {askDelete && (
        <Ask
          title={`Eliminar ${askDelete.block.name}`}
          text={
            askDelete.block.days.length > 1
              ? `Se repite ${daysText(askDelete.block.days)}. ¿Eliminás solo el del ${DAY_NAME[askDelete.day]} o todos?`
              : `Se saca de tu semana (${DAY_NAME[askDelete.day]}, ${formatTime(askDelete.block.start)} a ${formatTime(askDelete.block.start + askDelete.block.minutes)}).`
          }
          one={askDelete.block.days.length > 1 ? `Solo este evento (${DAY_NAME[askDelete.day]})` : undefined}
          all={askDelete.block.days.length > 1 ? "Eliminar todos los eventos" : "Eliminar evento"}
          danger
          onOne={() => remove(askDelete.block, askDelete.day, false)}
          onAll={() => remove(askDelete.block, askDelete.day, true)}
          onCancel={() => setAskDelete(null)}
          isMobile={!desktop}
        />
      )}

      {askChange && (
        <Ask
          title={`${askChange.verb === "mover" ? "Mover" : "Cambiar"} ${askChange.block.name}`}
          text={`Se repite ${daysText(askChange.block.days)}. ¿Lo ${askChange.verb === "mover" ? "movés" : "cambiás"} solo el del ${DAY_NAME[askChange.day]} o todos?`}
          one={`Solo este evento (${DAY_NAME[askChange.day]})`}
          all="Todos los eventos"
          onOne={() => apply(askChange, false)}
          onAll={() => apply(askChange, true)}
          onCancel={() => setAskChange(null)}
          isMobile={!desktop}
        />
      )}

      {askClear === "pick" && (
        <Sheet isMobile={!desktop} onClose={() => setAskClear(null)} labelledBy="clear-title" width="max-w-[400px]">
          <div className="flex flex-col gap-4 p-5">
            <div>
              <h2 id="clear-title" className="type-headline">
                ¿Qué querés borrar?
              </h2>
              <p className="type-body mt-1 text-ink-muted">Tus no negociables, metas, listas y sueño quedan como están.</p>
            </div>
            <div className="flex flex-col gap-2">
              {(
                [
                  { id: "rutina", label: "Borrar la rutina", hint: "Los bloques que se repiten cada semana.", off: !routine.length },
                  { id: "eventos", label: "Borrar los eventos fuera de la rutina", hint: `Lo que anotaste con hora esta semana (${weekEventIds.length}).`, off: !weekEventIds.length },
                  { id: "todo", label: "Borrar todo", hint: "La rutina y los eventos de esta semana.", off: !routine.length && !weekEventIds.length },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.off}
                  onClick={() => setAskClear(o.id)}
                  className={cn(
                    "pressable flex flex-col items-start rounded-xl border px-4 py-3 text-left disabled:opacity-40",
                    o.id === "todo" ? "border-danger/40 text-danger hover:bg-danger/5" : "border-line hover:bg-surface-sunken",
                  )}
                >
                  <span className="text-[14px] font-semibold">{o.label}</span>
                  <span className="text-[12.5px] text-ink-muted">{o.hint}</span>
                </button>
              ))}
              <button type="button" onClick={() => setAskClear(null)} className="pressable h-10 rounded-md px-4 font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        </Sheet>
      )}
      {askClear && askClear !== "pick" && (
        <Ask
          title={askClear === "rutina" ? "¿Seguro que borrás tu rutina?" : askClear === "eventos" ? "¿Seguro que borrás los eventos?" : "¿Seguro que borrás todo?"}
          text={
            askClear === "rutina"
              ? "Se borran todos los bloques de tu semana tipo. Los eventos fuera de la rutina quedan. No se puede deshacer."
              : askClear === "eventos"
                ? "Se borran los eventos con hora que anotaste esta semana fuera de tu rutina. Tu rutina queda. No se puede deshacer."
                : "Se borran tu rutina y los eventos de esta semana. No se puede deshacer."
          }
          all="Sí, borrar"
          danger
          onOne={() => {}}
          onAll={() => {
            if (askClear !== "eventos") save([]);
            if (askClear !== "rutina") {
              const st = usePlanner.getState();
              for (const id of weekEventIds) st.removeLogro(id);
            }
            setAskClear(null);
            play("delete");
          }}
          onCancel={() => setAskClear("pick")}
          isMobile={!desktop}
        />
      )}

      {/* En Logros y Metas hay campos para escribir abajo: ahí el asistente no aparece (taparía el botón de sumar). */}
      {/* El asistente con IA (botón flotante) queda apagado por ahora. */}
      <CheerToast />
      {showSetup && (
        <Setup
          phone={phone}
          onTab={(t) => setTab(t)}
          onSleep={() => setSleepOpen(true)}
          onAddBlock={(d) => setEditing({ day: d.days[0] ?? 1, start: d.start, minutes: d.minutes, draft: { name: d.name, quadrant: d.quadrant, days: d.days, lock: d.lock, guided: true } })}
          onDone={() => {
            setJustSetUp(true);
            markSeen();
            setIntro("none");
          }}
        />
      )}
      {setupDone && intro === "none" && <Reminder onGo={goTo} />}
      <RoutineHint armed={justSetUp} onAdd={() => setEditing({ day: 1, start: 600, minutes: 60 })} />
      {setupDone && intro === "none" && <Nudges onGo={goTo} />}

      {sleepOpen && (
        <SleepDialog
          isMobile={!desktop}
          onClose={() => {
            setSleepOpen(false);
            // Verlo y cerrarlo también cuenta como configurado (si te sirve el horario que propone).
            if (!usePlanner.getState().sleepSet) usePlanner.getState().setSleepSet(true);
          }}
        />
      )}
      {routineOpen && (
        <RoutineSheet
          isMobile={!desktop}
          onClose={() => setRoutineOpen(false)}
          onSleep={() => {
            setRoutineOpen(false);
            setSleepOpen(true);
          }}
          onEdit={(block) => {
            setRoutineOpen(false);
            setEditing({ block, day: block.days[0] ?? 1, start: block.start });
          }}
          onAdd={() => {
            setRoutineOpen(false);
            setEditing({ day: 1, start: 540, minutes: 60 });
          }}
        />
      )}

      {intro === "welcome" && setupDone && (
        <Welcome
          name={firstName(user)}
          onDone={(tour) => {
            markSeen();
            if (tour) setTab("semana");
            setIntro(tour ? "tour" : "none");
          }}
        />
      )}
      {intro === "tour" && <Tour steps={MAIN_TOUR} phone={phone} onClose={() => setIntro("none")} />}

      {newWeek && intro === "none" && setupDone && (
        <NewWeek
          week={monday}
          last={history.filter((h) => h.date < monday).at(-1)}
          isMobile={!desktop}
          onReplicate={() => {
            setWeekSeen(monday);
            play("complete");
          }}
          onModify={() => {
            setWeekSeen(monday);
            setTab("semana");
          }}
        />
      )}
    </div>
  );
}

/** Arrancó una semana nueva: ¿la misma organización o la querés cambiar? */
function NewWeek({
  week,
  last,
  isMobile,
  onReplicate,
  onModify,
}: {
  week: string;
  last?: { date: string; shares: Partial<Record<string, number>> };
  isMobile: boolean;
  onReplicate: () => void;
  onModify: () => void;
}) {
  return (
    <Sheet isMobile={isMobile} onClose={onReplicate} labelledBy="new-week-title" width="max-w-[420px]">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <p className="text-[12px] font-medium text-ink-muted">Semana nueva · {weekRangeLabel(week)}</p>
          <h2 id="new-week-title" className="type-headline mt-0.5">
            ¿Seguís con la misma semana?
          </h2>
          <p className="type-body mt-1 text-ink-muted">La semana pasada quedó guardada en tus resultados.</p>
        </div>
        {last && (
          <ul className="grid grid-cols-3 gap-1.5">
            {PARTS.map((p) => (
              <li key={p.id} style={partStyle(p.id)} className="flex flex-col rounded-lg bg-[var(--q-soft)] px-2.5 py-1.5">
                <span className="text-[10.5px] text-ink-muted">{p.label}</span>
                <span className="text-[15px] font-semibold tabular-nums">{last.shares[p.id] ?? 0}%</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onReplicate} className="pressable h-11 rounded-md bg-ink px-4 font-medium text-surface hover:bg-ink/90">
            Replicar la misma semana
          </button>
          <SecondaryButton onClick={onModify}>La quiero modificar</SecondaryButton>
        </div>
      </div>
    </Sheet>
  );
}

/** La pregunta de alcance, como en Google Calendar. */
function Ask({
  title,
  text,
  one,
  all,
  danger,
  onOne,
  onAll,
  onCancel,
  isMobile,
}: {
  title: string;
  text: string;
  /** Sin `one`: es una confirmación simple. */
  one?: string;
  all: string;
  danger?: boolean;
  onOne: () => void;
  onAll: () => void;
  onCancel: () => void;
  isMobile: boolean;
}) {
  return (
    <Sheet isMobile={isMobile} onClose={onCancel} labelledBy="ask-title" width="max-w-[380px]">
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id="ask-title" className="type-headline">
            {title}
          </h2>
          <p className="type-body mt-1 text-ink-muted">{text}</p>
        </div>
        <div className="flex flex-col gap-2">
          {one && <SecondaryButton onClick={onOne}>{one}</SecondaryButton>}
          <button
            type="button"
            onClick={onAll}
            className={cn("pressable h-11 rounded-md px-4 font-medium text-white", danger ? "bg-danger hover:bg-danger/90" : "bg-ink hover:bg-ink/90")}
          >
            {all}
          </button>
          <button type="button" onClick={onCancel} className="pressable h-10 rounded-md px-4 font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Una sección: una tarjeta con su título, siempre abierta. */
/** Qué es la rutina semanal (al pasar el mouse por el título). */
const RUTINA_HINT =
  "Lo que hacés todas las semanas: trabajo, entrenamientos, clases, comidas. Suma a tu balde de forma rutinaria: no es para cambiarlo día a día, sino para ajustarlo mes a mes. Lo que hacés fuera de la rutina lo sumás en «Cosas que hice hoy».";

function Panel({ id, title, subtitle, hint, nav, actions, scroll, children }: { id: string; title: string; subtitle?: string; hint?: string; nav?: React.ReactNode; actions?: React.ReactNode; scroll?: boolean; children: React.ReactNode }) {
  return (
    <section data-tour={id} aria-labelledby={`panel-${id}`} className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header data-tour={`${id}-header`} className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {hint ? (
            <span tabIndex={0} className="group/hint relative cursor-help rounded outline-offset-4">
              <h2 id={`panel-${id}`} className="type-title underline decoration-ink/20 decoration-dotted underline-offset-4">
                {title}
              </h2>
              <span role="tooltip" className="pointer-events-none absolute top-full left-0 z-40 mt-2 hidden w-72 rounded-xl bg-surface p-3.5 text-[12.5px] leading-snug font-normal text-ink-muted shadow-[var(--shadow-popover)] group-hover/hint:block group-focus/hint:block">
                <b className="mb-1 block text-[13px] font-semibold text-ink">{title}</b>
                {hint}
              </span>
            </span>
          ) : (
            <h2 id={`panel-${id}`} className="type-title">
              {title}
            </h2>
          )}
          {subtitle && <span className="hidden truncate text-[12px] text-ink-muted tabular-nums min-[380px]:inline">{subtitle}</span>}
          {nav}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {actions}
          <ModuleControls />
        </span>
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col p-3", scroll && "overflow-y-auto p-4")}>{children}</div>
    </section>
  );
}

/** Mide el alto disponible y se lo pasa al contenido (la grilla de la semana se ajusta a la pantalla). */
function FitHeight({ children }: { children: (height: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(Math.floor(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-hidden">
      {h > 0 && children(h)}
    </div>
  );
}
