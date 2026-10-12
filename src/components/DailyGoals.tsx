"use client";

import { Check, ChevronLeft, ChevronRight, Maximize2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BASE_GOALS, dayScore, monthDays, monthStats, rangeStats } from "@/lib/daily-goals";
import { useMediaQuery } from "@/lib/hooks";
import { Sheet } from "./ui";
import { fromKey, toKey, type DateKey } from "@/lib/dates";
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

  const cols = `46px repeat(${Math.max(goals.length, 1)}, minmax(24px, 1fr)) 32px`;

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
                <b className="font-semibold text-ink">{stats.pct}%</b> cumplido en {monthName.toLowerCase()}
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
            <Maximize2 aria-hidden className="size-3.5" />
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

            <div ref={listRef} role="grid" aria-label={`No negociables: ${label}`} className={cn("relative px-2 pb-2", fit && "flex min-h-0 flex-1 flex-col overflow-y-auto")}>
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
                const full = score === goals.length && score > 0;
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
                            onClick={() => {
                              if (!on) cheer(score + 1 === goals.length ? "allChecks" : "check");
                              toggle(date, g.id);
                            }}
                            className={cn(
                              "pressable grid place-items-center rounded-md border transition-colors duration-150",
                              fit ? "aspect-square h-[min(18px,calc(100%-2px))] rounded-[4px]" : "size-[22px]",
                              on ? "border-ink bg-ink text-surface" : fit ? "border-ink-faint/70 bg-surface hover:border-ink" : "border-line bg-surface hover:border-ink-faint",
                            )}
                          >
                            {on && <Check aria-hidden strokeWidth={3} className="size-3" />}
                          </button>
                        </span>
                      );
                    })}
                    <span role="gridcell" className={cn("pr-1 text-right text-[11.5px] font-semibold tabular-nums", future ? "text-ink-faint" : full ? "text-success" : score === 0 ? "text-ink-faint" : "text-ink")}>
                      {future ? "–" : `${score}/${goals.length}`}
                    </span>
                  </div>
                );
              })}
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
          }}
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
 * Cómo te fue mes a mes con tus no negociables: el % de cumplimiento de cada mes (y el de cada no negociable)
 * en un gráfico de líneas, y un resumen corto de cada mes (días perfectos, lo más constante, lo que costó).
 */
function GoalsHistory({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const checks = usePlanner((s) => s.dailyChecks);
  const startedAt = usePlanner((s) => s.startedAt);
  const today = toKey(new Date());
  // Desde el primer mes con tildes (o desde que empezaste) hasta este mes; como mucho 12.
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
  // Una línea por no negociable (los que existieron en alguno de estos meses).
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
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="goals-history-title" width="max-w-[860px]">
      <div className={cn("flex flex-col", isMobile ? "h-[88dvh]" : "h-[min(740px,90dvh)]")}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="goals-history-title" data-autofocus tabIndex={-1} className="type-title outline-none">
            Tus no negociables, mes a mes
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
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
                {/* Los días del mes, en una tira de color. */}
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
      </div>
    </Sheet>
  );
}
