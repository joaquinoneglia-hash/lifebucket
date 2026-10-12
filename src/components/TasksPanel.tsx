"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, PanelRightClose, Plus, X } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks";
import { useState, type DragEvent } from "react";
import { fromKey, toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { play } from "@/lib/sfx";
import { usePlanner, type TaskKind, type YearTask } from "@/lib/store";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const dayMonth = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const pad = (n: number) => String(n).padStart(2, "0");

export const TASK_KINDS: { id: TaskKind; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "cuerpo", label: "Cuerpo" },
  { id: "mente", label: "Mente" },
  { id: "alma", label: "Disfrute" },
  { id: "otro", label: "Otro" },
];
/** El color de cada tipo (Otro va en gris tinta). */
export const kindColor = (k?: TaskKind) => (!k || k === "otro" ? "var(--color-ink-faint)" : `var(--color-${k})`);

/** Vencido: no se hizo y ya pasó su fecha (o su mes, si no tenía fecha). */
export const isLate = (t: YearTask, today: string) => !t.done && (t.date ? t.date < today : t.month < today.slice(0, 7));

/**
 * Objetivos del año, mes por mes ("hacer un viaje", "cambiar el auto"). Van por mes y, si querés,
 * con una fecha puntual; sin horario. Se marcan como hechos, se arrastran a otro mes, y los meses
 * que ya pasaron se agrupan para no ocupar lugar.
 */
export function TasksPanel({
  className,
  onCollapse,
  onHeaderDragStart,
}: {
  className?: string;
  onCollapse?: () => void;
  /** Para reordenar la sección arrastrando su encabezado. */
  onHeaderDragStart?: (e: DragEvent) => void;
}) {
  const tasks = usePlanner((s) => s.tasks);
  const moveTask = usePlanner((s) => s.moveTask);
  const [over, setOver] = useState<string | null>(null);
  const now = new Date();
  const today = toKey(now);
  const [year, setYear] = useState(now.getFullYear());
  const thisMonth = today.slice(0, 7);
  const [open, setOpen] = useState<string[]>([thisMonth]);
  const [showPast, setShowPast] = useState(false);
  const toggle = (m: string) => setOpen((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]));
  const yearTasks = tasks.filter((t) => t.month.startsWith(`${year}-`));
  const done = yearTasks.filter((t) => t.done).length;

  const months = MONTHS.map((name, i) => ({ name, month: `${year}-${pad(i + 1)}` }));
  const past = months.filter((m) => m.month < thisMonth);
  const rest = months.filter((m) => m.month >= thisMonth);
  const pastTasks = yearTasks.filter((t) => t.month < thisMonth);

  const monthRow = ({ name, month }: { name: string; month: string }) => {
    const list = yearTasks.filter((t) => t.month === month).sort((a, b) => (a.date ?? "z").localeCompare(b.date ?? "z"));
    const isOpen = open.includes(month);
    const ok = list.filter((t) => t.done).length;
    const notOk = list.length - ok;
    const gone = month < thisMonth;
    return (
      <li
        key={month}
        // Soltar un objetivo acá lo pasa a este mes.
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("text/task")) return;
          e.preventDefault();
          setOver(month);
        }}
        onDragLeave={() => setOver((o) => (o === month ? null : o))}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/task");
          setOver(null);
          if (id) {
            moveTask(id, month);
            play("bubble");
          }
        }}
        className={cn("rounded-md border-b border-line/60 transition-colors last:border-b-0", over === month && "bg-surface-sunken ring-2 ring-ink/20")}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggle(month)}
          className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-surface-sunken/60"
        >
          <ChevronDown aria-hidden className={cn("size-4 text-ink-muted transition-transform duration-200", !isOpen && "-rotate-90")} />
          <span className={cn("flex-1 text-[13px] font-semibold", gone && "text-ink-muted")}>
            {name}
            {month === thisMonth && <span className="ml-1.5 text-[11px] font-medium text-ink-muted">· este mes</span>}
          </span>
          <Tally ok={ok} notOk={notOk} late={gone} />
        </button>
        {isOpen && <MonthTasks month={month} list={list} today={today} />}
      </li>
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <header
        data-section-header
        draggable={!!onHeaderDragStart}
        onDragStart={onHeaderDragStart}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 select-none [-webkit-touch-callout:none]",
          onHeaderDragStart && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex items-center gap-1.5">
          {onHeaderDragStart && <GripVertical aria-hidden className="size-4 text-ink-faint" />}
          <div>
            <h2 className="type-title">Objetivos {year}</h2>
            <p className="text-[11.5px] text-ink-muted tabular-nums">
              {yearTasks.length ? `${done} de ${yearTasks.length} hechos` : "Lo que querés lograr este año"}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <button type="button" aria-label="Año anterior" onClick={() => setYear((y) => y - 1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label="Año siguiente" onClick={() => setYear((y) => y + 1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronRight aria-hidden className="size-4" />
          </button>
          {onCollapse && (
            <button
              type="button"
              aria-label="Comprimir objetivos"
              title="Comprimir"
              onClick={onCollapse}
              className="pressable ml-1 grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <CollapseIcon />
            </button>
          )}
        </div>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* Los meses que ya pasaron, juntos y cerrados (se pueden volver a abrir). */}
        {past.length > 0 && (
          <li className="border-b border-line/60">
            <button
              type="button"
              aria-expanded={showPast}
              onClick={() => setShowPast((v) => !v)}
              className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-ink-muted hover:bg-surface-sunken/60"
            >
              <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", !showPast && "-rotate-90")} />
              <span className="flex-1 text-[12.5px] font-semibold">
                Meses anteriores <span className="font-normal">({MONTHS[0]} a {past[past.length - 1].name})</span>
              </span>
              <Tally ok={pastTasks.filter((t) => t.done).length} notOk={pastTasks.filter((t) => !t.done).length} late />
            </button>
            {showPast && <ol className="pl-3">{past.map(monthRow)}</ol>}
          </li>
        )}
        {rest.map(monthRow)}
      </ol>
    </div>
  );
}

/** Cumplidos contra no cumplidos (en rojo si el mes ya pasó). */
function Tally({ ok, notOk, late }: { ok: number; notOk: number; late?: boolean }) {
  if (!ok && !notOk) return null;
  return (
    <span className="flex items-center gap-2 text-[11.5px] font-semibold tabular-nums">
      <span className="flex items-center gap-0.5 text-success" title="Cumplidos">
        <Check aria-hidden className="size-3" />
        {ok}
      </span>
      <span className={cn("flex items-center gap-0.5", late && notOk ? "text-danger" : "text-ink-muted")} title={late ? "No cumplidos" : "Pendientes"}>
        <X aria-hidden className="size-3" />
        {notOk}
      </span>
    </span>
  );
}

function MonthTasks({ month, list, today }: { month: string; list: YearTask[]; today: string }) {
  const addTask = usePlanner((s) => s.addTask);
  const toggleTask = usePlanner((s) => s.toggleTask);
  const removeTask = usePlanner((s) => s.removeTask);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<TaskKind>("otro");
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();

  return (
    <div className="flex flex-col gap-1 px-2 pb-3">
      {list.map((t) => {
        const late = isLate(t, today);
        return (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/task", t.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            title={late ? "Venció: arrastralo a otro mes" : "Arrastralo para pasarlo a otro mes"}
            className={cn(
              "group flex cursor-grab items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-sunken/60 active:cursor-grabbing",
              late && "bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)]",
            )}
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => {
                if (!t.done) play("complete");
                toggleTask(t.id);
              }}
              aria-label={`${t.title}: ${t.done ? "hecho" : "pendiente"}`}
              className="size-4 shrink-0 cursor-pointer accent-[var(--color-ink)]"
            />
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: kindColor(t.kind) }} />
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", t.done && "text-ink-muted line-through", late && "font-medium text-danger")}>{t.title}</span>
            {t.date && <span className={cn("shrink-0 text-[11px] tabular-nums", late ? "text-danger" : "text-ink-muted")}>{dayMonth.format(fromKey(t.date))}</span>}
            <button
              type="button"
              aria-label={`Borrar ${t.title}`}
              onClick={() => {
                play("delete");
                removeTask(t.id);
              }}
              className="grid size-6 shrink-0 place-items-center rounded text-ink-muted opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        );
      })}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addTask({ title: title.trim(), month, date: date || undefined, kind });
          play("pop");
          setTitle("");
          setDate("");
        }}
        className="flex flex-col gap-1.5 pt-1"
      >
        <div className="flex items-center gap-1.5">
          <Plus aria-hidden className="size-4 shrink-0 text-ink-faint" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Objetivo…"
            aria-label="Nuevo objetivo"
            className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] placeholder:text-ink-faint hover:border-line focus:border-ink focus:bg-surface focus:outline-none"
          />
          <input
            type="date"
            value={date}
            min={`${month}-01`}
            max={`${month}-${pad(last)}`}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Fecha (opcional)"
            title="Fecha (opcional)"
            className="h-8 w-[112px] rounded-md border border-line bg-surface px-1.5 text-[12px] text-ink-muted focus:border-ink focus:outline-none [@media(pointer:coarse)]:w-[136px]"
          />
          <KindPicker value={kind} onChange={setKind} />
        </div>
      </form>
    </div>
  );
}

/** El tipo del objetivo, al final de la línea: un puntito de color que abre la lista. */
function KindPicker({ value, onChange }: { value: TaskKind; onChange: (k: TaskKind) => void }) {
  const [open, setOpen] = useState(false);
  const current = TASK_KINDS.find((k) => k.id === value)!;
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Tipo: ${current.label}`}
        title={`Tipo: ${current.label}`}
        className="flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2 hover:bg-surface-sunken"
      >
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: kindColor(value) }} />
        <ChevronDown aria-hidden className="size-3 text-ink-muted" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Tipo de objetivo" className="animate-fade-up absolute top-full right-0 z-30 mt-1 w-36 rounded-lg bg-surface p-1 shadow-[var(--shadow-popover)]">
          {TASK_KINDS.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === k.id}
                onClick={() => {
                  onChange(k.id);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-sunken", value === k.id && "font-semibold")}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: kindColor(k.id) }} />
                {k.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Comprimir: en compu se pliega hacia el costado; en el celular, hacia arriba (como Semana). */
function CollapseIcon() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return desktop ? <PanelRightClose aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />;
}
