"use client";

import { Check, ChevronDown, ChevronUp, GripVertical, Info, PanelRightClose, Plus, Trash2, X } from "lucide-react";
import { guessQuadrant } from "@/lib/categorize";
import { GhostButton, PrimaryButton, Segmented, Select, Sheet } from "./ui";
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
  { id: "cuerpo", label: "Deporte" },
  { id: "interior", label: "Mente y Alma" },
  { id: "alma", label: "Hobbies" },
  { id: "mente", label: "Habilidades" },
  { id: "vinculos", label: "Vínculos" },
  { id: "trabajo", label: "Trabajo" },
  { id: "otro", label: "Otro" },
];
/** El color de cada tipo (Otro va en gris tinta). */
export const kindColor = (k?: TaskKind) => (!k || k === "otro" ? "var(--color-ink-faint)" : `var(--color-${k})`);

/** Vencido: no se hizo y ya pasó su fecha (o su mes, si no tenía fecha). */
export const isLate = (t: YearTask, today: string) => !t.done && (t.date ? t.date < today : t.month < today.slice(0, 7));

/**
 * Objetivos, año por año ("hacer un viaje", "cambiar el auto"). Cada año se comprime; adentro van mes por
 * mes y, si querés, con una fecha puntual. Se marcan como hechos, se pasan a otro mes, y los meses que ya
 * pasaron se agrupan para no ocupar lugar.
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
  const now = new Date();
  const today = toKey(now);
  const current = now.getFullYear();
  // El año actual y el que viene siempre; los demás, si tienen objetivos.
  const years = [...new Set([current, current + 1, ...tasks.map((t) => Number(t.month.slice(0, 4)))])].sort((a, b) => a - b);
  const [openYears, setOpenYears] = useState<number[]>([current]);
  const toggleYear = (y: number) => setOpenYears((l) => (l.includes(y) ? l.filter((x) => x !== y) : [...l, y]));
  const yearTasks = tasks.filter((t) => t.month.startsWith(`${current}-`));
  const done = yearTasks.filter((t) => t.done).length;

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
            <h2 className="type-title">Metas</h2>
            <p className="text-[11.5px] text-ink-muted tabular-nums">
              {yearTasks.length ? `${done} de ${yearTasks.length} hechos en ${current}` : "Lo que querés lograr"}
            </p>
          </div>
        </div>
        {onCollapse && (
          <button
            type="button"
            aria-label="Comprimir metas"
            title="Comprimir"
            onClick={onCollapse}
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <CollapseIcon />
          </button>
        )}
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <BalanceNote />
        {years.map((y) => {
          const list = tasks.filter((t) => t.month.startsWith(`${y}-`));
          const isOpen = openYears.includes(y);
          const gone = y < current;
          return (
            <li key={y} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleYear(y)}
                className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-surface-sunken/60"
              >
                <ChevronDown aria-hidden className={cn("size-4 text-ink-muted transition-transform duration-200", !isOpen && "-rotate-90")} />
                <span className={cn("flex-1 text-[15px] font-semibold tabular-nums", gone && "text-ink-muted")}>
                  {y}
                  {y === current && <span className="ml-1.5 text-[11px] font-medium text-ink-muted">· este año</span>}
                </span>
                <Tally ok={list.filter((t) => t.done).length} notOk={list.filter((t) => !t.done).length} late={gone} />
              </button>
              {isOpen && <YearMonths year={y} tasks={list} today={today} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Los meses de un año: los que ya pasaron, juntos y cerrados; el mes actual, abierto. */
function YearMonths({ year, tasks, today }: { year: number; tasks: YearTask[]; today: string }) {
  const moveTask = usePlanner((s) => s.moveTask);
  const thisMonth = today.slice(0, 7);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<string[]>([thisMonth]);
  const [showPast, setShowPast] = useState(false);
  const toggle = (m: string) => setOpen((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]));
  const months = MONTHS.map((name, i) => ({ name, month: `${year}-${pad(i + 1)}` }));
  const past = months.filter((m) => m.month < thisMonth);
  const rest = months.filter((m) => m.month >= thisMonth);
  const pastTasks = tasks.filter((t) => t.month < thisMonth);

  const monthRow = ({ name, month }: { name: string; month: string }) => {
    const list = tasks.filter((t) => t.month === month).sort((a, b) => (a.date ?? "z").localeCompare(b.date ?? "z"));
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
    <ol className="pb-2 pl-3">
      {/* Los meses que ya pasaron, juntos y cerrados (se pueden volver a abrir). En años pasados, son todos. */}
      {past.length > 0 && rest.length > 0 && (
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
      {(rest.length > 0 ? rest : past).map(monthRow)}
    </ol>
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
  // En el celular se suma y se edita en una hoja (más cómoda que una línea con el teclado).
  const phone = !useMediaQuery("(min-width: 1024px)");
  const [sheet, setSheet] = useState<{ task?: YearTask } | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<TaskKind>("otro");
  const [manualKind, setManualKind] = useState(false);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();

  const add = () => {
    if (!title.trim()) return;
    addTask({ title: title.trim(), month, date: date || undefined, kind });
    play("pop");
    setTitle("");
    setDate("");
    setKind("otro");
    setManualKind(false);
  };

  return (
    <div className="flex flex-col gap-1 px-2 pb-3">
      {list.map((t) => {
        const late = isLate(t, today);
        const kindLabel = TASK_KINDS.find((k) => k.id === t.kind && k.id !== "otro")?.label;
        return (
          <div
            key={t.id}
            draggable={!phone}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/task", t.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            title={phone ? undefined : late ? "Venció: arrastralo a otro mes" : "Arrastralo para pasarlo a otro mes"}
            className={cn(
              "group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-sunken/60",
              !phone && "cursor-grab active:cursor-grabbing",
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
            <button
              type="button"
              onClick={() => setSheet({ task: t })}
              aria-label={`Editar ${t.title}`}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className={cn("min-w-0 flex-1 truncate text-[13px]", t.done && "text-ink-muted line-through", late && "font-medium text-danger")}>{t.title}</span>
              {kindLabel && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-medium text-ink-muted">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: kindColor(t.kind) }} />
                  {kindLabel}
                </span>
              )}
              {t.date && <span className={cn("shrink-0 text-[11px] tabular-nums", late ? "text-danger" : "text-ink-muted")}>{dayMonth.format(fromKey(t.date))}</span>}
            </button>
            <button
              type="button"
              aria-label={`Borrar ${t.title}`}
              onClick={() => {
                play("delete");
                removeTask(t.id);
              }}
              className="grid size-7 shrink-0 place-items-center rounded text-ink-muted opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Trash2 aria-hidden className="size-3.5" />
            </button>
          </div>
        );
      })}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-col gap-1.5 pt-1"
      >
        <div className="flex items-center gap-1.5">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!manualKind) setKind(kindFor(e.target.value));
            }}
            placeholder="Nueva meta…"
            aria-label="Nueva meta"
            enterKeyHint="done"
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[13px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Agregar meta"
            title="Agregar (Enter)"
            className="pressable grid size-8 shrink-0 place-items-center rounded-md bg-ink text-surface hover:bg-ink/90 disabled:opacity-30"
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        {title.trim() && (
          <div className="animate-fade-up flex items-center gap-1.5">
            <KindPicker
              value={kind}
              onChange={(k) => {
                setKind(k);
                setManualKind(true);
              }}
            />
            <input
              type="date"
              value={date}
              min={`${month}-01`}
              max={`${month}-${pad(last)}`}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Fecha (opcional)"
              title="Fecha (opcional)"
              className="h-8 w-[118px] rounded-md border border-line bg-surface px-1.5 text-[12px] text-ink-muted focus:border-ink focus:outline-none [@media(pointer:coarse)]:w-[140px]"
            />
            <span className="text-[11px] text-ink-faint">{date ? "" : "Sin fecha"}</span>
          </div>
        )}
      </form>

      {sheet && <TaskSheet month={month} task={sheet.task} isMobile={phone} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** El tipo de objetivo que sugiere el texto (lo que no es Trabajo, Cuerpo, Mente o Disfrute va a "Otro"). */
function kindFor(text: string): TaskKind {
  const q = guessQuadrant(text);
  return q && q !== "libre" ? q : "otro";
}

/**
 * Sumar o cambiar un objetivo en una hoja: qué es, de qué tipo (se sugiere solo), en qué mes y si tiene
 * fecha o no. El botón grande hace lo mismo que el Enter de la compu.
 */
function TaskSheet({ month, task, isMobile, onClose }: { month: string; task?: YearTask; isMobile: boolean; onClose: () => void }) {
  const addTask = usePlanner((s) => s.addTask);
  const updateTask = usePlanner((s) => s.updateTask);
  const removeTask = usePlanner((s) => s.removeTask);
  const [title, setTitle] = useState(task?.title ?? "");
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "otro");
  const [manualKind, setManualKind] = useState(!!task);
  const [inMonth, setInMonth] = useState(task?.month ?? month);
  const [withDate, setWithDate] = useState(!!task?.date);
  const [date, setDate] = useState(task?.date ?? "");
  const [y, m] = inMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const valid = title.trim() && (!withDate || date);

  const save = () => {
    if (!valid) return;
    const data = { title: title.trim(), kind, month: inMonth, date: withDate && date.startsWith(inMonth) ? date : undefined };
    if (task) updateTask(task.id, data);
    else addTask(data);
    play("pop");
    onClose();
  };

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="task-sheet-title" width="max-w-[440px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-4 p-5"
      >
        <h2 id="task-sheet-title" className="type-headline">
          {task ? "Cambiar meta" : "Nueva meta"}
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-ink-muted">¿Qué querés lograr?</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!manualKind) setKind(kindFor(e.target.value));
            }}
            placeholder="Correr 10 km, leer 2 libros, un viaje…"
            enterKeyHint="done"
            autoComplete="off"
            className="h-11 rounded-md border border-line bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-ink-muted">Tipo{!manualKind && kind !== "otro" ? " · sugerido, lo podés cambiar" : ""}</span>
          <div role="radiogroup" aria-label="Tipo de meta" className="flex flex-wrap gap-1.5">
            {TASK_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => {
                  setKind(k.id);
                  setManualKind(true);
                }}
                className={cn(
                  "pressable inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                  kind === k.id ? "border-ink bg-ink text-surface" : "border-line text-ink-muted",
                )}
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: kindColor(k.id) }} />
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[12px] text-ink-muted">Mes</span>
            <Select
              label="Mes"
              value={inMonth}
              onChange={(v) => setInMonth(v)}
              options={MONTHS.map((name, i) => ({ value: `${y}-${pad(i + 1)}`, label: name }))}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-ink-muted">Fecha</span>
            <Segmented
              label="Fecha"
              value={withDate ? "con" : "sin"}
              onChange={(v) => setWithDate(v === "con")}
              options={[
                { id: "sin", label: "Sin fecha" },
                { id: "con", label: "Con fecha" },
              ]}
            />
          </div>
        </div>
        {withDate && (
          <input
            type="date"
            value={date}
            min={`${inMonth}-01`}
            max={`${inMonth}-${pad(last)}`}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Fecha"
            className="h-11 rounded-md border border-line bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
          />
        )}

        <footer className="flex items-center justify-between gap-2 pt-1">
          {task ? (
            <GhostButton
              danger
              onClick={() => {
                play("delete");
                removeTask(task.id);
                onClose();
              }}
            >
              <Trash2 aria-hidden className="size-4" />
              Borrar
            </GhostButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <GhostButton onClick={onClose}>Cancelar</GhostButton>
            <PrimaryButton type="submit" disabled={!valid} className="h-11 px-6">
              {task ? "Guardar" : "Agregar"}
            </PrimaryButton>
          </div>
        </footer>
      </form>
    </Sheet>
  );
}

/** El tipo del objetivo: el color y el nombre, abre la lista. */
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
        title="Tipo de meta"
        className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-ink-muted hover:bg-surface-sunken"
      >
        <span aria-hidden className="size-2 rounded-full" style={{ background: kindColor(value) }} />
        {current.label}
        <ChevronDown aria-hidden className="size-3" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Tipo de meta" className="animate-fade-up absolute top-full right-0 z-30 mt-1 w-36 rounded-lg bg-surface p-1 shadow-[var(--shadow-popover)]">
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

const NOTE_KEY = "lb:tasks-note";
/** Una aclaración arriba de los objetivos (se cierra y no vuelve a aparecer). */
function BalanceNote() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(NOTE_KEY);
    } catch {
      return true;
    }
  });
  if (!show) return null;
  return (
    <li className="mx-1 mb-2 flex items-start gap-2 rounded-xl bg-surface-sunken px-3 py-2.5">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
      <p className="flex-1 text-[12.5px] leading-snug text-ink-muted">
        <span className="font-semibold text-ink">Tus metas no cambian tu balance de vida.</span> Están para que te organices: el balance sale solo de tu
        semana y tus logros.
      </p>
      <button
        type="button"
        aria-label="Entendido, no mostrar más"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(NOTE_KEY, "1");
          } catch {}
        }}
        className="pressable -mt-0.5 -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}
