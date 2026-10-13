"use client";

import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { ChartColumnBig } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BASE_GOALS, dayScore, monthDays, monthStats, rangeStats } from "@/lib/daily-goals";
import { useMediaQuery } from "@/lib/hooks";
import { Segmented, Sheet } from "./ui";
import { addDays, fromKey, startOfWeek, toKey, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { play } from "@/lib/sfx";
import { goalsFor, usePlanner, type DailyGoal } from "@/lib/store";
import { ModuleControls } from "./Modules";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

/**
 * Logros diarios: lo que querés hacer todos los días (la base son 5; con + se suman más). Una grilla con un día
 * por fila y un objetivo por columna (con su nombre arriba, en vertical); se tilda lo que cumpliste y a la
 * derecha queda el puntaje del día. Se ve siempre el mes entero.
 */
export function DailyGoals({ className, fit = false }: { className?: string; fit?: boolean }) {
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const checks = usePlanner((s) => s.dailyChecks);
  const toggle = usePlanner((s) => s.toggleDailyCheck);
  const startedAt = usePlanner((s) => s.startedAt);
  const today = toKey(new Date());
  const [anchor, setAnchor] = useState<DateKey>(today);
  const [editing, setEditing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const month = anchor.slice(0, 7);
  // Cada mes tiene su lista (se puede cambiar mes a mes; los anteriores quedan como estaban).
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, month);
  // Si todavía no hay ninguno, el editor queda abierto hasta tocar «Listo» (aunque ya hayas sumado el primero).
  const [firstTime, setFirstTime] = useState(goals.length === 0);
  useEffect(() => {
    if (goals.length === 0 && isCurrentMonth(month)) setFirstTime(true);
  }, [goals.length, month]);
  // La guía, al pasar al siguiente paso, cierra el editor (para tildar los de hoy en la grilla).
  useEffect(() => {
    const done = () => {
      setEditing(false);
      setFirstTime(false);
    };
    window.addEventListener("lb:noneg-done", done);
    return () => window.removeEventListener("lb:noneg-done", done);
  }, []);
  const days = monthDays(month);
  const stats = rangeStats(goals, checks, days, today, startedAt);
  // El % del mes: tildes hechas sobre todas las casillas del mes (no negociables × días), de 0 a 100.
  const boxes = goals.length * days.length;
  const ticked = days.reduce((acc, d) => acc + goals.filter((g) => (checks[d] ?? []).includes(g.id)).length, 0);
  const boxPct = boxes ? Math.round((ticked / boxes) * 100) : 0;
  const isCurrent = month === today.slice(0, 7);
  const shift = (by: number) => {
    const d = fromKey(anchor);
    const next = toKey(new Date(d.getFullYear(), d.getMonth() + by, 1));
    setAnchor(next > today ? today : next);
  };
  const monthName = MONTHS[Number(month.slice(5)) - 1];
  const label = isCurrent ? `${monthName} (este mes)` : `${monthName} ${month.slice(0, 4)}`;

  // Abre con hoy a la vista.
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>("[data-today]");
    if (list && row) list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
    else if (list) list.scrollTop = 0;
  }, [anchor, editing]);

  const cols = `44px repeat(${Math.max(goals.length, 1)}, minmax(40px, 56px)) 1fr 34px`;
  // Tildar arrastrando: apretás en un casillero y pasás por los otros (todos quedan como el primero).
  const dragMode = useRef<boolean | null>(null);
  useEffect(() => {
    const up = () => (dragMode.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  const setCheck = (date: DateKey, id: string, want: boolean) => {
    const on = (usePlanner.getState().dailyChecks[date] ?? []).includes(id);
    if (on === want) return;
    toggle(date, id);
    if (want) {
      const now = dayScore(goals, usePlanner.getState().dailyChecks, date);
      cheer(now === goals.length ? "allChecks" : "check");
    }
  };

  return (
    <section data-tour="objetivos" aria-labelledby="daily-title" className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <div className="min-w-0">
          <h2 id="daily-title" className="type-title">
            No negociables
          </h2>
          <p className="truncate text-[11.5px] text-ink-muted tabular-nums">
            {goals.length === 0 ? (
              "Lo que querés hacer todos los días"
            ) : stats.days === 0 ? (
              "Todavía no empezó"
            ) : (
              <>
                <b className="font-semibold text-ink">{boxPct}%</b> cumplido en {monthName.toLowerCase()}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {goals.length > 0 && !editing && isCurrent && (
            <button
              type="button"
              aria-label="Editar los no negociables de este mes"
              title="Cambiar los de este mes"
              onClick={() => setEditing(true)}
              className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Pencil aria-hidden className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Ver cómo te fue mes a mes"
            title="Cómo te fue mes a mes"
            onClick={() => {
              play("open");
              setHistory(true);
            }}
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <ChartColumnBig aria-hidden className="size-3.5" />
          </button>
          <ModuleControls />
        </div>
      </header>
      {history && <GoalsHistory isMobile={!desktop} onClose={() => setHistory(false)} />}

      <div className="flex min-h-0 flex-1 flex-col">
        {editing || (firstTime && isCurrent) || (goals.length === 0 && isCurrent) ? (
          <GoalEditor
            goals={goals}
            onDone={() => {
              setEditing(false);
              setFirstTime(false);
            }}
          />
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-center gap-2 px-2 pt-1.5">
              <div className="flex items-center">
                <button type="button" aria-label="Mes anterior" onClick={() => shift(-1)} className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
                  <ChevronLeft aria-hidden className="size-4" />
                </button>
                <span className="min-w-[120px] text-center text-[12px] font-semibold">{label}</span>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  disabled={isCurrent}
                  onClick={() => shift(1)}
                  className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </button>
              </div>
            </div>

            <div ref={listRef} role="grid" aria-label={`No negociables: ${label}`} className={cn("relative px-2", fit ? "flex min-h-0 flex-1 flex-col overflow-y-auto pb-0" : "pb-2")}>
              {/* El nombre de cada objetivo arriba de su columna, en vertical. */}
              <div role="row" className="sticky top-0 z-10 grid shrink-0 items-end bg-surface pt-1 pb-1.5 text-[10.5px] text-ink-muted" style={{ gridTemplateColumns: cols }}>
                <span role="columnheader" className="pl-1.5 font-semibold">
                  Día
                </span>
                {goals.map((g) => (
                  <span key={g.id} role="columnheader" title={g.name} lang="es" className="line-clamp-3 px-0.5 text-center text-[10px] leading-[1.15] font-medium break-words text-ink [hyphens:auto]">
                    {g.name}
                  </span>
                ))}
                <span aria-hidden />
                <span role="columnheader" className="pr-1 text-right font-semibold">
                  Pts
                </span>
              </div>
              {days.map((date) => {
                const before = !!startedAt && date < startedAt;
                const future = date > today;
                const isToday = date === today;
                const day = fromKey(date);
                const score = dayScore(goals, checks, date);
                const done = new Set(checks[date] ?? []);
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={date}
                    role="row"
                    data-today={isToday || undefined}
                    className={cn("grid items-center rounded-md", fit ? "max-h-7 min-h-[15px] flex-1 basis-0" : "h-7", isToday ? "bg-ink/[0.06]" : weekend && "bg-surface-sunken/50", (future || before) && "opacity-40")}
                    style={{ gridTemplateColumns: cols }}
                  >
                    <span role="rowheader" className={cn("pl-1.5 text-[11.5px] tabular-nums", isToday ? "font-semibold" : "text-ink-muted")}>
                      {WEEKDAYS[day.getDay()]} {day.getDate()}
                    </span>
                    {goals.map((g) => {
                      const on = done.has(g.id);
                      return (
                        <span key={g.id} role="gridcell" className={cn("grid place-items-center", fit && "h-full")}>
                          <button
                            type="button"
                            disabled={future}
                            aria-pressed={on}
                            aria-label={`${g.name}, ${WEEKDAYS[day.getDay()]} ${day.getDate()}: ${on ? "cumplido" : "sin cumplir"}`}
                            onPointerDown={(e) => {
                              if (future || e.button !== 0) return;
                              e.preventDefault();
                              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                              dragMode.current = !on;
                              setCheck(date, g.id, !on);
                            }}
                            onPointerEnter={() => {
                              if (dragMode.current !== null && !future) setCheck(date, g.id, dragMode.current);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setCheck(date, g.id, !on);
                              }
                            }}
                            className={cn(
                              "pressable mx-auto grid w-[30px] touch-none place-items-center rounded-md border transition-colors duration-150",
                              fit ? "h-[min(20px,calc(100%-2px))] rounded-[4px]" : "h-[24px]",
                              on ? "border-transparent text-white" : fit ? "border-ink-faint/70 bg-surface hover:border-ink" : "border-line bg-surface hover:border-ink-faint",
                            )}
                            style={on ? { background: scoreColor(score, goals.length) } : undefined}
                          >
                            {on && <Check aria-hidden strokeWidth={3} className="size-3" />}
                          </button>
                        </span>
                      );
                    })}
                    <span aria-hidden />
                    <span role="gridcell" className="flex justify-end pr-0.5">
                      {future ? (
                        <span className="text-[11.5px] text-ink-faint">–</span>
                      ) : (
                        <span className="rounded-full px-1.5 text-[11px] font-bold text-white tabular-nums" style={{ background: scoreColor(score, goals.length) }}>
                          {score}/{goals.length}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
              {/* Totales por no negociable (cuántos días del mes) y el total del mes. */}
              <div role="row" className="sticky bottom-0 z-10 mt-1 grid shrink-0 items-center border-t border-line bg-surface pt-1.5 pb-2 text-[11px] font-semibold tabular-nums" style={{ gridTemplateColumns: cols }}>
                <span role="rowheader" className="pl-1.5 text-ink-muted">
                  Total
                </span>
                {stats.perGoal.map((pg) => (
                  <span key={pg.goal.id} role="gridcell" title={`${pg.goal.name}: ${pg.done} de ${stats.days} días`} className="text-center">
                    {pg.done}
                  </span>
                ))}
                <span aria-hidden />
                <span role="gridcell" title={`${ticked} de ${boxes} casillas`} className="pr-1 text-right">
                  {boxPct}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Elegir los objetivos: 5 lugares de base (y + para sumar más). Se guardan al salir de cada campo o con Enter;
 * el tacho saca un objetivo y sus tildes.
 */
function GoalEditor({ goals, onDone }: { goals: DailyGoal[]; onDone: () => void }) {
  const add = usePlanner((s) => s.addDailyGoal);
  const rename = usePlanner((s) => s.renameDailyGoal);
  const remove = usePlanner((s) => s.removeDailyGoal);
  const [extra, setExtra] = useState(0);
  const slots = Math.max(BASE_GOALS, goals.length) + extra;
  const firstEmpty = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (extra > 0) firstEmpty.current?.focus();
  }, [extra]);

  const commit = (i: number, value: string) => {
    const name = value.trim();
    const goal = goals[i];
    if (goal) {
      if (name && name !== goal.name) rename(goal.id, name);
    } else if (name) {
      add(name);
      if (extra > 0) setExtra((n) => Math.max(0, n - 1));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
      <p className="mb-2.5 text-[12px] leading-snug text-ink-muted">
        {goals.length === 0
          ? "Tus no negociables: lo que querés cumplir todos los días, sí o sí. Te recomendamos no más de 5. Por ejemplo: dejar la cocina limpia antes de dormir, menos de 1 hora de redes. No te cambian la vida en un día, pero el hábito hace al maestro."
          : "Los no negociables de este mes. Podés cambiarlos cada mes: los meses anteriores quedan como estaban."}
      </p>
      <ol className="flex flex-col gap-1.5">
        {Array.from({ length: slots }, (_, i) => {
          const goal = goals[i];
          const isFirstEmpty = !goal && i === goals.length;
          return (
            <li key={goal?.id ?? `slot-${i}`} className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-sunken text-[11px] font-semibold tabular-nums">{i + 1}</span>
              <input
                ref={isFirstEmpty ? firstEmpty : undefined}
                defaultValue={goal?.name ?? ""}
                placeholder={goal ? "" : ["Dejar la cocina limpia", "Menos de 1 h de redes", "Tomar 2 litros de agua", "Leer 10 minutos", "Estirar al levantarme"][i] ?? `No negociable ${i + 1}…`}
                aria-label={`No negociable ${i + 1}`}
                enterKeyHint="next"
                autoComplete="off"
                onBlur={(e) => commit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  // Al salir del campo se guarda (onBlur): acá solo se pasa al siguiente.
                  const next = e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input");
                  if (next) next.focus();
                  else e.currentTarget.blur();
                }}
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-[13px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
              />
              {goal ? (
                <button
                  type="button"
                  aria-label={`Sacar ${goal.name}`}
                  title="Sacar (se borran sus tildes)"
                  onClick={() => {
                    play("delete");
                    remove(goal.id);
                  }}
                  className="pressable grid size-8 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              ) : (
                <span aria-hidden className="size-8 shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExtra((n) => n + 1)} className="pressable inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
          <Plus aria-hidden className="size-3.5" />
          Sumar otro
        </button>
        <button
          type="button"
          onClick={() => {
            (document.activeElement as HTMLElement | null)?.blur();
            onDone();
            window.setTimeout(() => window.dispatchEvent(new Event("lb:noneg-listo")), 50);
          }}
          data-tour="noneg-listo"
          className="pressable h-8 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-surface hover:bg-ink/90"
        >
          Listo
        </button>
      </div>
    </div>
  );
}


const isCurrentMonth = (m: string) => m === toKey(new Date()).slice(0, 7);

const LINE_COLORS = ["#2f9e64", "#2b8fd6", "#8a5cf0", "#d99a00", "#e0457b", "#0f9fa8", "#7a8794"];

/**
 * Tus no negociables, en grande: arriba, cómo venís (cumplimiento del mes, racha, mejor racha, días perfectos,
 * lo más constante y lo que más cuesta); abajo, el mes o la semana para tildar ahí mismo, o el año en un
 * gráfico. Con «Editar», cambiás los de este mes.
 */
function GoalsHistory({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const [view, setView] = useState<"mes" | "semana" | "anio">("mes");
  const [editing, setEditing] = useState(false);
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const checks = usePlanner((s) => s.dailyChecks);
  const startedAt = usePlanner((s) => s.startedAt);
  const toggle = usePlanner((s) => s.toggleDailyCheck);
  const today = toKey(new Date());
  const month = today.slice(0, 7);
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, month);
  const days = monthDays(month);
  const st = monthStats(goals, checks, month, today, startedAt);
  const ticked = days.reduce((acc, d) => acc + goals.filter((g) => (checks[d] ?? []).includes(g.id)).length, 0);
  const boxes = goals.length * days.length;
  const full = (d: DateKey) => goals.length > 0 && goals.every((g) => (checks[d] ?? []).includes(g.id));
  // Racha: días seguidos con todo cumplido (si hoy todavía no está completo, cuenta hasta ayer).
  let streak = 0;
  for (let d = full(today) ? new Date() : addDays(new Date(), -1); streak < 400 && full(toKey(d)); d = addDays(d, -1)) streak++;
  // Mejor racha de los últimos 365 días.
  let best = 0;
  let run = 0;
  for (let k = 365; k >= 0; k--) {
    const d = toKey(addDays(new Date(), -k));
    const gs = goalsFor({ dailyGoals: allGoals, goalMonths }, d.slice(0, 7));
    run = gs.length && gs.every((g) => (checks[d] ?? []).includes(g.id)) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const perfect = st.perDay.filter((d) => d.score !== null && goals.length > 0 && d.score === goals.length).length;
  const sorted = [...st.perGoal].sort((a, b) => b.pct - a.pct);
  const kpis = [
    { k: "Cumplimiento del mes", v: boxes ? `${Math.round((ticked / boxes) * 100)}%` : "–", d: `${ticked} de ${boxes} casillas` },
    { k: "Racha actual", v: `${streak} ${streak === 1 ? "día" : "días"}`, d: "seguidos con todo cumplido" },
    { k: "Mejor racha", v: `${best} ${best === 1 ? "día" : "días"}`, d: "en el último año" },
    { k: "Días perfectos", v: String(perfect), d: "este mes" },
    { k: "Lo más constante", v: sorted[0] && st.days ? `${sorted[0].pct}%` : "–", d: sorted[0]?.goal.name ?? "" },
    { k: "Lo que más cuesta", v: sorted.length > 1 && st.days ? `${sorted[sorted.length - 1].pct}%` : "–", d: sorted.length > 1 ? sorted[sorted.length - 1].goal.name : "" },
  ];

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="goals-history-title" width="max-w-[1000px]">
      <div className={cn("flex flex-col", isMobile ? "h-[90dvh]" : "h-[min(800px,90dvh)]")}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="goals-history-title" data-autofocus tabIndex={-1} className="type-title outline-none">
            Tus no negociables
          </h2>
          <div className="flex items-center gap-2">
            <Segmented
              label="Vista"
              value={view}
              onChange={setView}
              options={[
                { id: "mes", label: "Este mes" },
                { id: "semana", label: "Esta semana" },
                { id: "anio", label: "El año" },
              ]}
              className="text-[12.5px]"
            />
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              aria-pressed={editing}
              className={cn("pressable inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold", editing ? "bg-ink text-surface" : "ring-1 ring-line hover:bg-surface-sunken")}
            >
              <Pencil aria-hidden className="size-3.5" />
              Editar
            </button>
            <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {editing ? (
            <div className="mx-auto max-w-[520px]">
              <GoalEditor goals={goals} onDone={() => setEditing(false)} />
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {kpis.map((x) => (
                  <li key={x.k} className="flex flex-col gap-0.5 rounded-xl bg-surface-sunken/70 px-3 py-2.5">
                    <span className="text-[11px] text-ink-muted">{x.k}</span>
                    <span className="text-[20px] leading-tight font-semibold tabular-nums">{x.v}</span>
                    <span className="truncate text-[11px] text-ink-faint">{x.d}</span>
                  </li>
                ))}
              </ul>
              {!goals.length ? (
                <p className="mt-6 text-[13px] text-ink-muted">Todavía no elegiste tus no negociables. Tocá «Editar» para sumarlos.</p>
              ) : view === "mes" ? (
                <MonthBig goals={goals} days={days} today={today} checks={checks} toggle={toggle} />
              ) : view === "semana" ? (
                <div className="mt-5">
                  <WeekView />
                </div>
              ) : (
                <YearView />
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** El mes en grande, para tildar: una fila por día, con el puntaje en color. */
function MonthBig({ goals, days, today, checks, toggle }: { goals: DailyGoal[]; days: DateKey[]; today: DateKey; checks: Record<DateKey, string[]>; toggle: (date: DateKey, id: string) => void }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
        <thead>
          <tr className="text-[11px] text-ink-muted">
            <th className="py-1.5 pr-2 text-left font-semibold">Día</th>
            {goals.map((g) => (
              <th key={g.id} className="px-1 py-1.5 text-center font-semibold">
                {g.name}
              </th>
            ))}
            <th className="py-1.5 pl-2 text-right font-semibold">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const day = fromKey(d);
            const future = d > today;
            const score = dayScore(goals, checks, d);
            return (
              <tr key={d} className={cn("border-t border-line/70", d === today && "bg-surface-sunken")}>
                <td className={cn("py-1 pr-2 whitespace-nowrap tabular-nums", d === today ? "font-semibold" : "text-ink-muted")}>
                  {WEEKDAYS[day.getDay()]} {day.getDate()}
                </td>
                {goals.map((g) => {
                  const on = (checks[d] ?? []).includes(g.id);
                  return (
                    <td key={g.id} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        disabled={future}
                        aria-pressed={on}
                        aria-label={`${g.name}, ${WEEKDAYS[day.getDay()]} ${day.getDate()}: ${on ? "cumplido" : "sin cumplir"}`}
                        onClick={() => {
                          toggle(d, g.id);
                          if (!on) play("pop");
                        }}
                        className={cn(
                          "pressable mx-auto grid h-6 w-10 place-items-center rounded-md border transition-colors",
                          on ? "border-success bg-success text-white" : future ? "border-line/40" : "border-ink-faint/70 hover:border-ink",
                        )}
                      >
                        {on && <Check aria-hidden strokeWidth={3} className="size-3.5" />}
                      </button>
                    </td>
                  );
                })}
                <td className="py-1 pl-2 text-right">
                  {!future && (
                    <span className="inline-block min-w-9 rounded-full px-1.5 text-center text-[11px] font-semibold text-white tabular-nums" style={{ background: scoreColor(score, goals.length) }}>
                      {score}/{goals.length}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** El año: el % de cada mes (línea gruesa) y de cada no negociable (finas), y un resumen por mes. */
function YearView() {
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const checks = usePlanner((s) => s.dailyChecks);
  const startedAt = usePlanner((s) => s.startedAt);
  const today = toKey(new Date());
  const first = [startedAt, ...Object.keys(checks)].filter(Boolean).sort()[0]?.slice(0, 7) ?? today.slice(0, 7);
  const months: string[] = [];
  for (let m = first; m <= today.slice(0, 7); ) {
    months.push(m);
    const [y, mm] = m.split("-").map(Number);
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
  }
  const shown = months.slice(-12);
  const rows = shown.map((m) => {
    const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, m);
    const st = monthStats(goals, checks, m, today, startedAt);
    const perfect = st.perDay.filter((d) => d.score !== null && goals.length > 0 && d.score === goals.length).length;
    const sorted = [...st.perGoal].sort((a, b) => b.pct - a.pct);
    return { m, goals, st, perfect, best: sorted[0], worst: sorted[sorted.length - 1] };
  });
  const ids = [...new Set(rows.flatMap((r) => r.goals.map((g) => g.id)))];
  const W = 600;
  const H = 200;
  const PAD = { l: 34, r: 12, t: 12, b: 26 };
  const x = (i: number) => PAD.l + (shown.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (shown.length - 1));
  const y = (pct: number) => PAD.t + ((100 - pct) * (H - PAD.t - PAD.b)) / 100;
  const path = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
      .reduce<string[]>((acc, pt) => {
        if (pt) acc.push(`${acc.length === 0 ? "M" : "L"}${pt}`);
        return acc;
      }, [])
      .join(" ");
  const overall = rows.map((r) => (r.st.days ? r.st.pct : null));
  const name = (m: string) => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][Number(m.slice(5)) - 1];
  return (
    <div className="mt-5">
      <p className="text-[13px] text-ink-muted">Cuánto cumpliste cada mes (la línea gruesa) y cada no negociable (las finas).</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Cumplimiento por mes">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">
              {v}%
            </text>
          </g>
        ))}
        {shown.map((m, i) => (
          <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-muted)">
            {name(m)}
          </text>
        ))}
        {ids.map((id, k) => {
          const vals = rows.map((r) => {
            const g = r.st.perGoal.find((p) => p.goal.id === id);
            return g && r.st.days ? g.pct : null;
          });
          return <path key={id} d={path(vals)} fill="none" stroke={LINE_COLORS[k % LINE_COLORS.length]} strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />;
        })}
        <path d={path(overall)} fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {overall.map((v, i) => v !== null && <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="2" />)}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <li className="flex items-center gap-1.5 text-[12px] font-semibold">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-ink" />
          Total
        </li>
        {ids.map((id, k) => (
          <li key={id} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span aria-hidden className="h-[2px] w-4 rounded-full" style={{ background: LINE_COLORS[k % LINE_COLORS.length] }} />
            {allGoals.find((g) => g.id === id)?.name}
          </li>
        ))}
      </ul>
      <ol className="mt-6 grid gap-2 sm:grid-cols-2">
        {[...rows].reverse().map((r) => (
          <li key={r.m} className="flex flex-col gap-1.5 rounded-2xl bg-surface-sunken/70 px-4 py-3">
            <p className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">
                {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][Number(r.m.slice(5)) - 1]} {r.m.slice(0, 4)}
              </span>
              <span className="text-[20px] font-semibold tabular-nums">{r.st.days ? `${r.st.pct}%` : "–"}</span>
            </p>
            <span className="flex h-2.5 gap-[2px]" aria-hidden>
              {r.st.perDay.map((d) => (
                <span
                  key={d.date}
                  className="flex-1 rounded-[2px]"
                  style={{ background: d.score === null || !r.goals.length ? "var(--color-surface)" : `color-mix(in oklab, var(--color-success) ${Math.round(12 + (d.score / r.goals.length) * 80)}%, var(--color-surface))` }}
                />
              ))}
            </span>
            <p className="text-[12px] leading-snug text-ink-muted">
              {r.st.days === 0
                ? "Sin días para contar."
                : [
                    r.perfect ? `${r.perfect} ${r.perfect === 1 ? "día perfecto" : "días perfectos"}` : "",
                    r.best && r.best.done ? `lo más constante: ${r.best.goal.name} (${r.best.pct}%)` : "",
                    r.worst && r.worst !== r.best && r.worst.pct < 50 ? `lo que más costó: ${r.worst.goal.name} (${r.worst.pct}%)` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Seguí sumando días."}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Esta semana, día por día: el puntaje de cada día y qué no negociable cumpliste. */
function WeekView() {
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const checks = usePlanner((s) => s.dailyChecks);
  const toggle = usePlanner((s) => s.toggleDailyCheck);
  const today = toKey(new Date());
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, today.slice(0, 7));
  const monday = toKey(startOfWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(monday), i)));
  const st = rangeStats(goals, checks, days, today);
  if (!goals.length) return <p className="text-[13px] text-ink-muted">Todavía no elegiste tus no negociables.</p>;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-ink-muted">
        Esta semana cumpliste el <b className="font-semibold text-ink">{st.pct}%</b> ({st.done} de {st.possible} tildes).
      </p>
      {/* El puntaje de cada día. */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const score = dayScore(goals, checks, d);
          const future = d > today;
          const day = fromKey(d);
          return (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-surface-sunken">
                {!future && score > 0 && <span className={cn("w-full rounded-lg", score === goals.length ? "bg-success" : "bg-ink/70")} style={{ height: `${(score / goals.length) * 100}%` }} />}
              </span>
              <span className={cn("text-[12px] tabular-nums", d === today ? "font-semibold" : "text-ink-muted")}>
                {WEEKDAYS[day.getDay()]} {day.getDate()}
              </span>
              <span className="text-[11.5px] font-semibold tabular-nums">{future ? "–" : `${score}/${goals.length}`}</span>
            </div>
          );
        })}
      </div>
      {/* Cada no negociable, día por día. */}
      <table className="w-full border-collapse text-[12.5px]">
        <tbody>
          {goals.map((g) => (
            <tr key={g.id} className="border-t border-line">
              <td className="py-2 pr-3">{g.name}</td>
              {days.map((d) => {
                const on = (checks[d] ?? []).includes(g.id);
                return (
                  <td key={d} className="w-9 py-2 text-center">
                    <button type="button" disabled={d > today} aria-pressed={on} aria-label={`${g.name}: ${on ? "cumplido" : "sin cumplir"}`} onClick={() => toggle(d, g.id)} className={cn("pressable mx-auto grid size-6 place-items-center rounded-md border", on ? "border-success bg-success text-white" : d > today ? "border-line/50" : "border-ink-faint/70 hover:border-ink")}>{on && <Check aria-hidden strokeWidth={3} className="size-3" />}</button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * El color del puntaje del día, como un semáforo: nada en rojo, y va pasando por azul y amarillo hasta el
 * verde cuando cumpliste todo.
 */
export function scoreColor(score: number, total: number) {
  if (!total || score <= 0) return "#e5484d";
  if (score >= total) return "#2f9e64";
  const steps = ["#3b82f6", "#e3a008", "#f97316", "#8b5cf6"];
  // Con pocos no negociables, los pasos intermedios son azul y amarillo.
  const i = Math.min(steps.length - 1, Math.floor(((score - 1) / Math.max(1, total - 1)) * Math.min(steps.length, total - 1)));
  return steps[i];
}
