"use client";

import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState, type DragEvent } from "react";
import { guessQuadrant } from "@/lib/categorize";
import { fromKey, toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { goalAge, goalTip } from "@/lib/goal-tips";
import { useMediaQuery } from "@/lib/hooks";
import { cheer } from "@/lib/motivation";
import { taskStats } from "@/lib/recap";
import { play } from "@/lib/sfx";
import { usePlanner, type TaskKind, type YearTask } from "@/lib/store";
import { ModuleControls } from "./Modules";
import { isLate, kindColor, TASK_KINDS } from "./TasksPanel";
import { Segmented, Sheet } from "./ui";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const dayMonth = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const monthShort = (m: string) => MONTHS[Number(m.slice(5)) - 1].slice(0, 3);
const nextMonth = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return mm === 12 ? `${y + 1}-01` : `${y}-${pad(mm + 1)}`;
};
const kindFor = (text: string): TaskKind => {
  const q = guessQuadrant(text);
  return q && q !== "libre" ? q : "otro";
};

/**
 * Metas importantes: los meses que quedan del año, cada uno con sus metas adentro (chiquitas) y un + para
 * sumar otra. Las que no se cumplieron se pasan de mes arrastrándolas o con la flecha (queda registrado
 * cuántas veces se postergó). Los meses que ya pasaron quedan comprimidos. Con el botón de expandir, el
 * reporte de todas las metas: cuándo se crearon, cuánto llevan, cuántas veces se postergaron.
 */
export function YearGoals({ className }: { className?: string }) {
  const tasks = usePlanner((s) => s.tasks);
  const moveTask = usePlanner((s) => s.moveTask);
  const today = toKey(new Date());
  const thisMonth = today.slice(0, 7);
  const current = Number(today.slice(0, 4));
  const [year, setYear] = useState(current);
  const [report, setReport] = useState(false);
  const [past, setPast] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const yearTasks = tasks.filter((t) => t.month.startsWith(`${year}-`));
  const done = yearTasks.filter((t) => t.done).length;

  const months = MONTHS.map((name, i) => {
    const month = `${year}-${pad(i + 1)}`;
    const list = yearTasks.filter((t) => t.month === month);
    return { name, month, list, ok: list.filter((t) => t.done).length, late: list.filter((t) => isLate(t, today)).length, isNow: month === thisMonth, gone: month < thisMonth };
  });
  /** Soltar una meta en otro mes: si es más adelante, cuenta como postergada. */
  const drop = (e: DragEvent, month: string) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/task");
    const t = tasks.find((x) => x.id === id);
    if (!t || t.month === month) return;
    moveTask(id, month);
    if (month > t.month && !t.done) cheer("goalPostponed");
    else play("bubble");
  };
  const dropProps = (month: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("text/task")) return;
      e.preventDefault();
      if (over !== month) setOver(month);
    },
    onDragLeave: () => setOver((o) => (o === month ? null : o)),
    onDrop: (e: DragEvent) => drop(e, month),
  });

  return (
    <section aria-labelledby="year-goals-title" className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <div className="min-w-0">
          <h2 id="year-goals-title" className="type-title truncate">
            Metas anuales importantes
          </h2>
          <p className="truncate text-[11.5px] text-ink-muted tabular-nums">{yearTasks.length ? `${done} de ${yearTasks.length} cumplidas en ${year}` : "2 o 3 por mes: las que te cambian"}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" aria-label="Año anterior" onClick={() => setYear(year - 1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="w-10 text-center text-[12.5px] font-semibold tabular-nums">{year}</span>
          <button type="button" aria-label="Año siguiente" onClick={() => setYear(year + 1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronRight aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Ampliar metas"
            title="Ver en grande: todo el año, para editar, y las estadísticas"
            onClick={() => {
              play("open");
              setReport(true);
            }}
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <CalendarDays aria-hidden className="size-4" />
          </button>
          <ModuleControls />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        {/* Los meses que ya pasaron: comprimidos y atenuados (tocando uno, se ven sus metas). */}
        {months.some((m) => m.gone) && (
          <ol aria-label="Meses que ya pasaron" className="flex flex-wrap gap-1">
            {months
              .filter((m) => m.gone)
              .map((m) => (
                <li key={m.month} {...dropProps(m.month)}>
                  <button
                    type="button"
                    aria-expanded={past === m.month}
                    onClick={() => setPast(past === m.month ? null : m.month)}
                    className={cn(
                      "pressable inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11.5px] font-medium tabular-nums transition-opacity",
                      past === m.month ? "border-ink opacity-100" : "border-line opacity-60 hover:opacity-100",
                    )}
                  >
                    {m.name.slice(0, 3)}
                    {m.list.length > 0 && (
                      <span className={cn("font-semibold", m.late ? "text-danger" : m.ok === m.list.length ? "text-success" : "text-ink-muted")}>
                        {m.ok}/{m.list.length}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ol>
        )}
        {past && (
          <MonthBlock
            month={past}
            name={MONTHS[Number(past.slice(5)) - 1]}
            list={tasks.filter((t) => t.month === past)}
            today={today}
            muted
            over={over === past}
            dropProps={dropProps(past)}
          />
        )}
        {/* Todos los meses que quedan entran en el panel, sin scroll (cada mes scrollea sus metas si hace falta). */}
        <ol aria-label="Meses que quedan" className={cn("grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] gap-1.5", months.filter((m) => !m.gone).length > 6 ? "grid-cols-4" : months.filter((m) => !m.gone).length > 2 ? "grid-cols-3" : "grid-cols-2")}>
          {months
            .filter((m) => !m.gone)
            .map((m) => (
              <li key={m.month} className="min-h-0">
                <MonthBlock month={m.month} name={m.name} list={m.list} today={today} isNow={m.isNow} over={over === m.month} dropProps={dropProps(m.month)} />
              </li>
            ))}
        </ol>
      </div>

      {report && <GoalsReport year={year} setYear={setYear} isMobile={!desktop} onClose={() => setReport(false)} />}
    </section>
  );
}

/** Un mes: sus metas (chiquitas, para tildar, pasar al mes que viene o borrar) y el + para sumar otra. */
function MonthBlock({
  month,
  name,
  list,
  today,
  isNow,
  muted,
  over,
  dropProps,
}: {
  month: string;
  name: string;
  list: YearTask[];
  today: string;
  isNow?: boolean;
  muted?: boolean;
  over: boolean;
  dropProps: object;
}) {
  const addTask = usePlanner((s) => s.addTask);
  const toggleTask = usePlanner((s) => s.toggleTask);
  const removeTask = usePlanner((s) => s.removeTask);
  const moveTask = usePlanner((s) => s.moveTask);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const ok = list.filter((t) => t.done).length;
  const tip = title.trim() ? goalTip(title) : null;

  const add = () => {
    if (!title.trim()) return;
    addTask({ title: title.trim(), month, kind: kindFor(title) });
    cheer("goalAdded");
    setTitle("");
  };

  return (
    <div
      {...dropProps}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border px-2 py-1.5 transition-colors duration-150",
        over ? "border-ink bg-surface-sunken" : isNow ? "border-ink/35 bg-surface-sunken/40" : "border-line",
        muted && "opacity-80",
      )}
    >
      <p className="flex items-baseline justify-between gap-1 px-0.5">
        <span className="text-[12.5px] font-semibold">
          {name.slice(0, 3)}
          {isNow && <span className="ml-1 text-[10.5px] font-medium text-ink-muted">· este mes</span>}
        </span>
        {list.length > 0 && <span className={cn("text-[11px] font-semibold tabular-nums", ok === list.length ? "text-success" : "text-ink-muted")}>{ok}/{list.length}</span>}
      </p>
      <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {list.map((t) => {
          const late = isLate(t, today);
          const { moved, stuck } = goalAge(t, today);
          return (
            <li
              key={t.id}
              draggable={!t.done}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/task", t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className={cn("group/t relative flex items-start gap-1 rounded-md py-0.5 pr-0.5 pl-0.5 hover:bg-surface-sunken/80", !t.done && "cursor-grab active:cursor-grabbing")}
            >
              <button
                type="button"
                aria-pressed={t.done}
                aria-label={`${t.title}: ${t.done ? "cumplida" : "pendiente"}`}
                onClick={() => {
                  if (!t.done) cheer("goalDone");
                  toggleTask(t.id);
                }}
                className={cn("mt-[2px] grid size-3.5 shrink-0 place-items-center rounded-[4px] border", t.done ? "border-success bg-success text-white" : late ? "border-danger" : "border-ink-faint")}
              >
                {t.done && <Check aria-hidden strokeWidth={3.5} className="size-2.5" />}
              </button>
              <span aria-hidden className="mt-[6px] size-1.5 shrink-0 rounded-full" style={{ background: kindColor(t.kind) }} />
              <span title={t.title} className={cn("min-w-0 flex-1 text-[11.5px] leading-snug [overflow-wrap:anywhere]", t.done && "text-ink-muted line-through", late && "text-danger")}>
                {t.title}
              </span>
              {moved > 0 && (
                <span title={`Postergada ${moved} ${moved === 1 ? "vez" : "veces"}`} className={cn("shrink-0 rounded-full px-1 text-[9.5px] font-semibold tabular-nums", stuck ? "bg-[color-mix(in_oklab,#d99a00_18%,transparent)] text-[#8a6200]" : "bg-surface-sunken text-ink-muted")}>
                  ×{moved}
                </span>
              )}
              <span className="absolute top-0.5 right-0.5 hidden items-center rounded-md bg-surface shadow-sm group-hover/t:flex group-focus-within/t:flex [@media(hover:none)]:static [@media(hover:none)]:flex [@media(hover:none)]:bg-transparent [@media(hover:none)]:shadow-none">
              {!t.done && (
                <button
                  type="button"
                  aria-label={`Pasar ${t.title} al mes que viene`}
                  title="Pasar al mes que viene"
                  onClick={() => {
                    moveTask(t.id, nextMonth(t.month));
                    cheer("goalPostponed");
                  }}
                  className="grid size-5 shrink-0 place-items-center rounded text-ink-faint hover:text-ink"
                >
                  <ArrowRight aria-hidden className="size-3" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Borrar ${t.title}`}
                onClick={() => {
                  play("delete");
                  removeTask(t.id);
                }}
                className="grid size-5 shrink-0 place-items-center rounded text-ink-faint hover:text-danger"
              >
                <Trash2 aria-hidden className="size-3" />
              </button>
              </span>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="mt-1 flex flex-col gap-1"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && setAdding(false)}
            onKeyDown={(e) => e.key === "Escape" && (setTitle(""), setAdding(false))}
            placeholder="Nueva meta…"
            aria-label={`Nueva meta para ${name}`}
            enterKeyHint="done"
            className="h-7 w-full rounded-md border border-line bg-surface px-2 text-[12px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
          {tip && <p className="rounded-md bg-[color-mix(in_oklab,#d99a00_12%,transparent)] px-1.5 py-1 text-[10.5px] leading-snug text-[#8a6200]">{tip}</p>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={`Sumar una meta a ${name}`}
          className="pressable mt-1 inline-flex h-6 items-center gap-1 self-start rounded-md px-1 text-[11.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <Plus aria-hidden className="size-3.5" />
          Sumar
        </button>
      )}
    </div>
  );
}

/**
 * El reporte de metas (expandido): cuántas te propusiste, cumpliste, no cumpliste y postergaste en el año, y
 * cada meta con su historia: cuándo se creó, por qué meses pasó, cuántos días lleva y cuándo se cumplió.
 */
function GoalsReport({ year, setYear, isMobile, onClose }: { year: number; setYear: (y: number) => void; isMobile: boolean; onClose: () => void }) {
  const tasks = usePlanner((s) => s.tasks);
  const moveTask = usePlanner((s) => s.moveTask);
  const today = toKey(new Date());
  const thisMonth = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  const st = taskStats(tasks, months, thisMonth);
  const list = [...st.proposed].sort((a, b) => a.month.localeCompare(b.month));
  const movedCount = list.filter((t) => (t.history?.length ?? 0) > 0).length;
  // Todo el año, editable: arrastrar una meta a otro mes la posterga (o la adelanta).
  const [over, setOver] = useState<string | null>(null);
  const [view, setView] = useState<"anio" | "metas">("anio");
  const dropProps = (month: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("text/task")) return;
      e.preventDefault();
      if (over !== month) setOver(month);
    },
    onDragLeave: () => setOver((o) => (o === month ? null : o)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const t = tasks.find((x) => x.id === e.dataTransfer.getData("text/task"));
      if (!t || t.month === month) return;
      moveTask(t.id, month);
      if (month > t.month && !t.done) cheer("goalPostponed");
      else play("bubble");
    },
  });
  // Estadísticas.
  const monthsBetween = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
  const delay = (t: YearTask) => monthsBetween(t.history?.[0] ?? t.month, t.done ? (t.doneAt ?? today).slice(0, 7) : t.month);
  const postponements = list.reduce((acc, t) => acc + (t.history?.length ?? 0), 0);
  const closed = st.done.length + st.notDone.length;
  const mostMoved = [...list].sort((a, b) => (b.history?.length ?? 0) - (a.history?.length ?? 0))[0];
  const oldestOpen = list.filter((t) => !t.done && t.createdAt).sort((a, b) => a.createdAt!.localeCompare(b.createdAt!))[0];
  const toDone = st.done.filter((t) => t.createdAt && t.doneAt).map((t) => goalAge(t, t.doneAt!).days ?? 0);
  const avgToDone = toDone.length ? Math.round(toDone.reduce((a, b) => a + b, 0) / toDone.length) : null;
  const bestMonth = months.map((m) => ({ m, n: list.filter((t) => t.done && t.month === m).length })).sort((a, b) => b.n - a.n)[0];
  const byKind = TASK_KINDS.map((k) => ({ k, all: list.filter((t) => (t.kind ?? "otro") === k.id), ok: list.filter((t) => (t.kind ?? "otro") === k.id && t.done).length })).filter((x) => x.all.length);
  const stats = [
    { k: "Propuestas", v: st.proposed.length, c: "var(--color-ink)" },
    { k: "Cumplidas", v: st.done.length, c: "var(--color-success)" },
    { k: "No cumplidas", v: st.notDone.length, c: "var(--color-danger)" },
    { k: "Postergadas", v: movedCount, c: "#d99a00" },
    { k: "En camino", v: st.pending.length, c: "var(--color-ink-faint)" },
  ];
  const facts = [
    { k: "Cumplimiento", v: closed ? `${Math.round((st.done.length / closed) * 100)}%` : "–", d: "de las que ya cerraron su mes" },
    { k: "Postergaciones", v: String(postponements), d: list.length ? `${(Math.round((postponements / list.length) * 10) / 10).toLocaleString("es-AR")} por meta en promedio` : "" },
    { k: "Meses de atraso", v: String(list.reduce((acc, t) => acc + Math.max(0, delay(t)), 0)), d: "sumando todas las metas" },
    { k: "Tiempo para cumplir", v: avgToDone !== null ? `${avgToDone} días` : "–", d: "en promedio, desde que la creaste" },
    { k: "La más postergada", v: mostMoved && mostMoved.history?.length ? `×${mostMoved.history.length}` : "–", d: mostMoved && mostMoved.history?.length ? mostMoved.title : "ninguna todavía" },
    { k: "La más antigua sin cumplir", v: oldestOpen ? `${goalAge(oldestOpen, today).days} días` : "–", d: oldestOpen ? oldestOpen.title : "ninguna" },
    { k: "Mejor mes", v: bestMonth && bestMonth.n ? MONTHS[Number(bestMonth.m.slice(5)) - 1] : "–", d: bestMonth && bestMonth.n ? `${bestMonth.n} cumplidas` : "" },
  ];
  const status = (t: YearTask) => (t.done ? { l: "Cumplida", c: "text-success" } : isLate(t, today) ? { l: "No cumplida", c: "text-danger" } : { l: "En camino", c: "text-ink-muted" });

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="goals-report-title" width="max-w-[1240px]">
      <div className={cn("flex flex-col overflow-hidden", isMobile ? "h-[88dvh]" : "h-[min(820px,86dvh)]")}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line py-2 pr-2.5 pl-5">
          <div className="flex items-center gap-1">
            <h2 id="goals-report-title" data-autofocus tabIndex={-1} className="type-title mr-2 outline-none">
              Metas anuales importantes
            </h2>
            <button type="button" aria-label="Año anterior" onClick={() => setYear(year - 1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <span className="w-12 text-center text-[14px] font-semibold tabular-nums">{year}</span>
            <button type="button" aria-label="Año siguiente" onClick={() => setYear(year + 1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Segmented label="Vista" options={[{ id: "anio", label: "El año" }, { id: "metas", label: "Cada meta" }] as const} value={view} onChange={setView} />
            <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </header>
        {view === "anio" ? (
          <div className="flex min-h-0 flex-1 gap-4 p-4 max-lg:flex-col max-lg:overflow-y-auto">
            {/* Todo el año, para editar: tildar, sumar, borrar y arrastrar entre meses. */}
            <ol className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-rows-3">
              {months.map((m, i) => (
                <li key={m} className="min-h-0 max-lg:h-[150px]">
                  <MonthBlock month={m} name={MONTHS[i]} list={tasks.filter((t) => t.month === m)} today={today} isNow={m === thisMonth} muted={m < thisMonth} over={over === m} dropProps={dropProps(m)} />
                </li>
              ))}
            </ol>
            {/* Las estadísticas, al costado. */}
            <aside className="flex min-h-0 shrink-0 flex-col gap-2 lg:w-[300px] lg:overflow-y-auto">
              <ul className="grid grid-cols-3 gap-1.5">
                {stats.map((x) => (
                  <li key={x.k} className="flex flex-col rounded-lg bg-surface-sunken/70 px-2 py-1.5">
                    <span className="flex items-center gap-1 truncate text-[10.5px] text-ink-muted">
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: x.c }} />
                      {x.k}
                    </span>
                    <span className="text-[18px] leading-tight font-semibold tabular-nums">{x.v}</span>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                {facts.map((x) => (
                  <li key={x.k} className="flex items-baseline justify-between gap-2 px-2.5 py-1.5">
                    <span className="min-w-0">
                      <span className="block text-[11.5px] text-ink-muted">{x.k}</span>
                      {x.d && <span className="block truncate text-[10.5px] text-ink-faint">{x.d}</span>}
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums">{x.v}</span>
                  </li>
                ))}
              </ul>
              {byKind.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-lg bg-surface-sunken/60 p-2.5">
                  {byKind.map(({ k, all, ok }) => (
                    <li key={k.id} className="grid grid-cols-[128px_1fr_32px] items-center gap-2 text-[11.5px] tabular-nums">
                      <span className="flex items-center gap-1.5 truncate">
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: kindColor(k.id) }} />
                        {k.label}
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <span className="block h-full rounded-full" style={{ width: `${(ok / all.length) * 100}%`, background: kindColor(k.id) }} />
                      </span>
                      <span className="text-right text-ink-muted">
                        {ok}/{all.length}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-center gap-1.5 text-[11px] leading-snug text-ink-faint">
                <GripVertical aria-hidden className="size-3.5 shrink-0" />
                Arrastrá una meta a otro mes para postergarla: queda registrado.
              </p>
            </aside>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {list.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Todavía no cargaste metas para {year}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="sticky top-0 border-b border-line bg-surface text-[11px] tracking-wide text-ink-muted uppercase">
                    <th className="py-2 pr-3 font-semibold">Meta</th>
                    <th className="py-2 pr-3 font-semibold">Mes</th>
                    <th className="py-2 pr-3 font-semibold">Creada</th>
                    <th className="py-2 pr-3 font-semibold">Recorrido</th>
                    <th className="py-2 pr-3 font-semibold">Días</th>
                    <th className="py-2 pr-3 font-semibold">Atraso</th>
                    <th className="py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => {
                    const { days, moved, stuck } = goalAge(t, t.doneAt ?? today);
                    const s = status(t);
                    return (
                      <tr key={t.id} className="border-b border-line/70 align-top">
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: kindColor(t.kind) }} />
                            {t.title}
                          </span>
                          <span className="ml-3.5 text-[11px] text-ink-muted">{TASK_KINDS.find((k) => k.id === (t.kind ?? "otro"))?.label}</span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{MONTHS[Number(t.month.slice(5)) - 1]}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-ink-muted">{t.createdAt ? dayMonth.format(fromKey(t.createdAt)) : "–"}</td>
                        <td className="py-2 pr-3">
                          {moved ? (
                            <span className={cn("text-[12px]", stuck && "font-medium text-[#8a6200]")}>
                              {[...(t.history ?? []), t.month].map(monthShort).join(" → ")}
                              <span className="ml-1 text-ink-muted">(×{moved})</span>
                            </span>
                          ) : (
                            <span className="text-ink-muted">Sin postergar</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-ink-muted tabular-nums">{days ?? "–"}</td>
                        <td className="py-2 pr-3 text-ink-muted tabular-nums">{delay(t) > 0 ? `${delay(t)} ${delay(t) === 1 ? "mes" : "meses"}` : "–"}</td>
                        <td className={cn("py-2 font-medium whitespace-nowrap", s.c)}>
                          {s.l}
                          {t.doneAt && <span className="block text-[11px] font-normal text-ink-muted">el {dayMonth.format(fromKey(t.doneAt))}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
