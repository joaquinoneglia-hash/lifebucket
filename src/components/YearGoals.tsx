"use client";

import { ArrowRight, Check, ChevronLeft, ChevronRight, GripVertical, Maximize2, Plus, Trash2, X } from "lucide-react";
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
import { Sheet } from "./ui";

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
            Metas importantes
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
            aria-label="Ver el reporte de metas"
            title="Reporte de metas: historial, postergadas, cumplidas"
            onClick={() => {
              play("open");
              setReport(true);
            }}
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Maximize2 aria-hidden className="size-4" />
          </button>
          <ModuleControls />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
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
        <ol aria-label="Meses que quedan" className="grid min-h-0 flex-1 auto-rows-[minmax(118px,1fr)] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
          {months
            .filter((m) => !m.gone)
            .map((m) => (
              <li key={m.month} className="min-h-0">
                <MonthBlock month={m.month} name={m.name} list={m.list} today={today} isNow={m.isNow} over={over === m.month} dropProps={dropProps(m.month)} />
              </li>
            ))}
        </ol>
      </div>

      {report && <GoalsReport year={year} isMobile={!desktop} onClose={() => setReport(false)} />}
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
        "flex h-full min-h-0 flex-col rounded-xl border px-2 py-1.5 transition-colors duration-150",
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
              className={cn("group/t flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-0.5 hover:bg-surface-sunken/80", !t.done && "cursor-grab active:cursor-grabbing")}
            >
              <button
                type="button"
                aria-pressed={t.done}
                aria-label={`${t.title}: ${t.done ? "cumplida" : "pendiente"}`}
                onClick={() => {
                  if (!t.done) cheer("goalDone");
                  toggleTask(t.id);
                }}
                className={cn("grid size-3.5 shrink-0 place-items-center rounded-[4px] border", t.done ? "border-success bg-success text-white" : late ? "border-danger" : "border-ink-faint")}
              >
                {t.done && <Check aria-hidden strokeWidth={3.5} className="size-2.5" />}
              </button>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: kindColor(t.kind) }} />
              <span title={t.title} className={cn("min-w-0 flex-1 truncate text-[11.5px]", t.done && "text-ink-muted line-through", late && "text-danger")}>
                {t.title}
              </span>
              {moved > 0 && (
                <span title={`Postergada ${moved} ${moved === 1 ? "vez" : "veces"}`} className={cn("shrink-0 rounded-full px-1 text-[9.5px] font-semibold tabular-nums", stuck ? "bg-[color-mix(in_oklab,#d99a00_18%,transparent)] text-[#8a6200]" : "bg-surface-sunken text-ink-muted")}>
                  ×{moved}
                </span>
              )}
              {!t.done && (
                <button
                  type="button"
                  aria-label={`Pasar ${t.title} al mes que viene`}
                  title="Pasar al mes que viene"
                  onClick={() => {
                    moveTask(t.id, nextMonth(t.month));
                    cheer("goalPostponed");
                  }}
                  className="grid size-5 shrink-0 place-items-center rounded text-ink-faint opacity-0 group-hover/t:opacity-100 hover:text-ink focus-visible:opacity-100 [@media(hover:none)]:opacity-70"
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
                className="grid size-5 shrink-0 place-items-center rounded text-ink-faint opacity-0 group-hover/t:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:hidden"
              >
                <Trash2 aria-hidden className="size-3" />
              </button>
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
          {list.length ? "Sumar" : "Sumar una meta"}
        </button>
      )}
    </div>
  );
}

/**
 * El reporte de metas (expandido): cuántas te propusiste, cumpliste, no cumpliste y postergaste en el año, y
 * cada meta con su historia: cuándo se creó, por qué meses pasó, cuántos días lleva y cuándo se cumplió.
 */
function GoalsReport({ year, isMobile, onClose }: { year: number; isMobile: boolean; onClose: () => void }) {
  const tasks = usePlanner((s) => s.tasks);
  const today = toKey(new Date());
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  const st = taskStats(tasks, months, today.slice(0, 7));
  const list = [...st.proposed].sort((a, b) => a.month.localeCompare(b.month));
  const movedCount = list.filter((t) => (t.history?.length ?? 0) > 0).length;
  const stats = [
    { k: "Propuestas", v: st.proposed.length, c: "var(--color-ink)" },
    { k: "Cumplidas", v: st.done.length, c: "var(--color-success)" },
    { k: "No cumplidas", v: st.notDone.length, c: "var(--color-danger)" },
    { k: "Postergadas", v: movedCount, c: "#d99a00" },
    { k: "En camino", v: st.pending.length, c: "var(--color-ink-faint)" },
  ];
  const status = (t: YearTask) => (t.done ? { l: "Cumplida", c: "text-success" } : isLate(t, today) ? { l: "No cumplida", c: "text-danger" } : { l: "En camino", c: "text-ink-muted" });

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="goals-report-title" width="max-w-[980px]">
      <div className={cn("flex flex-col", isMobile ? "h-[88dvh]" : "h-[min(760px,90dvh)]")}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="goals-report-title" data-autofocus tabIndex={-1} className="type-title outline-none">
            Tus metas de {year}
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stats.map((s) => (
              <li key={s.k} className="flex flex-col gap-0.5 rounded-xl bg-surface-sunken/70 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: s.c }} />
                  {s.k}
                </span>
                <span className="text-[24px] leading-none font-semibold tabular-nums">{s.v}</span>
              </li>
            ))}
          </ul>
          {list.length === 0 ? (
            <p className="mt-6 text-[13px] text-ink-muted">Todavía no cargaste metas para {year}.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-[11px] tracking-wide text-ink-muted uppercase">
                    <th className="py-2 pr-3 font-semibold">Meta</th>
                    <th className="py-2 pr-3 font-semibold">Mes</th>
                    <th className="py-2 pr-3 font-semibold">Creada</th>
                    <th className="py-2 pr-3 font-semibold">Recorrido</th>
                    <th className="py-2 pr-3 font-semibold">Días</th>
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
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
            <GripVertical aria-hidden className="size-3.5" />
            En el panel, arrastrá una meta a otro mes (o tocá →) para postergarla: queda registrado acá.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
