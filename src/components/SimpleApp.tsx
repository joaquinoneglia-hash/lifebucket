"use client";

import { BarChart3, CalendarDays, ChevronUp, GripVertical, ListChecks, PartyPopper, Moon, PanelLeftOpen, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { useEffect, useState, type DragEvent } from "react";
import { cn } from "@/lib/format";
import { useMediaQuery, useViewportHeight } from "@/lib/hooks";
import { BOND_HOURS, bondBreakdown, bondWeekMinutes, funWeekMinutes } from "@/lib/bonds";
import { partStyle, SIMPLE_QUADRANTS } from "@/lib/mode";
import { isMuted, play, setMuted } from "@/lib/sfx";
import type { QuadrantId } from "@/lib/quadrants";
import { carve, WEEK_ORDER } from "@/lib/routine";
import { PARTS, thisMonday, weekRangeLabel, weekShares } from "@/lib/week-shares";
import { newId, usePlanner, type RoutineBlock } from "@/lib/store";
import { MomentsPanel } from "./MomentsPanel";
import { BrandMark } from "./BrandMark";
import { Dashboard } from "./Dashboard";
import { BlockEditor } from "./setup/BlockEditor";
import { WeekTemplateGrid } from "./setup/WeekTemplateGrid";
import { SleepDialog } from "./Sleep";
import { SleepPill } from "./SleepMeter";
import { TOUR_EVENT, UserMenu } from "./UserMenu";
import { MAIN_TOUR, Tour } from "./Tour";
import { Welcome } from "./Welcome";
import { firstName, useUser } from "@/lib/supabase/use-user";
import { TasksPanel } from "./TasksPanel";
import { SecondaryButton, Sheet } from "./ui";

/** La semana tipo va de 05:00 a 24:00, sin fechas. */
const RANGE: [number, number] = [5 * 60, 24 * 60];
const WEEK_MINUTES = (RANGE[1] - RANGE[0]) * 7;

const DAY_NAME: Record<number, string> = { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 0: "domingo" };

type Section = "semana" | "momentos" | "tablero" | "objetivos";
const DEFAULT_ORDER: Section[] = ["semana", "momentos", "objetivos", "tablero"];
const OPEN_KEY = "lb:open";
// v2: Objetivos pasó a ir antes que Resultados (se arranca de nuevo con ese orden).
const ORDER_KEY = "lb:sections:v2";

/** Un cambio de un bloque que está en varios días: se pregunta si va solo para ese día o para todos. */
type Change = { block: RoutineBlock; day: number; patch: Partial<Omit<RoutineBlock, "id" | "days">>; toDay?: number; verb: "mover" | "cambiar" };

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

/**
 * Modo simple, todo en una pantalla: tu semana (lunes a domingo, sin fechas) en bloques de Trabajo,
 * Cuerpo, Mente y Disfrute, el tablero y tus objetivos del año. Cada sección se comprime, se abre y se
 * reordena arrastrando su encabezado.
 */
export function SimpleApp() {
  const routine = usePlanner((s) => s.routine);
  const setRoutine = usePlanner((s) => s.setRoutine);
  const logRoutine = usePlanner((s) => s.logRoutine);
  const moments = usePlanner((s) => s.moments);
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
    if (weekSeen === monday) logRoutine(weekShares(routine, moments), monday);
  }, [routine, moments, weekSeen, monday, logRoutine]);

  // Qué secciones están abiertas (se recuerda). El tablero arranca cerrado para que la semana tenga lugar.
  const [open, setOpen] = useState<Record<Section, boolean>>(() => {
    const base = { semana: true, momentos: true, tablero: false, objetivos: true };
    try {
      return { ...base, ...(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Partial<Record<Section, boolean>>) };
    } catch {
      return base;
    }
  });
  const toggle = (s: Section) => {
    play(open[s] ? "close" : "open");
    const next = { ...open, [s]: !open[s] };
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {}
  };
  // Un clic suave en cada botón (los sonidos propios de cada acción van aparte).
  const [mute, setMute] = useState(isMuted);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, [role=radio], input[type=checkbox], select")) play("click");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  const [order, setOrder] = useState<Section[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null") as Section[] | null;
      if (saved && sameDays(saved as unknown as number[], DEFAULT_ORDER as unknown as number[])) return saved;
    } catch {}
    return DEFAULT_ORDER;
  });
  const [dragging, setDragging] = useState<Section | null>(null);
  const reorder = (from: Section, to: Section) => {
    if (from === to) return;
    const next = order.filter((s) => s !== from);
    next.splice(next.indexOf(to) + (order.indexOf(from) < order.indexOf(to) ? 1 : 0), 0, from);
    setOrder(next);
    play("bubble");
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {}
  };
  const dragProps = (id: Section) => ({
    onHeaderDragStart: (e: DragEvent) => {
      e.dataTransfer.setData("text/section", id);
      e.dataTransfer.effectAllowed = "move";
      setDragging(id);
    },
    dropProps: {
      onDragOver: (e: DragEvent) => {
        if (e.dataTransfer.types.includes("text/section")) e.preventDefault();
      },
      onDrop: (e: DragEvent) => {
        const from = e.dataTransfer.getData("text/section") as Section;
        setDragging(null);
        if (from) reorder(from, id);
      },
      onDragEnd: () => setDragging(null),
    },
  });

  const [editing, setEditing] = useState<{ block?: RoutineBlock; day: number; start: number; minutes?: number } | null>(null);
  const [askDelete, setAskDelete] = useState<{ block: RoutineBlock; day: number } | null>(null);
  const [askChange, setAskChange] = useState<Change | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);

  // Primera vez de cada cuenta: bienvenida y después (si quiere) la guía. La guía se puede volver a ver desde la cuenta.
  const user = useUser();
  const [intro, setIntro] = useState<"none" | "welcome" | "tour">("none");
  const seenKey = user ? `lb:welcomed:${user.id}` : null;
  useEffect(() => {
    if (!seenKey) return;
    try {
      if (!localStorage.getItem(seenKey)) setIntro("welcome");
    } catch {}
  }, [seenKey]);
  useEffect(() => {
    const start = () => setIntro("tour");
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
  const vh = useViewportHeight();
  // Sin scroll: la grilla usa todo el alto que queda debajo del encabezado.
  const gridHeight = Math.max(380, vh - (desktop ? 150 : 230));

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

  const sections: Record<Section, React.ReactNode> = {
    semana: (
      <Panel
        key="semana"
        id="semana"
        title="Semana"
        subtitle={weekRangeLabel(monday)}
        icon={CalendarDays}
        open={open.semana}
        onToggle={() => toggle("semana")}
        desktop={desktop}
        grow
        dimmed={dragging === "semana"}
        {...dragProps("semana")}
        actions={
          <>
          <span className="hidden text-[11.5px] text-ink-faint 2xl:inline">Arrastrá dentro de un bloque para meter otro · ⠿ para mover</span>
          <button
            type="button"
            data-tour="sueno-btn"
            onClick={() => setSleepOpen(true)}
            className="pressable inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Moon aria-hidden className="size-4" />
            Sueño
          </button>
          </>
        }
      >
        <WeekTemplateGrid
          template={routine}
          sleep={usePlanner.getState().sleep}
          range={RANGE}
          showSleep
          height={gridHeight}
          onChange={save}
          onCreateAt={(day, start, minutes) => setEditing({ day, start, minutes })}
          onOpen={(block, day) => setEditing({ block, day, start: block.start })}
          onDelete={(block, day) => (block.days.length > 1 ? setAskDelete({ block, day }) : remove(block, day, true))}
          onMove={(block, day, next) => change({ block, day, toDay: next.day, patch: { start: next.start, minutes: next.minutes }, verb: next.minutes !== block.minutes ? "cambiar" : "mover" })}
        />
      </Panel>
    ),
    momentos: open.momentos ? (
      <section
        key="momentos"
        data-tour="momentos"
        aria-label="Momentos del mes"
        {...dragProps("momentos").dropProps}
        className={cn("card flex shrink-0 flex-col overflow-hidden transition-opacity", desktop ? "w-[360px]" : "h-[70dvh]", dragging === "momentos" && "opacity-40")}
      >
        <MomentsPanel className="h-full" onCollapse={() => toggle("momentos")} onHeaderDragStart={dragProps("momentos").onHeaderDragStart} />
      </section>
    ) : (
      <Collapsed key="momentos" tour="momentos" title="Momentos" icon={PartyPopper} onOpen={() => toggle("momentos")} desktop={desktop} />
    ),
    tablero: (
      <Panel
        key="tablero"
        id="tablero"
        title="Resultados"
        icon={BarChart3}
        open={open.tablero}
        onToggle={() => toggle("tablero")}
        desktop={desktop}
        grow={!open.semana}
        width="w-[340px]"
        scroll
        dimmed={dragging === "tablero"}
        {...dragProps("tablero")}
      >
        <Dashboard />
      </Panel>
    ),
    objetivos: open.objetivos ? (
      <section
        key="objetivos"
        data-tour="objetivos"
        aria-label="Objetivos del año"
        {...dragProps("objetivos").dropProps}
        className={cn("card flex shrink-0 flex-col overflow-hidden transition-opacity", desktop ? "w-80" : "h-[70dvh]", dragging === "objetivos" && "opacity-40")}
      >
        <TasksPanel className="h-full" onCollapse={() => toggle("objetivos")} onHeaderDragStart={dragProps("objetivos").onHeaderDragStart} />
      </section>
    ) : (
      <Collapsed key="objetivos" tour="objetivos" title="Objetivos" icon={ListChecks} onOpen={() => toggle("objetivos")} desktop={desktop} />
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
    <div className={cn("flex flex-col", desktop ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      {wide ? (
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <h1 className="type-display">Tu semana</h1>
          </div>
          <Shares routine={routine} />
          <div className="flex items-center justify-end gap-2">
            <div data-tour="sueno">
              <SleepPill />
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
              <SleepPill compact />
            </div>
            <h1 className="flex items-center gap-1.5">
              <BrandMark size={22} />
              <span className="text-[14px] font-semibold tracking-[0.16em]">LIFEBUCKET</span>
            </h1>
            <div data-tour="cuenta" className="flex items-center gap-0.5 justify-self-end">
              {muteButton}
              <UserMenu />
            </div>
          </div>
          <Shares routine={routine} mobile />
        </header>
      )}

      <main className={cn("flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6", desktop ? "flex-row" : "flex-col")}>{order.map((s) => sections[s])}</main>

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
          title={`Borrar ${askDelete.block.name}`}
          text="Este bloque está en varios días. ¿Qué querés borrar?"
          one={`Solo el ${DAY_NAME[askDelete.day]}`}
          all="Todos los días"
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
          text="Este bloque está en varios días. ¿A cuáles aplicás el cambio?"
          one={`Solo el ${DAY_NAME[askChange.day]}`}
          all="Todos los días"
          onOne={() => apply(askChange, false)}
          onAll={() => apply(askChange, true)}
          onCancel={() => setAskChange(null)}
          isMobile={!desktop}
        />
      )}

      {sleepOpen && <SleepDialog isMobile={!desktop} onClose={() => setSleepOpen(false)} />}

      {intro === "welcome" && (
        <Welcome
          name={firstName(user)}
          onDone={(tour) => {
            markSeen();
            setIntro(tour ? "tour" : "none");
          }}
        />
      )}
      {intro === "tour" && <Tour steps={MAIN_TOUR} onClose={() => setIntro("none")} />}

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
            if (!open.semana) toggle("semana");
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
  one: string;
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
          <SecondaryButton onClick={onOne}>{one}</SecondaryButton>
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

/** Una sección que se comprime: abierta es una tarjeta con su título (de donde se arrastra para reordenar). */
function Panel({
  id,
  title,
  subtitle,
  icon,
  open,
  onToggle,
  desktop,
  grow,
  width,
  scroll,
  actions,
  dimmed,
  onHeaderDragStart,
  dropProps,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  desktop: boolean;
  grow?: boolean;
  width?: string;
  scroll?: boolean;
  actions?: React.ReactNode;
  dimmed?: boolean;
  onHeaderDragStart: (e: DragEvent) => void;
  dropProps: { onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void; onDragEnd: () => void };
  children: React.ReactNode;
}) {
  if (!open) return <Collapsed tour={id} title={title} icon={icon} onOpen={onToggle} desktop={desktop} />;
  return (
    <section
      data-tour={id}
      aria-labelledby={`panel-${id}`}
      {...dropProps}
      className={cn("card flex min-w-0 flex-col overflow-hidden transition-opacity", desktop && (grow ? "flex-1" : cn("shrink-0", width)), dimmed && "opacity-40")}
    >
      <header
        data-tour={`${id}-header`}
        draggable
        onDragStart={onHeaderDragStart}
        title="Arrastrá para reordenar"
        className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-line px-4 py-2 active:cursor-grabbing"
      >
        <span className="flex items-center gap-1.5">
          <GripVertical aria-hidden className="size-4 text-ink-faint" />
          <h2 id={`panel-${id}`} className="type-title">
            {title}
          </h2>
          {subtitle && <span className="text-[12px] text-ink-muted tabular-nums">{subtitle}</span>}
        </span>
        <span className="flex items-center gap-1">
          {actions}
          <button
            type="button"
            onClick={onToggle}
            aria-label={`Comprimir ${title.toLowerCase()}`}
            title="Comprimir"
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            {desktop ? <PanelLeftOpen aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
          </button>
        </span>
      </header>
      <div className={cn("min-h-0 flex-1 p-3", scroll && "overflow-y-auto p-4")}>{children}</div>
    </section>
  );
}

/** Sección comprimida: una pestañita con su nombre para volver a abrirla. */
function Collapsed({ tour, title, icon: Icon, onOpen, desktop }: { tour: string; title: string; icon: LucideIcon; onOpen: () => void; desktop: boolean }) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onOpen}
      aria-label={`Abrir ${title.toLowerCase()}`}
      className={cn("card pressable flex shrink-0 items-center gap-3 text-ink-muted hover:text-ink", desktop ? "w-11 flex-col py-4" : "h-11 px-4")}
    >
      <Icon aria-hidden className="size-4" />
      <span className={cn("text-[12.5px] font-semibold", desktop && "[writing-mode:vertical-rl]")}>{title}</span>
    </button>
  );
}

/** Qué incluye cada parte (la leyenda que aparece al pasar el mouse). */
const MEANING: Record<string, string> = {
  trabajo: "Tu empleo y tus proyectos.",
  cuerpo: "Entrenamiento, salud y todo lo que tenga que ver con lo físico.",
  mente: "La parte intelectual: estudiar, leer, aprender, meditar.",
  alma: "Ocio y lo que te gusta: hobbies, salir a hacer algo, música, series. Suma también tus planes de Momentos.",
  vinculos: "Tu gente: amor, familia y amigos. Suma con los momentos que cargás en Momentos.",
  libre: "Descanso, comidas, traslados y lo que no tiene nada agendado.",
};
const BOND_LABEL: Record<string, string> = { amor: "Amor", familia: "Familia", amigos: "Amigos" };

/**
 * Los % de la semana (sobre las 133 h de 05:00 a 24:00): Trabajo, Cuerpo, Mente, Disfrute, Vínculos y
 * Libre. Vínculos no está en el calendario: sus momentos del mes se pasan a horas por semana y se
 * descuentan de Libre (pasan en tu tiempo libre).
 */
function Shares({ routine, mobile }: { routine: RoutineBlock[]; mobile?: boolean }) {
  const moments = usePlanner((s) => s.moments);
  const [picked, setPicked] = useState<QuadrantId | null>(null);
  const inQuadrant = (q: QuadrantId) => routine.filter((b) => b.quadrant === q);
  const total = (list: RoutineBlock[]) => list.reduce((acc, b) => acc + b.minutes * b.days.length, 0);
  const busy = (["trabajo", "cuerpo", "mente", "alma"] as QuadrantId[]).map((q) => ({ id: q, value: total(inQuadrant(q)) }));
  const used = busy.reduce((acc, it) => acc + it.value, 0);
  const bonds = Math.min(bondWeekMinutes(moments), Math.max(0, WEEK_MINUTES - used));
  const fun = funWeekMinutes(moments);
  const funMin = Math.min(fun.minutes, Math.max(0, WEEK_MINUTES - used - bonds));
  const items = [
    ...busy.map((it) => (it.id === "alma" ? { ...it, value: it.value + funMin } : it)),
    { id: "vinculos" as QuadrantId, value: bonds },
    { id: "libre" as QuadrantId, value: Math.max(0, WEEK_MINUTES - used - bonds - funMin) },
  ];
  const pct = (m: number) => Math.round((m / WEEK_MINUTES) * 100);
  const label: Record<string, string> = { trabajo: "Trabajo", cuerpo: "Cuerpo", mente: "Mente", alma: "Disfrute", vinculos: "Vínculos", libre: "Libre" };

  /** Qué forma el % de cada parte, de lo que más pesa a lo que menos. */
  const breakdown = (q: QuadrantId, value: number): [string, number][] => {
    if (q === "vinculos") {
      return bondBreakdown(moments)
        .filter((b) => b.count)
        .map((b) => [`${BOND_LABEL[b.kind]} · ${b.count} ${b.count === 1 ? "momento" : "momentos"}`, b.minutes] as [string, number])
        .sort((a, b) => b[1] - a[1]);
    }
    const byName = new Map<string, number>();
    for (const b of inQuadrant(q)) byName.set(b.name, (byName.get(b.name) ?? 0) + b.minutes * b.days.length);
    const list = [...byName.entries()];
    if (q === "alma" && fun.count) list.push([`Planes del mes · ${fun.count}`, funMin]);
    if (q === "libre") {
      const rest = value - list.reduce((acc, [, m]) => acc + m, 0);
      if (rest > 0) list.push(["Sin agendar", rest]);
    }
    return list.sort((a, b) => b[1] - a[1]);
  };

  /** Qué significa la parte y de qué está hecho su %. */
  const detail = (it: (typeof items)[number]) => {
    const parts = breakdown(it.id, it.value);
    return (
      <>
      <p className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold">{label[it.id]}</span>
        <span className="text-ink-muted">
          {(Math.round((it.value / 60) * 10) / 10).toLocaleString("es-AR")} h · {pct(it.value)}% de la semana
        </span>
      </p>
      <p className="mt-1 mb-2.5 text-[11.5px] leading-snug text-ink-muted">{MEANING[it.id]}</p>
      {parts.length ? (
        <ul className="flex flex-col gap-1.5">
          {parts.map(([name, m]) => (
            <li key={name} className="flex flex-col gap-0.5">
              <span className="flex justify-between gap-2 text-[12px]">
                <span className="truncate">{name}</span>
                <span className="shrink-0 font-semibold">{pct(m)}%</span>
              </span>
              <span className="h-1 overflow-hidden rounded-full bg-surface-sunken">
                <span className="block h-full rounded-full bg-[var(--q)]" style={{ width: `${it.value ? (m / it.value) * 100 : 0}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-faint">
          {it.id === "vinculos" ? "Todavía no cargaste momentos este mes." : `Todavía no hay bloques de ${label[it.id].toLowerCase()}.`}
        </p>
      )}
      {it.id === "vinculos" && (
        <p className="mt-2 border-t border-line pt-2 text-[10.5px] leading-snug text-ink-faint">
          Cada cita suma ~{BOND_HOURS.amor} h, cada salida con la familia ~{BOND_HOURS.familia} h y con amigos ~
          {String(BOND_HOURS.amigos).replace(".", ",")} h. El total del mes se reparte en sus semanas.
        </p>
      )}
      </>
    );
  };

  if (mobile) {
    const open = items.find((it) => it.id === picked);
    return (
      <div data-tour="shares" className="flex flex-col gap-2">
        <ul aria-label="Tu semana en porcentajes" className="grid grid-cols-3 gap-1.5">
          {items.map((it) => (
            <li key={it.id} style={partStyle(it.id)}>
              <button
                type="button"
                aria-expanded={picked === it.id}
                onClick={() => setPicked(picked === it.id ? null : it.id)}
                className={cn(
                  "flex w-full items-center gap-1 rounded-full bg-surface/80 px-2 py-1.5 text-[11.5px] tabular-nums shadow-[var(--shadow-card)] transition-shadow",
                  picked === it.id && "ring-2 ring-[var(--q)]",
                )}
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--q)]" />
                <span className="min-w-0 flex-1 truncate text-left text-ink-muted">{label[it.id]}</span>
                <span className="font-semibold">{pct(it.value)}%</span>
              </button>
            </li>
          ))}
        </ul>
        {open && (
          <div style={partStyle(open.id)} className="animate-fade-up rounded-xl bg-surface p-3 shadow-[var(--shadow-card)]">
            {detail(open)}
          </div>
        )}
      </div>
    );
  }

  return (
    <ul data-tour="shares" aria-label="Tu semana en porcentajes" className="flex items-center gap-4 rounded-full bg-surface/80 px-4 py-2 shadow-[var(--shadow-card)]">
      {items.map((it) => (
        <li
          key={it.id}
          tabIndex={0}
          style={partStyle(it.id)}
          className={cn(
            "group relative flex cursor-default items-center gap-1.5 rounded-full text-[13px] tabular-nums outline-offset-4",
            it.id === "libre" && "border-l border-line pl-4",
          )}
        >
          <span aria-hidden className="size-2 rounded-full bg-[var(--q)]" />
          <span className="text-ink-muted">{label[it.id]}</span>
          <span className="font-semibold">{pct(it.value)}%</span>
          {/* Al pasar el mouse: qué significa y de qué está hecho ese %. */}
          <div
            role="tooltip"
            className="pointer-events-none absolute top-full left-1/2 z-40 mt-3 hidden w-64 -translate-x-1/2 rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-popover)] group-hover:block group-focus:block"
          >
            {detail(it)}
          </div>
        </li>
      ))}
    </ul>
  );
}

