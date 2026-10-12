"use client";

import { BarChart3, CalendarDays, Eraser, ListChecks, Trophy, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addDays, fromKey, toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { useMediaQuery } from "@/lib/hooks";
import { partStyle, SIMPLE_QUADRANTS } from "@/lib/mode";
import { isMuted, play, setMuted } from "@/lib/sfx";
import { carve, WEEK_ORDER } from "@/lib/routine";
import { ACTIVE_PARTS, partColor, PARTS, thisMonday, weekMinutes, WEEK_MINUTES, weekRangeLabel, weekShares, type Part } from "@/lib/week-shares";
import { hoursLabel, sleepStats } from "@/lib/sleep-stats";
import { newId, usePlanner, type RoutineBlock } from "@/lib/store";
import { BrandMark } from "./BrandMark";
import { BucketCard } from "./Bucket";
import { Dashboard } from "./Dashboard";
import { LogrosPanel } from "./Logros";
import { BlockEditor } from "./setup/BlockEditor";
import { WeekTemplateGrid } from "./setup/WeekTemplateGrid";
import { SleepDialog } from "./Sleep";
import { SleepPill } from "./SleepMeter";
import { TOUR_EVENT, UserMenu } from "./UserMenu";
import { MAIN_TOUR, Tour } from "./Tour";
import { Welcome } from "./Welcome";
import { AssistantFab } from "./AssistantFab";
import { ScrollLock } from "./ScrollLock";
import { firstName, useUser } from "@/lib/supabase/use-user";
import { authConfigured } from "@/lib/supabase/config";
import { startCloudSync } from "@/lib/cloud-sync";
import { TasksPanel } from "./TasksPanel";
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
  { id: "semana", label: "Semana", icon: CalendarDays },
  { id: "logros", label: "Logros", icon: Trophy },
  { id: "tablero", label: "Reporte", icon: BarChart3 },
  { id: "objetivos", label: "Metas", icon: ListChecks },
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
  const logros = usePlanner((s) => s.logros);
  const sleepSettings = usePlanner((s) => s.sleep);
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
  const [mute, setMute] = useState(isMuted);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, [role=radio], input[type=checkbox], select")) play("click");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  const [editing, setEditing] = useState<{ block?: RoutineBlock; day: number; start: number; minutes?: number } | null>(null);
  const [askDelete, setAskDelete] = useState<{ block: RoutineBlock; day: number } | null>(null);
  const [askChange, setAskChange] = useState<Change | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [askClear, setAskClear] = useState(false);
  const clearButton = (
    <button
      type="button"
      onClick={() => setAskClear(true)}
      disabled={!routine.length}
      className="pressable inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-danger disabled:opacity-40"
    >
      <Eraser aria-hidden className="size-4" />
      Limpiar todo
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

  const weekGrid = (h: number, fit?: boolean) => (
    <WeekTemplateGrid
      template={routine}
      sleep={usePlanner.getState().sleep}
      range={RANGE}
      showSleep
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
    <Panel id="semana" title="Tu semana tipo" subtitle={weekRangeLabel(monday)} actions={clearButton}>
      <FitHeight>{(h) => weekGrid(h, phone)}</FitHeight>
    </Panel>
  );
  const metasPanel = (
    <section data-tour="objetivos" aria-label="Metas" className="card flex h-full min-h-0 flex-col overflow-hidden">
      <TasksPanel className="h-full" />
    </section>
  );
  const phoneSections: Record<Section, React.ReactNode> = {
    semana: semanaPanel,
    logros: (
      <div data-tour="logros" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
        <BucketCard showReport={false} />
        <LogrosPanel className="min-h-[420px] shrink-0" />
      </div>
    ),
    objetivos: metasPanel,
    tablero: (
      <Panel id="tablero" title="Reporte" scroll>
        <Dashboard />
      </Panel>
    ),
  };

  const muteButton = (
    <button
      type="button"
      onClick={() => {
        setMuted(!mute);
        setMute(!mute);
        if (mute) play("pop");
      }}
      aria-pressed={!mute}
      aria-label={mute ? "Activar sonidos" : "Silenciar sonidos"}
      title={mute ? "Activar sonidos" : "Silenciar sonidos"}
      className="pressable grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface/70 hover:text-ink"
    >
      {mute ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ScrollLock />
      {wide ? (
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <h1 className="type-display">Tu semana</h1>
          </div>
          <Shares routine={routine} />
          <div className="flex items-center justify-end gap-2">
            <div data-tour="sueno">
              <SleepPill onClick={() => setSleepOpen(true)} />
            </div>
            <div data-tour="cuenta" className="flex items-center gap-2">
              {muteButton}
              <UserMenu />
            </div>
          </div>
        </header>
      ) : (
        // En el celular: LIFEBUCKET al centro, el sueño a la izquierda, la cuenta a la derecha y los % abajo.
        <header className="flex shrink-0 flex-col gap-2.5 px-4 pt-3 pb-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div data-tour="sueno" className="justify-self-start">
              <SleepPill compact onClick={() => setSleepOpen(true)} />
            </div>
            <h1 className="flex items-center gap-1.5">
              <BrandMark size={22} />
              <span className="text-[14px] font-semibold tracking-[0.16em] max-[359px]:text-[12px] max-[359px]:tracking-[0.08em]">LIFEBUCKET</span>
            </h1>
            <div data-tour="cuenta" className="flex items-center gap-0.5 justify-self-end">
              <UserMenu withSound />
            </div>
          </div>
          <Shares routine={routine} mobile />
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
      <main id="contenido" className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6">
        {/* Izquierda: cómo llenás tu balde y tus logros. */}
        <aside className="flex w-[340px] shrink-0 flex-col gap-3 xl:w-[360px]">
          <BucketCard className="shrink-0" />
          <LogrosPanel className="min-h-0 flex-1" />
        </aside>
        {/* Centro: la semana tipo. */}
        <div className="flex min-w-0 flex-1 flex-col">{semanaPanel}</div>
        {/* Derecha: tus metas (un organizador personal). */}
        <div className="flex w-72 shrink-0 flex-col xl:w-80">{metasPanel}</div>
      </main>
      )}

      {editing && (
        <BlockEditor
          block={editing.block}
          day={editing.day}
          start={editing.start}
          minutes={editing.minutes}
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

      {askClear && (
        <Ask
          title="¿Limpiar toda la semana?"
          text="Se borran todos los bloques de tu semana tipo. Tus momentos, tus metas y tu sueño quedan como están."
          all="Limpiar todo"
          danger
          onOne={() => {}}
          onAll={() => {
            save([]);
            setAskClear(false);
            play("delete");
          }}
          onCancel={() => setAskClear(false)}
          isMobile={!desktop}
        />
      )}

      {/* En Logros y Metas hay campos para escribir abajo: ahí el asistente no aparece (taparía el botón de sumar). */}
      {intro === "none" && (!phone || tab === "semana" || tab === "tablero") && <AssistantFab />}

      {sleepOpen && <SleepDialog isMobile={!desktop} onClose={() => setSleepOpen(false)} />}

      {intro === "welcome" && (
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

      {newWeek && intro === "none" && (
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
function Panel({ id, title, subtitle, actions, scroll, children }: { id: string; title: string; subtitle?: string; actions?: React.ReactNode; scroll?: boolean; children: React.ReactNode }) {
  return (
    <section data-tour={id} aria-labelledby={`panel-${id}`} className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header data-tour={`${id}-header`} className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <h2 id={`panel-${id}`} className="type-title">
            {title}
          </h2>
          {subtitle && <span className="hidden truncate text-[12px] text-ink-muted tabular-nums min-[380px]:inline">{subtitle}</span>}
        </span>
        {actions && <span className="flex shrink-0 items-center gap-1">{actions}</span>}
      </header>
      <div className={cn("min-h-0 flex-1 p-3", scroll && "overflow-y-auto p-4")}>{children}</div>
    </section>
  );
}

/** Qué incluye cada grupo (lo que aparece al tocarlo o pasar el mouse). */
const MEANING = {
  trabajo: "Tu empleo y tus proyectos: la base de tu semana.",
  bien: "Lo que se trabaja y se juega: Deporte, Mente y Alma, Hobbies y disfrute, Habilidades y Vínculos. Suma tu semana tipo y tus logros de esta semana.",
  espacio: "Lo que queda por llenar: el tiempo sin agendar (comidas, descanso, traslados) y lo que dormís.",
};
type GroupId = "trabajo" | "bien" | "espacio";

/**
 * Tu semana entera (168 h) en una barra que se llena: el Trabajo y lo que te hace bien (Deporte, Mente y
 * Alma, Hobbies, Habilidades, Vínculos) la van ocupando y lo que queda es Libre y sueño. Suma la semana tipo
 * y los logros de esta semana. Abajo, los tres grupos con su %; tocando cada uno, el detalle.
 */
function Shares({ routine, mobile }: { routine: RoutineBlock[]; mobile?: boolean }) {
  const logros = usePlanner((s) => s.logros);
  const sleep = usePlanner((s) => s.sleep);
  const [picked, setPicked] = useState<GroupId | null>(null);
  const monday = thisMonday();
  const minutes = weekMinutes(routine, logros, sleep, monday);
  const weekLogros = logros.filter((l) => l.date >= monday && l.date <= toKey(addDays(fromKey(monday), 6)));
  const pct = (m: number) => Math.round((m / WEEK_MINUTES) * 100);
  const h = (min: number) => `${(Math.round((min / 60) * 10) / 10).toLocaleString("es-AR")} h`;
  const label = (p: Part) => PARTS.find((x) => x.id === p)!.label;

  const groups: { id: GroupId; label: string; short: string; members: Part[] }[] = [
    { id: "trabajo", label: "Trabajo", short: "Trabajo", members: ["trabajo"] },
    { id: "bien", label: "Lo que te hace bien", short: "Para vos", members: ACTIVE_PARTS },
    { id: "espacio", label: "Libre y sueño", short: "Libre y sueño", members: ["libre", "sueno"] },
  ];
  const total = (g: (typeof groups)[number]) => g.members.reduce((acc, m) => acc + minutes[m], 0);

  /** De qué está hecha cada parte: los bloques de la semana (por nombre) y los logros de esta semana. */
  const items = (p: Part): [string, number][] => {
    if (p === "sueno") return [[`${hoursLabel(sleepStats(sleep).perNight)} por noche`, minutes.sueno]];
    const by = new Map<string, number>();
    for (const b of routine) if (b.quadrant === p) by.set(b.name, (by.get(b.name) ?? 0) + b.minutes * b.days.length);
    for (const l of weekLogros) if (l.category === p) by.set(l.text, (by.get(l.text) ?? 0) + l.minutes);
    const list = [...by.entries()];
    if (p === "libre") {
      const rest = minutes.libre - list.reduce((acc, [, m]) => acc + m, 0);
      if (rest > 0) list.push(["Sin agendar", rest]);
    }
    return list.sort((a, b) => b[1] - a[1]);
  };

  /** El detalle de un grupo: qué es, y cada parte con sus horas y de qué está hecha. */
  const detail = (g: (typeof groups)[number]) => (
    <>
      <p className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-semibold">{g.label}</span>
        <span className="shrink-0 text-ink-muted tabular-nums">
          {h(total(g))} · {pct(total(g))}% de la semana
        </span>
      </p>
      <p className="mt-1 mb-3 text-[11.5px] leading-snug text-ink-muted">{MEANING[g.id]}</p>
      <ul className="flex flex-col gap-2.5">
        {g.members.map((m) => {
          const list = items(m).slice(0, 4);
          return (
            <li key={m} className={cn("flex flex-col gap-1", minutes[m] === 0 && "opacity-50")}>
              <span className="flex items-center gap-1.5 text-[12.5px]">
                <span aria-hidden className="size-2 rounded-full" style={{ background: partColor(m) }} />
                <span className="font-medium">{label(m)}</span>
                <span className="ml-auto shrink-0 text-ink-muted tabular-nums">{h(minutes[m])}</span>
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{pct(minutes[m])}%</span>
              </span>
              {list.length > 0 && m !== "sueno" && (
                <span className="pl-3.5 text-[11px] leading-snug text-ink-muted">{list.map(([n, mm]) => `${n} ${h(mm)}`).join(" · ")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  /** La barra de la semana: Trabajo y lo que te hace bien la van llenando; lo que queda es libre y sueño. */
  const bar = (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
      {(["trabajo", ...ACTIVE_PARTS] as Part[]).map((m) =>
        minutes[m] > 0 ? <span key={m} className="h-full shrink-0 transition-[width] duration-500" style={{ width: `${(minutes[m] / WEEK_MINUTES) * 100}%`, background: partColor(m) }} /> : null,
      )}
      <span className="h-full min-w-0 flex-1 transition-[width] duration-500" style={FREE_FILL} />
    </div>
  );

  /** Cómo se ve cada grupo en la leyenda (lo que te hace bien, con sus colores). */
  const swatch = (g: (typeof groups)[number]) =>
    g.id === "espacio" ? (
      <span aria-hidden className="h-2 w-3.5 shrink-0 rounded-full" style={FREE_FILL} />
    ) : g.id === "bien" && mobile ? (
      <span aria-hidden className="h-2 w-4 shrink-0 rounded-full" style={{ background: `linear-gradient(90deg, ${ACTIVE_PARTS.map((p) => partColor(p)).join(", ")})` }} />
    ) : (
      <span aria-hidden className="flex shrink-0 gap-[2px]">
        {g.members.map((m) => (
          <span key={m} className="size-2 rounded-full" style={{ background: partColor(m) }} />
        ))}
      </span>
    );

  if (mobile) {
    const open = groups.find((g) => g.id === picked);
    return (
      <div data-tour="shares" className="flex flex-col gap-2 rounded-2xl bg-surface/80 px-3 py-2.5 shadow-[var(--shadow-card)]">
        {bar}
        <ul aria-label="Tu semana en tres grupos" className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
          {groups.map((g) => (
            <li key={g.id} className={cn(g.id === "bien" && "justify-self-center", g.id === "espacio" && "justify-self-end")}>
              <button
                type="button"
                aria-expanded={picked === g.id}
                onClick={() => setPicked(picked === g.id ? null : g.id)}
                className={cn("flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] whitespace-nowrap tabular-nums", picked === g.id && "bg-surface-sunken")}
              >
                {swatch(g)}
                <span className="text-ink-muted">{g.short}</span>
                <span className="font-semibold">{pct(total(g))}%</span>
              </button>
            </li>
          ))}
        </ul>
        {open && <div className="animate-fade-up border-t border-line pt-2.5">{detail(open)}</div>}
      </div>
    );
  }

  return (
    <div data-tour="shares" className="flex w-[min(560px,100%)] flex-col gap-2 rounded-2xl bg-surface/80 px-4 py-2.5 shadow-[var(--shadow-card)]">
      {bar}
      <ul aria-label="Tu semana en tres grupos" className="flex items-center justify-between gap-3">
        {groups.map((g) => (
          <li key={g.id} tabIndex={0} className="group relative flex cursor-default items-center gap-1.5 rounded-full text-[12.5px] whitespace-nowrap tabular-nums outline-offset-4">
            {swatch(g)}
            <span className="text-ink-muted">{g.label}</span>
            <span className="font-semibold">{pct(total(g))}%</span>
            {/* Al pasar el mouse: qué es y de qué está hecho. */}
            <div
              role="tooltip"
              className={cn(
                "pointer-events-none absolute top-full z-40 mt-3 hidden w-80 rounded-xl bg-surface p-3.5 text-left whitespace-normal shadow-[var(--shadow-popover)] group-hover:block group-focus:block",
                g.id === "trabajo" ? "left-0" : g.id === "espacio" ? "right-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              {detail(g)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Libre y sueño: gris rayado (como el sueño en el calendario), un solo espacio por llenar. */
const FREE_FILL: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-ink) 16%, transparent) 0 3px, color-mix(in oklab, var(--color-ink) 7%, transparent) 3px 6px)",
};

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
    <div ref={ref} className="h-full min-h-0 overflow-hidden">
      {h > 0 && children(h)}
    </div>
  );
}
