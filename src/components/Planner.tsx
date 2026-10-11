"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, CalendarSync, ClipboardCheck, ListChecks, Moon, PanelRightClose, PanelRightOpen, Plus, Shapes, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeBalance } from "@/lib/balance";
import { awakeWindow, gridRange, withLibre } from "@/lib/sleep";
import { pendingRitualWeek } from "@/lib/coach";
import { weekToPlan } from "@/lib/missions";
import { SIMPLE_ACTIVITIES, SIMPLE_MODE } from "@/lib/mode";
import { TasksPanel } from "./TasksPanel";
import { SimpleApp } from "./SimpleApp";
import { addDays, formatWeekRange, fromKey, startOfWeek, toKey, weekKeys, type DateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { useMediaQuery, useMounted, useViewportHeight } from "@/lib/hooks";
import { quadrantStyle, type QuadrantRecord } from "@/lib/quadrants";
import { inPeriod, overdueBlocks, periodOf, type Period } from "@/lib/report";
import { usePlanner, type Block } from "@/lib/store";
import { clampStart, nextHalfHour, nowMinutes, setDayRange, snap, STEP } from "@/lib/time";
import { ActivitiesView } from "./ActivitiesView";
import { QuadrantIcon } from "./QuadrantIcon";
import { AssistantPanel } from "./AssistantPanel";
import { BalanceCard, COMPACT_BAR_H, CompactBalance } from "./BalanceCard";
import { BlockFace } from "./BlockCard";
import { BlockSheet, type SheetState } from "./BlockSheet";
import { BrandMark } from "./BrandMark";
import { CheckIn } from "./CheckIn";
import { DAY_DROP_PREFIX, DayView } from "./DayView";
import { Onboarding } from "./Onboarding";
import { MissionsStrip } from "./MissionsStrip";
import { Recap } from "./Recap";
import { Ritual } from "./Ritual";
import { WeekSetup } from "./WeekSetup";
import { DaySleepSheet, SleepDialog } from "./Sleep";
import { ReportView } from "./ReportView";
import { TargetsDialog } from "./TargetsDialog";
import { blockHeight, COL_DROP_PREFIX, row, setRow, TimeGrid } from "./TimeGrid";
import { SecondaryButton, Sheet } from "./ui";

type View = "semana" | "balance" | "actividades" | "objetivos";

/**
 * La ficha que arrastrás encastra en la grilla: salta de a tramos de 30 min y
 * se alinea a la columna del día que tenés debajo, como si ya estuviera ahí.
 */
const snapToGrid: Modifier = ({ transform, over, activeNodeRect }) => {
  if (!activeNodeRect) return transform;
  const y = Math.round(transform.y / row()) * row();
  if (over && String(over.id).startsWith(COL_DROP_PREFIX)) {
    return { ...transform, x: over.rect.left + 3 - activeNodeRect.left, y };
  }
  return { ...transform, y };
};

const NAV: { id: View; label: string; icon: LucideIcon }[] = SIMPLE_MODE
  ? [
      { id: "semana", label: "Calendario", icon: CalendarDays },
      { id: "objetivos", label: "Objetivos", icon: ListChecks },
    ]
  : [
      { id: "semana", label: "Semana", icon: CalendarDays },
      { id: "balance", label: "Balance", icon: BarChart3 },
      { id: "actividades", label: "Actividades", icon: Shapes },
    ];

const longDate = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h >= 6 && h < 13) return "Buen día";
  if (h >= 13 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Resúmenes de la semana y el mes que terminaron y todavía no viste. */
function pendingRecaps(): Period[] {
  const { blocks, seenRecaps } = usePlanner.getState();
  const today = new Date();
  const candidates = [
    periodOf("week", addDays(startOfWeek(today), -7)),
    periodOf("month", new Date(today.getFullYear(), today.getMonth() - 1, 1)),
  ];
  return candidates.filter(
    (p) => !seenRecaps.includes(`${p.kind}:${p.start}`) && inPeriod(blocks, p).some((b) => b.status === "done"),
  );
}

export function Planner() {
  // Los datos viven en el navegador: no renderizamos en el servidor.
  const mounted = useMounted();
  const onboarded = usePlanner((s) => s.onboarded);
  if (!mounted) return <div className="min-h-dvh" />;
  if (SIMPLE_MODE) return <SimpleApp />;
  return onboarded ? <PlannerApp /> : <Onboarding />;
}

function PlannerApp() {
  const blocks = usePlanner((s) => s.blocks);
  const series = usePlanner((s) => s.series);
  const targets = usePlanner((s) => s.targets);
  const userName = usePlanner((s) => s.userName);
  const lastCheckInPrompt = usePlanner((s) => s.lastCheckInPrompt);
  const moveBlock = usePlanner((s) => s.moveBlock);
  const materialize = usePlanner((s) => s.materialize);
  const markRecapSeen = usePlanner((s) => s.markRecapSeen);
  const markCheckInPrompted = usePlanner((s) => s.markCheckInPrompted);
  const logRitual = usePlanner((s) => s.logRitual);

  const isMobile = !useMediaQuery("(min-width: 640px)");
  const hasRail = useMediaQuery("(min-width: 768px)");
  const isWide = useMediaQuery("(min-width: 1180px)");
  // Por debajo de 900px la semana entera no entra cómoda: se ve día por día.
  const isWeekGrid = useMediaQuery("(min-width: 900px)");

  // El rango de la grilla sale del horario de sueño (de la hora más temprana en que te levantás a la más tarde en que te acostás).
  const sleep = usePlanner((s) => s.sleep);
  /** Inicio válido para un bloque ese día: dentro de tu ventana despierto. */
  const fitAwake = (date: DateKey, start: number, minutes: number) => {
    const { wake, bed } = awakeWindow(date, sleep);
    return clampStart(start, minutes, wake, bed);
  };

  const todayKey = toKey(new Date());
  const [view, setView] = useState<View>("semana");
  // Recién armada la rutina, se abre la semana que se está planificando (el finde, la que viene).
  const [weekStart, setWeekStart] = useState(() => {
    let fresh = false;
    try {
      fresh = sessionStorage.getItem("lb:fresh") === "1";
      sessionStorage.removeItem("lb:fresh");
    } catch {}
    return fresh ? fromKey(weekToPlan()) : startOfWeek(new Date());
  });
  const [selectedDay, setSelectedDay] = useState<DateKey>(todayKey);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Hora en la que quedaría la ficha si la soltás ahora (la muestra mientras arrastrás). */
  const [dragStartPreview, setDragStartPreview] = useState<number | null>(null);
  const [checkInIds, setCheckInIds] = useState<string[] | null>(null);
  const [recapQueue, setRecapQueue] = useState<Period[]>(pendingRecaps);
  const [manualRecap, setManualRecap] = useState<Period | null>(null);
  const [reportPeriod, setReportPeriod] = useState(() => periodOf("week", new Date()));
  const [editingTargets, setEditingTargets] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sleepDay, setSleepDay] = useState<DateKey | null>(null);
  // Semana base: se abre sola después del onboarding; "completar" resalta los espacios libres.
  const setupPending = usePlanner((s) => s.weekSetupPending);
  const setWeekSetupPending = usePlanner((s) => s.setWeekSetupPending);
  const [setupOpen, setSetupOpen] = useState(false);
  const [fillMode, setFillMode] = useState(false);
  const showSetup = setupOpen || setupPending;
  const closeSetup = () => {
    setSetupOpen(false);
    // Armar la semana base ya es planificarla: el ritual de esa semana queda hecho.
    if (setupPending) logRitual(weekToPlan(), "done");
    setWeekSetupPending(false);
    setView("semana");
    goToWeek(fromKey(weekToPlan()));
    setFillMode(true);
  };
  const [sleepDialog, setSleepDialog] = useState(false);
  // Borrado rápido con deshacer.
  const removeBlock = usePlanner((s) => s.removeBlock);
  const restoreBlock = usePlanner((s) => s.restoreBlock);
  const [undo, setUndo] = useState<Block | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);
  const [askDelete, setAskDelete] = useState<Block | null>(null);
  const quickDelete = (id: string) => {
    const block = usePlanner.getState().blocks.find((b) => b.id === id);
    if (!block) return;
    // Si se repite, preguntamos: solo este o este y los siguientes.
    if (block.seriesId) return setAskDelete(block);
    removeBlock(id, "this");
    setUndo(block);
  };
  const [tasksOpen, setTasksOpen] = useState(true);

  // Cuando la tarjeta de balance sale de la pantalla, aparece la barra compacta arriba.
  const balanceRef = useRef<HTMLDivElement>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  useEffect(() => {
    const el = balanceRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setBalanceHidden(!entry.isIntersecting), {
      rootMargin: `-${COMPACT_BAR_H}px 0px 0px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [view]);

  const days = useMemo(() => weekKeys(weekStart), [weekStart]);
  const grid = gridRange(sleep, days);
  setDayRange(grid.start, grid.end);
  // El día entero entra en la pantalla: el alto de cada media hora se ajusta a la ventana.
  // Lo que queda arriba de la grilla: barra compacta + navegación y días (o selector de día y barra inferior en mobile).
  const viewportH = useViewportHeight();
  const chrome = SIMPLE_MODE ? (isWeekGrid ? 236 : 330) : isWeekGrid ? COMPACT_BAR_H + 112 + 20 : COMPACT_BAR_H + 150 + 90;
  setRow((viewportH - chrome) / ((grid.end - grid.start) / STEP));
  const isCurrentWeek = days.includes(todayKey);
  const overdue = useMemo(() => overdueBlocks(blocks, todayKey, nowMinutes()), [blocks, todayKey]);

  // Modo simple: si todavía no hay actividades, se crean unas de base.
  useEffect(() => {
    if (!SIMPLE_MODE) return;
    const store = usePlanner.getState();
    if (!store.activities.length) for (const a of SIMPLE_ACTIVITIES) store.addActivity(a.quadrant, a.name);
  }, []);

  // Los eventos que se repiten se crean a medida que aparece cada semana.
  useEffect(() => {
    materialize(days);
  }, [days, series, materialize]);

  // El ritual de reprogramar se abre solo en su momento (después de los resúmenes). Incluye el check-in.
  const [ritualWeek, setRitualWeek] = useState<DateKey | null>(null);
  const ritualPending = useMemo(() => pendingRitualWeek(), []);
  useEffect(() => {
    if (SIMPLE_MODE || recapQueue.length || ritualWeek || !ritualPending || setupPending) return;
    setRitualWeek(ritualPending);
  }, [recapQueue.length, ritualWeek, ritualPending, setupPending]);

  // Una vez por día, si quedaron bloques sin marcar, la app pregunta sola (si no toca el ritual).
  useEffect(() => {
    if (SIMPLE_MODE || recapQueue.length || ritualPending || ritualWeek || checkInIds || !overdue.length || lastCheckInPrompt === todayKey) return;
    markCheckInPrompted(todayKey);
    setCheckInIds(overdue.map((b) => b.id));
  }, [recapQueue.length, ritualPending, ritualWeek, checkInIds, overdue, lastCheckInPrompt, todayKey, markCheckInPrompted]);

  // Todo minuto despierto queda asignado: los huecos se completan con Libre.
  const weekBlocks = useMemo(() => {
    const inWeek = new Set(days);
    return withLibre(blocks.filter((b) => inWeek.has(b.date)), days, sleep);
  }, [blocks, days, sleep]);

  const blocksByDay = useMemo(() => {
    const map = new Map<DateKey, Block[]>();
    for (const b of weekBlocks) map.set(b.date, [...(map.get(b.date) ?? []), b]);
    return map;
  }, [weekBlocks]);

  const stats = useMemo(() => computeBalance(weekBlocks, targets), [weekBlocks, targets]);
  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  const goToWeek = (start: Date) => {
    const keys = weekKeys(start);
    setWeekStart(start);
    setSelectedDay(keys.includes(todayKey) ? todayKey : keys[0]);
  };

  const openCreate = (date: DateKey, start: number, minutes?: number) =>
    setSheet({ mode: "create", date, start: fitAwake(date, start, minutes ?? 60), minutes });
  const openEdit = (id: string) => setSheet({ mode: "edit", id });
  const defaultDay = isMobile ? selectedDay : isCurrentWeek ? todayKey : days[0];
  const createNow = () => openCreate(defaultDay, defaultDay === todayKey ? nextHalfHour() : awakeWindow(defaultDay, sleep).wake + 60);

  const scheduleFromReport = (activityId: string | undefined, minutes: number) => {
    goToWeek(startOfWeek(new Date()));
    setView("semana");
    setSheet({ mode: "create", date: todayKey, start: fitAwake(todayKey, nextHalfHour(minutes), minutes), activityId, minutes });
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragStartPreview(null);
  };
  const onDragMove = ({ active, delta, over }: DragMoveEvent) => {
    const block = blocks.find((b) => b.id === String(active.id));
    if (!block || !over || !String(over.id).startsWith(COL_DROP_PREFIX)) return setDragStartPreview(null);
    const date = String(over.id).slice(COL_DROP_PREFIX.length);
    setDragStartPreview(fitAwake(date, block.start + snap((delta.y / row()) * STEP), block.minutes));
  };
  const onDragEnd = ({ active, over, delta }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const id = String(active.id);
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const target = String(over.id);
    if (target.startsWith(DAY_DROP_PREFIX)) {
      const date = target.slice(DAY_DROP_PREFIX.length);
      moveBlock(id, date, fitAwake(date, block.start, block.minutes));
      return;
    }
    if (target.startsWith(COL_DROP_PREFIX)) {
      // Todas las columnas comparten la misma grilla vertical: la hora nueva sale del
      // desplazamiento vertical, redondeado al mismo tramo de 30 min que muestra la ficha.
      const date = target.slice(COL_DROP_PREFIX.length);
      moveBlock(id, date, fitAwake(date, block.start + snap((delta.y / row()) * STEP), block.minutes));
    }
  };

  const closeRecap = () => {
    const [current, ...rest] = recapQueue;
    if (current) markRecapSeen(`${current.kind}:${current.start}`);
    setRecapQueue(rest);
  };
  const openReports = (p: Period) => {
    setRecapQueue([]);
    recapQueue.forEach((r) => markRecapSeen(`${r.kind}:${r.start}`));
    setManualRecap(null);
    setReportPeriod(p);
    setView("balance");
  };
  const shownRecap = manualRecap ?? recapQueue[0] ?? null;

  const firstName = userName.split(" ")[0];
  const title =
    view === "semana"
      ? `${greeting()}${firstName ? `, ${firstName}` : ""}`
      : view === "balance"
        ? "Tu balance"
        : view === "objetivos"
          ? "Objetivos del año"
          : "Tus actividades";

  return (
    <DndContext
      sensors={sensors}
      // El destino lo define el puntero (no la ficha encastrada), así cambiar de día es natural.
      collisionDetection={pointerWithin}
      modifiers={[snapToGrid]}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={cn("min-h-dvh", hasRail && "pl-[72px]")}>
        {hasRail && <Rail view={view} onChange={setView} userName={userName} />}

        <main
          className={cn(
            "mx-auto max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7",
            SIMPLE_MODE && hasRail ? "pb-4" : hasRail ? "pb-10" : "pb-[calc(env(safe-area-inset-bottom)+150px)]",
          )}
        >
          <header className={cn("flex items-center justify-between gap-4", SIMPLE_MODE ? "mb-3" : "mb-5")}>
            <div className="flex min-w-0 items-center gap-3">
              {!hasRail && <BrandMark size={30} />}
              <div className="min-w-0">
                <h1 className="type-display truncate">{title}</h1>
                <p className="type-body text-ink-muted first-letter:uppercase">{longDate.format(new Date())}</p>
              </div>
            </div>
            {SIMPLE_MODE && view === "semana" && <WeekShares plan={stats.plan} />}
            <div className="flex shrink-0 items-center gap-2">
              {SIMPLE_MODE && view === "semana" && isWide && (
                <button
                  type="button"
                  onClick={() => setTasksOpen((o) => !o)}
                  aria-pressed={tasksOpen}
                  className="pressable inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface pr-4 pl-3 font-medium text-ink hover:bg-surface-sunken"
                >
                  {tasksOpen ? <PanelRightClose aria-hidden className="size-4" /> : <PanelRightOpen aria-hidden className="size-4" />}
                  Objetivos
                </button>
              )}
              {!SIMPLE_MODE && (
                <>
              <button
                type="button"
                onClick={() => setRitualWeek(weekToPlan())}
                aria-label="Reprogramar mi semana"
                title="Reprogramar mi semana"
                className={cn(
                  "pressable inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface font-medium text-ink hover:bg-surface-sunken",
                  isMobile ? "w-10 justify-center" : "pr-4 pl-3",
                )}
              >
                <CalendarSync aria-hidden className="size-4" strokeWidth={1.75} />
                {!isMobile && "Reprogramar"}
              </button>
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                aria-label="Abrir asistente"
                className={cn(
                  "pressable inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface font-medium text-ink hover:bg-surface-sunken",
                  isMobile ? "w-10 justify-center" : "pr-4 pl-3",
                )}
              >
                <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
                {!isMobile && "Asistente"}
              </button>
                </>
              )}
              {!isMobile && view === "semana" && (
                <button
                  type="button"
                  onClick={createNow}
                  className="pressable inline-flex h-10 items-center gap-1.5 rounded-md bg-ink pr-4 pl-3 font-medium text-surface hover:bg-ink/90"
                >
                  <Plus aria-hidden className="size-4" />
                  Nuevo bloque
                </button>
              )}
            </div>
          </header>

          {view === "actividades" && <ActivitiesView onOpenSetup={() => setSetupOpen(true)} />}

          {view === "objetivos" && (
            <section aria-label="Objetivos del año" className="card mx-auto flex h-[calc(100dvh-150px)] max-w-2xl flex-col overflow-hidden">
              <TasksPanel className="h-full" />
            </section>
          )}

          {view === "balance" && (
            <ReportView
              period={reportPeriod}
              onPeriodChange={setReportPeriod}
              onSchedule={scheduleFromReport}
              onEditTargets={() => setEditingTargets(true)}
              onOpenRecap={setManualRecap}
              onReprogram={() => setRitualWeek(weekToPlan())}
            />
          )}

          {view === "semana" && (
            <div className="flex flex-col gap-5">
              {!SIMPLE_MODE && overdue.length > 0 && (
                <OverdueBanner count={overdue.length} onReview={() => setCheckInIds(overdue.map((b) => b.id))} />
              )}

              {!SIMPLE_MODE && fillMode && (
                <FillBanner
                  blocks={weekBlocks}
                  targets={targets}
                  onDone={() => setFillMode(false)}
                />
              )}

              {!SIMPLE_MODE && <MissionsStrip
                week={days[0]}
                onSchedule={(m) =>
                  setSheet({
                    mode: "create",
                    date: days.includes(todayKey) ? todayKey : days[0],
                    start: days.includes(todayKey) ? nextHalfHour(m.minutes) : 9 * 60,
                    activityId: m.activityId,
                    minutes: m.minutes,
                    missionId: m.id,
                  })
                }
              />}

              {!SIMPLE_MODE && <div ref={balanceRef}>
                <BalanceCard stats={stats} targets={targets} compact={!isWide} days={days} />
              </div>}

              <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
              {!isWeekGrid ? (
                <>
                  <WeekNav
                    range={formatWeekRange(weekStart)}
                    isCurrentWeek={isCurrentWeek}
                    onPrev={() => goToWeek(addDays(weekStart, -7))}
                    onNext={() => goToWeek(addDays(weekStart, 7))}
                    onToday={() => goToWeek(startOfWeek(new Date()))}
                    onSleep={() => setSleepDialog(true)}
                  />
                  <DayView
                    days={days}
                    todayKey={todayKey}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    blocksByDay={blocksByDay}
                    onCreate={openCreate}
                    onOpen={openEdit}
                    onDelete={quickDelete}
                    onEditSleep={setSleepDay}
                    dragging={activeId !== null}
                    highlightLibre={fillMode}
                  />
                </>
              ) : (
                // overflow-clip (no hidden): recorta las esquinas sin romper el encabezado pegajoso.
                <section aria-label="Tu semana" className="card overflow-clip">
                  <TimeGrid
                    days={days}
                    todayKey={todayKey}
                    blocksByDay={blocksByDay}
                    onCreate={openCreate}
                    onOpen={openEdit}
                    onDelete={quickDelete}
                    onEditSleep={setSleepDay}
                    stickyTop={COMPACT_BAR_H}
                    dragging={activeId !== null}
                    highlightLibre={fillMode}
                    toolbar={
                      <div className="border-b border-line px-5 py-3">
                        <WeekNav
                          title="Tu semana"
                          range={formatWeekRange(weekStart)}
                          isCurrentWeek={isCurrentWeek}
                          onPrev={() => goToWeek(addDays(weekStart, -7))}
                          onNext={() => goToWeek(addDays(weekStart, 7))}
                          onToday={() => goToWeek(startOfWeek(new Date()))}
                    onSleep={() => setSleepDialog(true)}
                        />
                      </div>
                    }
                  />
                </section>
              )}
              </div>
              {SIMPLE_MODE && isWide && tasksOpen && (
                <aside aria-label="Objetivos del año" className="card sticky top-4 flex h-[calc(100dvh-120px)] w-80 shrink-0 flex-col overflow-hidden">
                  <TasksPanel className="h-full" />
                </aside>
              )}
              </div>
            </div>
          )}
        </main>
      </div>

      {view === "semana" && !SIMPLE_MODE && (
        <CompactBalance
          stats={stats}
          targets={targets}
          visible={balanceHidden}
          offsetLeft={hasRail ? 72 : 0}
        />
      )}

      {!hasRail && <BottomNav view={view} onChange={setView} />}

      {isMobile && view === "semana" && (
        <button
          type="button"
          aria-label="Nuevo bloque"
          onClick={createNow}
          className="pressable fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 grid size-14 place-items-center rounded-full bg-ink text-surface shadow-[var(--shadow-lifted)]"
        >
          <Plus aria-hidden className="size-6" />
        </button>
      )}

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {activeBlock && (
          <BlockFace
            block={dragStartPreview === null ? activeBlock : { ...activeBlock, start: dragStartPreview }}
            height={blockHeight(activeBlock.minutes)}
            lifted
          />
        )}
      </DragOverlay>

      {sheet && (
        <BlockSheet
          key={sheet.mode === "edit" ? sheet.id : `${sheet.date}-${sheet.start}`}
          state={sheet}
          days={days}
          isMobile={isMobile}
          onClose={() => setSheet(null)}
        />
      )}

      {checkInIds && (
        <CheckIn ids={checkInIds} todayKey={todayKey} isMobile={isMobile} onClose={() => setCheckInIds(null)} />
      )}

      {ritualWeek && !shownRecap && (
        <Ritual
          key={ritualWeek}
          week={ritualWeek}
          isMobile={isMobile}
          onClose={(result) => {
            logRitual(ritualWeek, result);
            if (result === "done") {
              setView("semana");
              goToWeek(fromKey(ritualWeek));
            }
            setRitualWeek(null);
          }}
        />
      )}

      {shownRecap && !checkInIds && (
        <Recap
          key={`${shownRecap.kind}:${shownRecap.start}`}
          period={shownRecap}
          isMobile={isMobile}
          onClose={manualRecap ? () => setManualRecap(null) : closeRecap}
          onOpenReports={openReports}
        />
      )}

      {editingTargets && <TargetsDialog isMobile={isMobile} onClose={() => setEditingTargets(false)} />}

      {showSetup && !sheet && (
        <WeekSetup
          isMobile={isMobile}
          onClose={closeSetup}
          onFill={(gap) => {
            closeSetup();
            goToWeek(startOfWeek(fromKey(gap.date)));
            setSelectedDay(gap.date);
            setSheet({ mode: "create", date: gap.date, start: gap.start, minutes: Math.min(60, gap.minutes) });
          }}
        />
      )}

      {sleepDay && <DaySleepSheet key={sleepDay} date={sleepDay} isMobile={isMobile} onClose={() => setSleepDay(null)} />}
      {sleepDialog && <SleepDialog isMobile={isMobile} onClose={() => setSleepDialog(false)} />}

      {askDelete && (
        <Sheet isMobile={isMobile} onClose={() => setAskDelete(null)} labelledBy="ask-delete-title" width="max-w-[380px]">
          <div className="flex flex-col gap-4 p-5">
            <div>
              <h2 id="ask-delete-title" className="type-headline">
                Borrar {askDelete.title}
              </h2>
              <p className="type-body mt-1 text-ink-muted">Este evento se repite. ¿Qué querés borrar?</p>
            </div>
            <div className="flex flex-col gap-2">
              <SecondaryButton
                onClick={() => {
                  removeBlock(askDelete.id, "this");
                  setUndo(askDelete);
                  setAskDelete(null);
                }}
              >
                Solo este evento
              </SecondaryButton>
              <button
                type="button"
                onClick={() => {
                  removeBlock(askDelete.id, "following");
                  setAskDelete(null);
                }}
                className="pressable h-11 rounded-md bg-danger px-4 font-medium text-white hover:bg-danger/90"
              >
                Este y todos los siguientes
              </button>
              <button
                type="button"
                onClick={() => setAskDelete(null)}
                className="pressable h-10 rounded-md px-4 font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {undo && (
        <div
          role="status"
          className="animate-fade-up fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-[13px] text-surface shadow-[var(--shadow-popover)] md:bottom-6"
        >
          <span className="max-w-[46vw] truncate">Borraste {undo.title}</span>
          <button
            type="button"
            onClick={() => {
              restoreBlock(undo);
              setUndo(null);
            }}
            className="pressable h-8 rounded-md bg-white/10 px-3 font-semibold hover:bg-white/20"
          >
            Deshacer
          </button>
        </div>
      )}

      {assistantOpen && (
        <AssistantPanel
          isMobile={isMobile}
          onClose={() => setAssistantOpen(false)}
          onApplied={(firstDay) => {
            // Mostramos la semana donde quedaron los cambios.
            setView("semana");
            if (!firstDay) return;
            goToWeek(startOfWeek(fromKey(firstDay)));
            setSelectedDay(firstDay);
          }}
        />
      )}
    </DndContext>
  );
}

function OverdueBanner({ count, onReview }: { count: number; onReview: () => void }) {
  return (
    <section
      aria-label="Bloques sin marcar"
      className="card animate-fade-up flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink">
        <ClipboardCheck aria-hidden className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-title">
          {count === 1 ? "Tenés 1 bloque sin marcar" : `Tenés ${count} bloques sin marcar`}
        </p>
        <p className="text-[13px] text-ink-muted">¿Los hiciste? Marcalos en segundos o pasalos a otro día.</p>
      </div>
      <SecondaryButton onClick={onReview} className="w-full sm:w-auto">
        Revisar
      </SecondaryButton>
    </section>
  );
}

function WeekNav({
  title,
  range,
  isCurrentWeek,
  onPrev,
  onNext,
  onToday,
  onSleep,
}: {
  title?: string;
  range: string;
  isCurrentWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSleep?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        {title && <h2 className="type-title">{title}</h2>}
        <span className={cn(title ? "text-[13px] text-ink-muted" : "type-title")}>{range}</span>
      </div>
      <div className="flex items-center gap-0.5">
        {onSleep && (
          <button
            type="button"
            onClick={onSleep}
            className="pressable mr-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Moon aria-hidden className="size-3.5" />
            Sueño
          </button>
        )}
        <IconButton label="Semana anterior" onClick={onPrev}>
          <ChevronLeft aria-hidden className="size-4" />
        </IconButton>
        <button
          type="button"
          disabled={isCurrentWeek}
          onClick={onToday}
          className="pressable h-8 rounded-md px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Hoy
        </button>
        <IconButton label="Semana siguiente" onClick={onNext}>
          <ChevronRight aria-hidden className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </button>
  );
}

function Rail({ view, onChange, userName }: { view: View; onChange: (v: View) => void; userName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[72px] flex-col items-center gap-6 bg-surface/75 py-5 backdrop-blur-xl shadow-[1px_0_0_var(--color-line)]">
      <BrandMark size={32} />
      <nav aria-label="Principal" className="flex flex-col gap-1.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              onClick={() => onChange(id)}
              className={cn(
                "pressable grid size-11 place-items-center rounded-lg",
                active ? "bg-surface-sunken text-ink" : "text-ink-faint hover:bg-surface-sunken/70 hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
          );
        })}
      </nav>
      {userName && (
        <span
          aria-hidden
          title={userName}
          className="mt-auto grid size-9 place-items-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-muted uppercase"
        >
          {userName.trim()[0]}
        </span>
      )}
    </aside>
  );
}

function BottomNav({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 flex bg-surface/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-line)]"
    >
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
            className={cn(
              "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150",
              active ? "text-ink" : "text-ink-faint",
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={active ? 2 : 1.75} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/** Modo completar: cuánto Libre queda en la semana contra tu objetivo de Libre. */
function FillBanner({ blocks, targets, onDone }: { blocks: Block[]; targets: QuadrantRecord<number>; onDone: () => void }) {
  const libre = blocks.filter((b) => b.quadrant === "libre").reduce((acc, b) => acc + b.minutes, 0);
  const awake = blocks.reduce((acc, b) => acc + b.minutes, 0);
  const goal = Math.round(((targets.libre / 100) * awake) / 30) * 30;
  const extra = Math.max(0, libre - goal);
  return (
    <section
      aria-label="Completá tus espacios libres"
      style={quadrantStyle("libre")}
      className="card animate-fade-up flex flex-wrap items-center gap-x-4 gap-y-3 border border-dashed border-[color-mix(in_oklab,var(--q)_55%,transparent)] px-5 py-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
        <QuadrantIcon id="libre" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-title">Completá tus espacios libres</p>
        <p className="text-[13px] text-ink-muted tabular-nums">
          Te quedan {formatMinutes(libre)} libres esta semana y tu objetivo de Libre es de {formatMinutes(goal)}
          {extra > 0 ? `: podés llenar ${formatMinutes(extra)}. Tocá o arrastrá sobre un espacio resaltado.` : ". Ya está bien repartida."}
        </p>
      </div>
      <SecondaryButton onClick={onDone} className="w-full sm:w-auto">
        Listo
      </SecondaryButton>
    </section>
  );
}

/** Modo simple: cuánto de tu tiempo despierto va a cada parte, en %, como proyección de la semana. */
function WeekShares({ plan }: { plan: QuadrantRecord<number> }) {
  const items: { id: "trabajo" | "cuerpo" | "mente" | "alma"; label: string; value: number }[] = [
    { id: "trabajo", label: "Trabajo", value: plan.trabajo },
    { id: "cuerpo", label: "Cuerpo", value: plan.cuerpo },
    { id: "mente", label: "Mente", value: plan.mente },
    { id: "alma", label: "Alma", value: plan.alma + plan.vinculos },
  ];
  return (
    <ul aria-label="Tu semana en porcentajes" className="hidden items-center gap-4 rounded-full bg-surface/80 px-4 py-2 shadow-[var(--shadow-card)] md:flex">
      {items.map((it) => (
        <li key={it.id} style={quadrantStyle(it.id)} className="flex items-center gap-1.5 text-[13px] tabular-nums">
          <span aria-hidden className="size-2 rounded-full bg-[var(--q)]" />
          <span className="text-ink-muted">{it.label}</span>
          <span className="font-semibold">{Math.round(it.value)}%</span>
        </li>
      ))}
    </ul>
  );
}
