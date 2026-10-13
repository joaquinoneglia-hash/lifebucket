"use client";

import {
  AlarmClock,
  ChevronDown,
  ArrowUpDown,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Repeat as RepeatIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, fromKey, toKey, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { parseLogro } from "@/lib/logro-parse";
import { cheer } from "@/lib/motivation";
import {
  atLabel,
  byMonth,
  dueLabel,
  isOverdue,
  isUrgent,
  nextDue,
  PRIORITIES,
  PRIORITY_CHOICES,
  priorityOf,
  REPEATS,
  sortPending,
  turning,
} from "@/lib/pending";
import {
  allKinds,
  COUNTRIES,
  guessKind,
  holidays,
  holidaysBetween,
  KINDS,
  KIND_COLORS,
  KIND_REPEAT,
  kindInfo,
  REMIND_OPTIONS,
  type KindDef,
} from "@/lib/reminders";
import { play } from "@/lib/sfx";
import {
  newId,
  usePlanner,
  type ListItem,
  type PendingSort,
  type ReminderKind,
  type Repeat,
  type UserList,
} from "@/lib/store";
import { ModuleControls } from "./Modules";
import { Sheet } from "./ui";

const today = () => toKey(new Date());
const dayShort = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
});
const SORTS: { id: PendingSort; label: string }[] = [
  { id: "prioridad", label: "Prioridad" },
  { id: "fecha", label: "Fecha" },
  { id: "manual", label: "A mi manera" },
];

/** Las acciones sobre los pendientes de una lista (completar, posponer, fechar, reordenar…). */
function usePendingActions(list: UserList) {
  const setItems = usePlanner((s) => s.setListItems);
  const items = list.items;
  const save = (next: ListItem[]) => setItems(list.id, next);
  const patch = (id: string, p: Partial<ListItem>) =>
    save(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return {
    save,
    patch,
    complete: (i: ListItem) => {
      if (i.done) return patch(i.id, { done: false, doneAt: undefined });
      // Lo que se repite no se tacha: vuelve con la fecha siguiente.
      if (i.repeat) {
        patch(i.id, { due: nextDue(i) });
        cheer("check", "¡Hecho! Vuelve a aparecer la próxima vez.");
        return;
      }
      patch(i.id, { done: true, doneAt: today() });
      cheer("check");
    },
    postpone: (i: ListItem, days: number) => {
      patch(i.id, { due: toKey(addDays(new Date(), days)) });
      play("bubble");
    },
    remove: (id: string) => {
      play("delete");
      save(items.filter((x) => x.id !== id));
    },
    reorder: (dragId: string, beforeId: string) => {
      if (dragId === beforeId) return;
      const moving = items.find((x) => x.id === dragId);
      if (!moving) return;
      const rest = items.filter((x) => x.id !== dragId);
      const at = rest.findIndex((x) => x.id === beforeId);
      rest.splice(at < 0 ? rest.length : at, 0, moving);
      save(rest);
    },
  };
}

/** Recordatorios como panel del tablero. */
export function PendingCard({
  list,
  className,
}: {
  list: UserList;
  className?: string;
}) {
  const [big, setBig] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <section
      aria-label={list.title}
      className={cn("card flex min-h-0 flex-col overflow-hidden", className)}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <h2 className="flex min-w-0 items-center gap-2 type-title">
          <ClipboardList
            aria-hidden
            className="size-4 shrink-0 text-ink-muted"
          />
          <span className="truncate">{list.title}</span>
        </h2>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label="Ampliar recordatorios"
            title="Ver en grande, con calendario"
            onClick={() => {
              play("open");
              setBig(true);
            }}
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <CalendarDays aria-hidden className="size-4" />
          </button>
          <ModuleControls />
        </div>
      </header>
      <PendingList list={list} />
      {big && (
        <PendingExpanded
          list={list}
          isMobile={!desktop}
          onClose={() => setBig(false)}
        />
      )}
    </section>
  );
}

/** La lista: grupos, orden, avisos de lo vencido, los pendientes divididos por mes y el campo para sumar. */
function PendingList({ list, wide }: { list: UserList; wide?: boolean }) {
  const updateList = usePlanner((s) => s.updateList);
  const act = usePendingActions(list);
  const [group, setGroup] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const sort = list.sort ?? "prioridad";
  const groups = list.groups ?? [];
  const t = today();
  const hiddenKinds = list.hiddenKinds ?? [];
  const [span, setSpan] = useState<"semana" | "mes" | "todos">(
    wide ? "todos" : "mes",
  );
  const weekEnd = toKey(
    addDays(new Date(), 6 - ((new Date().getDay() + 6) % 7)),
  );
  const inSpan = (i: ListItem) => {
    if (!i.due || span === "todos") return true;
    if (!i.done && i.due < t) return true;
    return span === "mes"
      ? i.due.slice(0, 7) === t.slice(0, 7)
      : i.due <= weekEnd && i.due >= t;
  };
  const visible = list.items.filter(
    (i) =>
      (!group || i.group === group) &&
      !(list.hideDone && i.done) &&
      !hiddenKinds.includes(i.kind ?? "tarea") &&
      inSpan(i),
  );
  // Los meses que vienen, cerrados de entrada (se abren tocándolos).
  const [toggled, setToggled] = useState<string[]>([]);
  const isClosed = (key: string) =>
    (key > t.slice(0, 7) && key !== "zz") !== toggled.includes(key);
  // Feriados y fechas especiales de los próximos 15 días (se ocultan con su interruptor).
  const nextHolidays = hiddenKinds.includes("feriado")
    ? []
    : visibleHolidays(list, t, toKey(addDays(new Date(), 15)));
  const ordered = sortPending(visible, sort);
  const urgent = list.items.filter((i) => isUrgent(i, t));
  const late = urgent.filter((i) => isOverdue(i, t)).length;
  const doneCount = list.items.filter((i) => i.done).length;

  const row = (i: ListItem) => (
    <PendingRow
      key={i.id}
      item={i}
      list={list}
      draggable={sort === "manual" || wide}
      onDragStart={() => setDragId(i.id)}
      onDropOn={() => dragId && sort === "manual" && act.reorder(dragId, i.id)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Grupos, orden y mostrar u ocultar lo hecho. */}
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pt-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {[null, ...groups].map((g) => (
            <button
              key={g ?? "todos"}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={cn(
                "pressable h-7 shrink-0 rounded-full px-2.5 text-[10.5px] font-semibold",
                group === g
                  ? "bg-ink text-surface"
                  : "bg-surface-sunken text-ink-muted hover:text-ink",
              )}
            >
              {g ?? "Todos"}
            </button>
          ))}
          {newGroup === null ? (
            <button
              type="button"
              onClick={() => setNewGroup("")}
              title="Nuevo grupo"
              className="pressable inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full px-2 text-[10.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Plus aria-hidden className="size-3.5" />
              {wide ? "Grupo" : <span className="sr-only">Nuevo grupo</span>}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = newGroup.trim();
                if (n && !groups.includes(n))
                  updateList(list.id, { groups: [...groups, n] });
                if (n) setGroup(n);
                setNewGroup(null);
              }}
            >
              <input
                autoFocus
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                placeholder="Personal, Trabajo…"
                aria-label="Nombre del grupo"
                className="h-7 w-32 rounded-full border border-ink bg-surface px-2.5 text-[10.5px] focus:outline-none"
              />
            </form>
          )}
        </div>
        <div role="radiogroup" aria-label="Qué ver" className="flex gap-1">
          {(
            [
              ["mes", "Este mes"],
              ["semana", "Esta semana"],
              ["todos", "Todas las fechas"],
            ] as const
          ).map(([id, l]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={span === id}
              onClick={() => setSpan(id)}
              className={cn(
                "pressable h-6 rounded-full px-2.5 text-[10.5px] font-semibold",
                span === id
                  ? "bg-ink/80 text-surface"
                  : "text-ink-muted ring-1 ring-line hover:text-ink",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-1">
          <label
            title="Ordenar por"
            className="relative inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10.5px] text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowUpDown aria-hidden className="size-3.5" />
            <select
              value={sort}
              onChange={(e) =>
                updateList(list.id, { sort: e.target.value as PendingSort })
              }
              aria-label="Ordenar por"
              className="bg-transparent font-semibold text-ink focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {
            <button
              type="button"
              aria-pressed={!list.hideDone}
              title={
                list.hideDone ? "Mostrar completados" : "Ocultar completados"
              }
              onClick={() => updateList(list.id, { hideDone: !list.hideDone })}
              className="pressable inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {list.hideDone ? (
                <EyeOff aria-hidden className="size-3.5" />
              ) : (
                <Eye aria-hidden className="size-3.5" />
              )}
              {list.hideDone
                ? `Mostrar completados${doneCount ? ` (${doneCount})` : ""}`
                : "Ocultar completados"}
            </button>
          }
          {groups.includes(group ?? "") && (
            <button
              type="button"
              title="Borrar este grupo (los recordatorios quedan)"
              onClick={() => {
                updateList(list.id, {
                  groups: groups.filter((g) => g !== group),
                  items: list.items.map((i) =>
                    i.group === group ? { ...i, group: undefined } : i,
                  ),
                });
                setGroup(null);
              }}
              className="pressable ml-auto inline-flex h-7 items-center rounded-full px-2 text-[10px] text-ink-faint hover:text-danger"
            >
              Quitar grupo
            </button>
          )}
        </div>
        {/* Avisos: lo vencido y lo de hoy, con posponer o recuperar ahí mismo. */}
        {urgent.length > 0 && (
          <div
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-[11px]",
              late || urgent.some((i) => i.due === t)
                ? "bg-danger/10 text-danger"
                : "bg-[color-mix(in_oklab,#d99a00_14%,transparent)] text-[#8a6200]",
            )}
          >
            <button
              type="button"
              onClick={() => setAlerts(!alerts)}
              aria-expanded={alerts}
              className="flex w-full items-center gap-1.5 text-left font-semibold"
            >
              <Bell aria-hidden className="size-3.5 shrink-0" />
              <span className="flex-1">
                {late > 0 && `${late} ${late === 1 ? "vencido" : "vencidos"}`}
                {late > 0 && urgent.length > late && " · "}
                {urgent.length > late && `${urgent.length - late} para hoy`}
              </span>
              <span className="text-[10px] font-medium underline underline-offset-2">
                {alerts ? "Cerrar" : "Ver"}
              </span>
            </button>
            {alerts && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {urgent.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-lg bg-surface px-2 py-1.5 text-ink"
                  >
                    <p className="truncate text-[11px] font-medium">{i.text}</p>
                    <PostponeButtons item={i} act={act} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1"
        onDragEnd={() => setDragId(null)}
      >
        {!ordered.length ? (
          <p className="px-2 py-3 text-[11px] leading-snug text-ink-muted">
            {list.items.length
              ? "Nada por acá."
              : "Sumá lo que tenés que hacer. Podés escribir la fecha: «pagar la luz el viernes», «llamar al dentista mañana»."}
          </p>
        ) : (
          (sort === "manual"
            ? [
                {
                  key: "manual",
                  label: "",
                  items: ordered.filter((i) => i.due),
                },
                {
                  key: "zz",
                  label: "Sin fecha",
                  items: ordered.filter((i) => !i.due),
                },
              ].filter((g) => g.items.length)
            : byMonth(ordered, t)
          )
            .filter((g) => g.key !== "zz")
            .map((g) => (
              <section key={g.key} className="mb-1">
                {g.label && (
                  <button
                    type="button"
                    aria-expanded={!isClosed(g.key)}
                    onClick={() =>
                      setToggled((x) =>
                        x.includes(g.key)
                          ? x.filter((k) => k !== g.key)
                          : [...x, g.key],
                      )
                    }
                    className={cn(
                      "sticky top-0 z-[1] flex w-full items-center gap-1 bg-surface/95 px-2 pt-1.5 pb-0.5 text-left text-[9.5px] font-semibold tracking-wide uppercase backdrop-blur",
                      g.key === "00" ? "text-danger" : "text-ink-faint",
                    )}
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-3 transition-transform",
                        isClosed(g.key) && "-rotate-90",
                      )}
                    />
                    {g.label}
                    {isClosed(g.key) && (
                      <span className="ml-1 normal-case">
                        ({g.items.length})
                      </span>
                    )}
                  </button>
                )}
                {!isClosed(g.key) && <ul>{g.items.map(row)}</ul>}
              </section>
            ))
        )}
        {nextHolidays.length > 0 && (
          <section className="mt-2 rounded-xl bg-[color-mix(in_oklab,#0891b2_7%,transparent)] px-2 py-1.5">
            <p className="pb-0.5 text-[9.5px] font-semibold tracking-wide text-[#0e7490] uppercase">
              Próximas fechas
            </p>
            <ul className="flex flex-col gap-0.5">
              {nextHolidays.map((h) => (
                <li
                  key={h.date + h.name}
                  className="group/h flex items-center gap-2 text-[11px]"
                >
                  <span className="w-12 shrink-0 text-[10px] font-semibold text-[#0e7490] tabular-nums">
                    {dayShort.format(fromKey(h.date))}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  {h.feriado && (
                    <span className="shrink-0 rounded-full bg-[#0891b2]/15 px-1.5 text-[9.5px] font-semibold text-[#0e7490]">
                      Feriado
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] font-medium text-ink-muted tabular-nums">{daysLeft(h.date, t)}</span>
                  <HideHoliday list={list} name={h.orig} date={h.date} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {ordered.some((i) => !i.due) && (
          <section className="mt-2 rounded-xl border border-dashed border-line bg-surface-sunken/50 pb-1">
            <p className="px-2 pt-1.5 pb-0.5 text-[9.5px] font-semibold tracking-wide text-ink-muted uppercase">
              Sin fecha
            </p>
            <ul>{ordered.filter((i) => !i.due).map(row)}</ul>
          </section>
        )}
      </div>
      <PendingAddForm list={list} group={group} wide={wide} />
    </div>
  );
}

function PostponeButtons({
  item,
  act,
  full,
}: {
  item: ListItem;
  act: ReturnType<typeof usePendingActions>;
  /** En el aviso: también elegir otra fecha y eliminarlo. */
  full?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const b =
    "pressable h-6 rounded-full bg-surface-sunken px-2 text-[10px] font-semibold text-ink-muted hover:text-ink";
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => act.complete(item)}
        className={cn(b, "bg-success/15 text-success hover:text-success")}
      >
        ✓ Hecho
      </button>
      {isOverdue(item) && (
        <button
          type="button"
          onClick={() => act.postpone(item, 0)}
          className={b}
        >
          Para hoy
        </button>
      )}
      <button type="button" onClick={() => act.postpone(item, 1)} className={b}>
        Mañana
      </button>
      <button type="button" onClick={() => act.postpone(item, 7)} className={b}>
        {full ? "Próxima semana" : "En una semana"}
      </button>
      {full && (
        <>
          {picking ? (
            <input
              type="date"
              autoFocus
              min={today()}
              aria-label="Elegir otra fecha"
              onChange={(e) => {
                if (!e.target.value) return;
                act.patch(item.id, { due: e.target.value as DateKey });
                play("bubble");
              }}
              className="h-6 rounded-full border border-line bg-surface px-1.5 text-[10px] focus:border-ink focus:outline-none"
            />
          ) : (
            <button type="button" onClick={() => setPicking(true)} className={b}>
              Elegir fecha…
            </button>
          )}
          <button type="button" onClick={() => act.remove(item.id)} className={cn(b, "inline-flex items-center gap-1 text-danger hover:text-danger")}>
            <Trash2 aria-hidden className="size-3" />
            Eliminar
          </button>
        </>
      )}
    </span>
  );
}

/** Un pendiente: tilde, texto, cuándo vence, grupo, repetición y prioridad; fecha y borrar al pasar el mouse. */
function PendingRow({
  item: i,
  list,
  draggable,
  onDragStart,
  onDropOn,
}: {
  item: ListItem;
  list: UserList;
  draggable?: boolean;
  onDragStart: () => void;
  onDropOn: () => void;
}) {
  const act = usePendingActions(list);
  const due = dueLabel(i);
  const p = priorityOf(i);
  const [editing, setEditing] = useState(false);
  return (
    <li
      draggable={draggable && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/pending", i.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
      className="group/it flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-sunken/70"
    >
      {draggable && (
        <GripVertical
          aria-hidden
          className="mt-1 size-3.5 shrink-0 cursor-grab text-ink-faint opacity-0 group-hover/it:opacity-100"
        />
      )}
      <button
        type="button"
        aria-pressed={!!i.done}
        aria-label={
          i.done ? `Desmarcar ${i.text}` : `Marcar ${i.text} como hecho`
        }
        onClick={() => act.complete(i)}
        className={cn(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2",
          i.done
            ? "border-success bg-success text-white"
            : due?.tone === "late"
              ? "border-danger"
              : "border-ink-faint hover:border-ink",
        )}
      >
        {i.done && <Check aria-hidden strokeWidth={3.5} className="size-3" />}
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={i.text}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) act.patch(i.id, { text: v });
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Editar recordatorio"
            className="w-full rounded border border-ink bg-surface px-1 text-[11.5px] focus:outline-none"
          />
        ) : (
          <p
            onDoubleClick={() => setEditing(true)}
            className={cn(
              "text-[11.5px] leading-snug [overflow-wrap:anywhere]",
              i.done && "text-ink-faint line-through",
            )}
          >
            {i.kind && i.kind !== "tarea" && (
              <span
                aria-label={kindInfo(i.kind, list.customKinds).name}
                title={kindInfo(i.kind, list.customKinds).name}
                className="mr-1"
              >
                {kindInfo(i.kind, list.customKinds).emoji}
              </span>
            )}
            {i.text}
          </p>
        )}
        {(due || i.group || i.repeat || i.at !== undefined) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
            {turning(i) && (
              <span
                className="font-semibold"
                style={{ color: kindInfo(i.kind, list.customKinds).color }}
              >
                {turning(i)}
              </span>
            )}
            {i.at !== undefined && (
              <span className="font-semibold text-ink-muted tabular-nums">
                {atLabel(i)} h
              </span>
            )}
            {i.remind !== undefined && (
              <span
                className="inline-flex items-center gap-0.5 text-ink-muted"
                title="Te avisa"
              >
                <Bell aria-hidden className="size-3" />
                {REMIND_OPTIONS.find((o) => o.v === i.remind)?.label.replace(
                  "Avisar ",
                  "",
                ) ?? ""}
              </span>
            )}
            {due && (
              <span
                className={cn(
                  "font-semibold",
                  due.tone === "late"
                    ? "text-danger"
                    : due.tone === "soon"
                      ? "text-[#b07800]"
                      : "text-ink-muted",
                )}
              >
                {due.text}
              </span>
            )}
            {i.repeat && (
              <span className="inline-flex items-center gap-0.5 text-ink-muted">
                <RepeatIcon aria-hidden className="size-3" />
                {REPEATS.find((r) => r.id === i.repeat)?.label}
              </span>
            )}
            {i.group && (
              <span className="rounded-full bg-surface-sunken px-1.5 text-ink-muted">
                {i.group}
              </span>
            )}
          </p>
        )}
      </div>
      {!i.done && (i.kind ?? "tarea") === "tarea" && (
        <button
          type="button"
          title="Cambiar la prioridad"
          onClick={() =>
            act.patch(i.id, {
              meta: PRIORITIES[
                (PRIORITIES.findIndex((x) => x.id === p.id) + 1) % 3
              ].id,
            })
          }
          className="mt-0.5 shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-semibold text-white"
          style={{ background: p.color }}
        >
          {p.name}
        </button>
      )}
      <span className="mt-0.5 hidden shrink-0 items-center group-hover/it:flex group-focus-within/it:flex [@media(hover:none)]:flex">
        <label
          title="Fecha"
          className="relative grid size-6 cursor-pointer place-items-center rounded text-ink-faint hover:text-ink"
        >
          <AlarmClock aria-hidden className="size-3.5" />
          <input
            type="date"
            value={i.due ?? ""}
            onChange={(e) =>
              act.patch(i.id, {
                due: (e.target.value || undefined) as DateKey | undefined,
              })
            }
            aria-label={`Fecha de ${i.text}`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <button
          type="button"
          aria-label={`Borrar ${i.text}`}
          onClick={() => act.remove(i.id)}
          className="grid size-6 place-items-center rounded text-ink-faint hover:text-danger"
        >
          <Trash2 aria-hidden className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

/** Sumar un pendiente. Entiende la fecha y la repetición en el texto ("pagar la luz el 10", "sacar la basura todos los días"). */
function PendingAddForm({
  list,
  group,
  wide,
}: {
  list: UserList;
  group: string | null;
  wide?: boolean;
}) {
  const setItems = usePlanner((s) => s.setListItems);
  const [text, setText] = useState("");
  const [meta, setMeta] = useState("");
  const [creatingGroup, setCreatingGroup] = useState<string | null>(null);
  const updateList = usePlanner((s) => s.updateList);
  const [due, setDue] = useState<string>("");
  const [repeat, setRepeat] = useState<Repeat | "">("");
  const [itemGroup, setItemGroup] = useState<string>("");
  useEffect(() => setItemGroup(group ?? ""), [group]);
  const t = today();
  const parsed = text.trim() ? parseLogro(text) : null;
  const guessDue = parsed?.date && parsed.date >= t ? parsed.date : null;
  const [kind, setKind] = useState<string>("");
  const [newKind, setNewKind] = useState(false);
  const [at, setAt] = useState("");
  const [remind, setRemind] = useState("1440");
  const kinds = allKinds(list.customKinds).filter((x) => x.id !== "feriado");
  const [since, setSince] = useState("");
  const guessedKind = text.trim() ? guessKind(text) : null;
  const k = kind || guessedKind || "tarea";
  const guessRepeat: Repeat | null = parsed?.repeat
    ? parsed.repeat.length >= 5
      ? "diaria"
      : "semanal"
    : (KIND_REPEAT[k as ReminderKind] ?? null);
  const guessAt = parsed?.start ?? null;
  const atMin = at
    ? Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5))
    : guessAt;
  const add = () => {
    const raw = text.trim();
    if (!raw) return;
    const useParsed = (guessDue || guessRepeat) && parsed?.text;
    const r = (repeat || guessRepeat || undefined) as Repeat | undefined;
    let d = (due || guessDue || undefined) as DateKey | undefined;
    if (r && !d) d = t;
    const y = Number(since);
    setItems(list.id, [
      ...list.items,
      {
        id: newId(),
        text: useParsed ? parsed!.text : raw,
        meta: meta || "media",
        due: d,
        repeat: r,
        group: k === "tarea" ? itemGroup || undefined : undefined,
        kind: k === "tarea" ? undefined : k,
        since: y > 1900 && y < 2100 ? y : undefined,
        at: atMin ?? undefined,
        remind: remind === "" ? undefined : Number(remind),
      },
    ]);
    setKind("");
    setSince("");
    setAt("");
    setRemind("1440");
    play("pop");
    setText("");
    setDue("");
    setRepeat("");
    setMeta("");
  };
  const ctl =
    "h-6 rounded-full border border-line bg-surface px-1.5 text-[10.5px] text-ink-muted focus:border-ink focus:outline-none";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="flex shrink-0 flex-col gap-1.5 border-t border-line p-2"
    >
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Algo para recordar… (podés poner la fecha)"
          aria-label="Nuevo recordatorio"
          className="h-8 min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 text-[11.5px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Agregar"
          className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-ink text-surface disabled:opacity-25"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
      {/* Prioridad, fecha, repetición y grupo: aparecen al escribir (en grande, siempre). */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1",
          !wide && !text.trim() && "hidden",
        )}
      >
        <select
          value={k}
          onChange={(e) =>
            e.target.value === "__nuevo"
              ? setNewKind(true)
              : setKind(e.target.value)
          }
          aria-label="Tipo"
          className={cn(ctl, k !== "tarea" && "border-ink text-ink")}
        >
          {kinds.map((x) => (
            <option key={x.id} value={x.id}>
              {x.emoji} {x.name}
            </option>
          ))}
          <option value="__nuevo">+ Nuevo tipo…</option>
        </select>
        {newKind && (
          <KindForm
            used={allKinds(list.customKinds).map((x) => x.color)}
            onSave={(def) => {
              updateList(list.id, {
                customKinds: [...(list.customKinds ?? []), def],
              });
              setKind(def.id);
              setNewKind(false);
            }}
            onCancel={() => setNewKind(false)}
          />
        )}
        {(k === "cumple" || k === "aniversario") && (
          <input
            inputMode="numeric"
            value={since}
            onChange={(e) =>
              setSince(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder={k === "cumple" ? "Año de nacimiento" : "Desde qué año"}
            aria-label={k === "cumple" ? "Año de nacimiento" : "Desde qué año"}
            className={cn(ctl, "w-36")}
          />
        )}
        {k === "tarea" && (
          <select
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            aria-label="Importancia"
            className={cn(ctl, meta && "border-ink text-ink")}
          >
            <option value="" disabled hidden>
              Importancia
            </option>
            {PRIORITY_CHOICES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={due || guessDue || ""}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Fecha límite"
          className={cn(ctl, (due || guessDue) && "border-ink text-ink")}
        />
        <select
          value={repeat || guessRepeat || ""}
          onChange={(e) => setRepeat(e.target.value as Repeat | "")}
          aria-label="Repetir"
          className={cn(ctl, (repeat || guessRepeat) && "border-ink text-ink")}
        >
          <option value="">No se repite</option>
          {REPEATS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="time"
          step={900}
          value={
            at ||
            (guessAt !== null
              ? `${String(Math.floor(guessAt / 60)).padStart(2, "0")}:${String(guessAt % 60).padStart(2, "0")}`
              : "")
          }
          onChange={(e) => setAt(e.target.value)}
          aria-label="Hora"
          className={cn(ctl, atMin !== null && "border-ink text-ink")}
        />
        <select
          value={remind}
          onChange={(e) => setRemind(e.target.value)}
          aria-label="Avisar"
          className={cn(ctl, remind !== "" && "border-ink text-ink")}
        >
          <option value="">Sin aviso</option>
          {REMIND_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              🔔 {o.label}
            </option>
          ))}
        </select>
        {k !== "tarea" ? null : creatingGroup !== null ? (
          <input
            autoFocus
            value={creatingGroup}
            onChange={(e) => setCreatingGroup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCreatingGroup(null);
              if (e.key !== "Enter") return;
              e.preventDefault();
              e.currentTarget.blur();
            }}
            onBlur={() => {
              const n = creatingGroup.trim();
              if (n) {
                if (!(list.groups ?? []).includes(n))
                  updateList(list.id, { groups: [...(list.groups ?? []), n] });
                setItemGroup(n);
              }
              setCreatingGroup(null);
            }}
            placeholder="Nombre del grupo"
            aria-label="Nuevo grupo"
            className={cn(ctl, "w-32 border-ink text-ink")}
          />
        ) : (
          <select
            value={itemGroup}
            onChange={(e) =>
              e.target.value === "__nuevo"
                ? setCreatingGroup("")
                : setItemGroup(e.target.value)
            }
            aria-label="Grupo"
            className={cn(ctl, itemGroup && "border-ink text-ink")}
          >
            <option value="">Sin grupo</option>
            {(list.groups ?? []).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value="__nuevo">+ Nuevo grupo…</option>
          </select>
        )}
      </div>
    </form>
  );
}

const MONTH = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});

/** Recordatorios en grande: la lista a la izquierda y el calendario del mes a la derecha (arrastrá un pendiente a un día para fecharlo). */
function PendingExpanded({
  list,
  isMobile,
  onClose,
}: {
  list: UserList;
  isMobile: boolean;
  onClose: () => void;
}) {
  const act = usePendingActions(list);
  const updateList = usePlanner((s) => s.updateList);
  const hiddenKinds = list.hiddenKinds ?? [];
  const [managing, setManaging] = useState(false);
  // Mover uno que se repite: ¿solo este o todos?
  const [moveAsk, setMoveAsk] = useState<{ id: string; date: DateKey } | null>(
    null,
  );
  const setItems = usePlanner((s) => s.setListItems);
  const moveTo = (id: string, d: DateKey) => {
    const it = list.items.find((x) => x.id === id);
    if (it?.repeat && it.due && it.due !== d)
      return setMoveAsk({ id, date: d });
    act.patch(id, { due: d });
    play("bubble");
  };
  const moveOnlyThis = () => {
    if (!moveAsk) return;
    const it = list.items.find((x) => x.id === moveAsk.id);
    if (it) {
      // Una copia suelta en el día nuevo; el que se repite sigue con su fecha siguiente.
      const copy = { ...it, id: newId(), due: moveAsk.date, repeat: undefined };
      setItems(list.id, [
        ...list.items.map((x) =>
          x.id === it.id ? { ...x, due: nextDue(x) } : x,
        ),
        copy,
      ]);
      play("bubble");
    }
    setMoveAsk(null);
  };
  const toggleKind = (id: string) => {
    play("click");
    updateList(list.id, {
      hiddenKinds: hiddenKinds.includes(id)
        ? hiddenKinds.filter((x) => x !== id)
        : [...hiddenKinds, id],
    });
  };
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [over, setOver] = useState<string | null>(null);
  const t = today();
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells: (DateKey | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysIn }, (_, k) =>
      toKey(new Date(month.getFullYear(), month.getMonth(), k + 1)),
    ),
  ];
  while (cells.length % 7) cells.push(null);
  return (
    <Sheet
      isMobile={isMobile}
      onClose={onClose}
      labelledBy="pending-big-title"
      width="max-w-[1120px]"
    >
      <div className="flex h-[min(86dvh,820px)] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2
            id="pending-big-title"
            className="type-headline flex items-center gap-2"
          >
            <ClipboardList aria-hidden className="size-5 text-ink-muted" />
            {list.title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-col border-line max-lg:h-1/2 max-lg:border-b lg:w-[380px] lg:shrink-0 lg:border-r">
            <PendingList list={list} wide />
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col p-3">
            {managing && (
              <KindsManager list={list} onClose={() => setManaging(false)} />
            )}
            {moveAsk && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-ink/20 p-4">
                <div
                  role="dialog"
                  aria-labelledby="move-ask-title"
                  className="animate-fade-up w-full max-w-[340px] rounded-2xl bg-surface p-4 shadow-[var(--shadow-popover)]"
                >
                  <p id="move-ask-title" className="text-[14px] font-semibold">
                    Este recordatorio se repite
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    ¿Lo movés solo esta vez o cambiás todos los que vienen?
                  </p>
                  <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMoveAsk(null)}
                      className="pressable h-9 rounded-full px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface-sunken"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={moveOnlyThis}
                      className="pressable h-9 rounded-full px-3.5 text-[12.5px] font-semibold ring-1 ring-line hover:bg-surface-sunken"
                    >
                      Solo este
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        act.patch(moveAsk.id, { due: moveAsk.date });
                        play("bubble");
                        setMoveAsk(null);
                      }}
                      className="pressable h-9 rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-surface"
                    >
                      Todos
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="mb-2 flex items-center gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
                className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <p className="min-w-[150px] text-center text-[14px] font-semibold">
                {MONTH.format(month).replace(/^./, (c) => c.toUpperCase())}
              </p>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
                className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
              <p className="ml-auto text-[10.5px] text-ink-muted max-sm:hidden">
                Arrastrá un recordatorio a un día para ponerle fecha.
              </p>
            </div>
            {/* Qué tipos se ven en el calendario (y en la lista). */}
            <div
              role="group"
              aria-label="Tipos que se muestran"
              className="mb-2 flex flex-wrap gap-1"
            >
              {allKinds(list.customKinds).map((k) => {
                const on = !hiddenKinds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleKind(k.id)}
                    className={cn(
                      "pressable inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-medium transition-colors duration-150",
                      on
                        ? "border-transparent text-ink"
                        : "border-line text-ink-faint line-through",
                    )}
                    style={
                      on
                        ? {
                            background: `color-mix(in oklab, ${k.color} 14%, var(--color-surface))`,
                          }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors",
                        on ? "" : "bg-ink/15",
                      )}
                      style={on ? { background: k.color } : undefined}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-2.5 rounded-full bg-white transition-[left] duration-150",
                          on ? "left-[12px]" : "left-0.5",
                        )}
                      />
                    </span>
                    {k.emoji} {k.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setManaging(true)}
                className="pressable inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-semibold text-ink-muted ring-1 ring-line hover:text-ink hover:ring-ink"
              >
                <Plus aria-hidden className="size-3.5" />
                Configurar tipos
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[9.5px] font-semibold text-ink-faint uppercase">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1">
              {cells.map((d, k) => {
                if (!d) return <div key={`e${k}`} />;
                const tasks = list.items.filter(
                  (i) =>
                    i.due === d &&
                    !(list.hideDone && i.done) &&
                    !hiddenKinds.includes(i.kind ?? "tarea"),
                );
                const hols = hiddenKinds.includes("feriado")
                  ? []
                  : visibleHolidays(list, d, d);
                return (
                  <div
                    key={d}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOver(d);
                    }}
                    onDragLeave={() => setOver((o) => (o === d ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/pending");
                      if (id) moveTo(id, d);
                      setOver(null);
                    }}
                    className={cn(
                      "flex min-h-0 flex-col gap-0.5 overflow-hidden rounded-lg border p-1 transition-colors duration-100",
                      d === t ? "border-ink bg-ink/[0.04]" : "border-line",
                      d < t && "bg-surface-sunken/50",
                      over === d && "border-ink bg-ink/10",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        d === t ? "text-ink" : "text-ink-muted",
                        hols.some((h) => h.feriado) && "text-[#0e7490]",
                      )}
                    >
                      {fromKey(d).getDate()}
                    </span>
                    {hols.map((h) => (
                      <span
                        key={h.name}
                        title={h.feriado ? `Feriado: ${h.name}` : h.name}
                        className="group/h flex items-center gap-0.5 rounded px-1 text-[9.5px] leading-[15px] font-medium text-[#0e7490]"
                        style={{
                          background:
                            "color-mix(in oklab, #0891b2 12%, transparent)",
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {h.name}
                        </span>
                        <HideHoliday list={list} name={h.orig} date={h.date} />
                      </span>
                    ))}
                    {tasks.slice(0, 4).map((i) => (
                      <span
                        key={i.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/pending", i.id)
                        }
                        title={i.text}
                        className={cn(
                          "flex cursor-grab items-center gap-1 truncate rounded px-1 text-[9.5px] leading-[16px]",
                          i.done
                            ? "text-ink-faint line-through"
                            : isOverdue(i, t)
                              ? "bg-danger/10 text-danger"
                              : "bg-surface-sunken",
                        )}
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{
                            background:
                              (i.kind ?? "tarea") === "tarea"
                                ? priorityOf(i).color
                                : kindInfo(i.kind, list.customKinds).color,
                          }}
                        />
                        <span className="truncate">{i.text}</span>
                      </span>
                    ))}
                    {tasks.length > 4 && (
                      <span className="text-[9.5px] text-ink-faint">
                        +{tasks.length - 4} más
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

const ALERT_KEY = "lb:pending-alert";

/**
 * En el tablero: si hay pendientes vencidos o para hoy, un aviso abajo a la izquierda (una vez por día, o
 * hasta que lo cierres) para marcarlos, pasarlos para hoy o posponerlos sin abrir nada.
 */
export function PendingAlerts({ compact }: { compact?: boolean }) {
  const list = usePlanner((s) => s.lists.find((l) => l.type === "pendientes"));
  const [seen, setSeen] = useState<string[] | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(ALERT_KEY) ?? "[]");
      setSeen(Array.isArray(v) ? v : []);
    } catch {
      setSeen([]);
    }
    const id = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const t = today();
  // Cada recordatorio avisa dos veces: antes (lo que elegiste, por defecto un día antes) y en el momento.
  const key = (i: ListItem) => {
    const at = i.due ? fromKey(i.due) : new Date();
    at.setMinutes(i.at ?? 9 * 60);
    return `${i.id}@${i.due}@${new Date() >= at ? "ahora" : "antes"}`;
  };
  const urgent = (list?.items.filter((i) => isUrgent(i, t)) ?? []).filter(
    (i) => !seen?.includes(key(i)),
  );
  if (!list || !seen || !urgent.length) return null;
  const close = () => {
    const next = [...seen, ...urgent.map(key)].slice(-200);
    try {
      localStorage.setItem(ALERT_KEY, JSON.stringify(next));
    } catch {}
    setSeen(next);
  };
  return <AlertsToast list={list} urgent={urgent} onClose={close} compact={compact} />;
}

function AlertsToast({
  list,
  urgent,
  onClose,
  compact,
}: {
  list: UserList;
  urgent: ListItem[];
  onClose: () => void;
  compact?: boolean;
}) {
  const act = usePendingActions(list);
  const late = urgent.filter((i) => isOverdue(i)).length;
  return (
    <div
      role="status"
      className={cn("animate-fade-up z-[70] rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-popover)]", compact ? "fixed top-14 right-3 left-3" : "absolute top-full left-0 mt-2 w-[360px]")}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            late
              ? "bg-danger/10 text-danger"
              : "bg-[color-mix(in_oklab,#d99a00_16%,transparent)] text-[#8a6200]",
          )}
        >
          <Bell aria-hidden className="size-4" />
        </span>
        <p className="min-w-0 flex-1 pt-1 text-[11.5px] font-semibold">
          {late
            ? `Tenés ${late} ${late === 1 ? "recordatorio vencido" : "recordatorios vencidos"}`
            : `Hoy vence${urgent.length > 1 ? "n" : ""} ${urgent.length} ${urgent.length === 1 ? "recordatorio" : "recordatorios"}`}
        </p>
        <button
          type="button"
          aria-label="Más tarde"
          title="Más tarde"
          onClick={onClose}
          className="pressable grid size-7 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <ul className="mt-2 flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
        {urgent.slice(0, 6).map((i) => (
          <li
            key={i.id}
            className="rounded-xl bg-surface-sunken/70 px-2.5 py-2"
          >
            <p className="text-[11px] leading-snug font-medium [overflow-wrap:anywhere]">
              {i.text}
            </p>
            <p
              className={cn(
                "text-[10px] font-semibold",
                dueLabel(i)?.tone === "late" ? "text-danger" : "text-[#b07800]",
              )}
            >
              {dueLabel(i)?.text}
            </p>
            <PostponeButtons item={i} act={act} full />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Un tipo de recordatorio nuevo: nombre, un emoji y un color propio (los que ya usa otro tipo no se ofrecen). */
function KindForm({
  used,
  onSave,
  onCancel,
  initial,
}: {
  used: string[];
  onSave: (def: KindDef) => void;
  onCancel: () => void;
  initial?: KindDef;
}) {
  const free = KIND_COLORS.filter(
    (c) => !used.includes(c) || c === initial?.color,
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "⭐");
  const [color, setColor] = useState(
    initial?.color ?? free[0] ?? KIND_COLORS[0],
  );
  const save = () => {
    const n = name.trim();
    if (!n) return;
    onSave({
      id: initial?.id ?? `k-${newId()}`,
      name: n,
      emoji: emoji.trim() || "⭐",
      color,
    });
  };
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-ink/20 bg-surface p-2">
      <div className="flex gap-1.5">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
          aria-label="Ícono (emoji)"
          className="h-8 w-11 rounded-lg border border-line bg-surface text-center text-[15px] focus:border-ink focus:outline-none"
        />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Nombre del tipo (Facultad, Viajes…)"
          aria-label="Nombre del tipo"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[11px] focus:border-ink focus:outline-none"
        />
      </div>
      <div
        role="radiogroup"
        aria-label="Color"
        className="flex flex-wrap items-center gap-1"
      >
        {free.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={cn(
              "size-6 rounded-full ring-offset-2 ring-offset-surface",
              color === c && "ring-2 ring-ink",
            )}
            style={{ background: c }}
          />
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="pressable h-7 rounded-full px-2.5 text-[10.5px] font-medium text-ink-muted hover:bg-surface-sunken"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!name.trim()}
          className="pressable h-7 rounded-full bg-ink px-3 text-[10.5px] font-semibold text-surface disabled:opacity-30"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

/** Configurar los tipos: mostrar u ocultar cada uno, crear los tuyos y cambiarles nombre, ícono o color. */
function KindsManager({
  list,
  onClose,
}: {
  list: UserList;
  onClose: () => void;
}) {
  const updateList = usePlanner((s) => s.updateList);
  const hidden = list.hiddenKinds ?? [];
  const custom = list.customKinds ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [fechas, setFechas] = useState(false);
  const toggle = (id: string) =>
    updateList(list.id, {
      hiddenKinds: hidden.includes(id)
        ? hidden.filter((x) => x !== id)
        : [...hidden, id],
    });
  const builtIn = (id: string) => KIND_IDS.includes(id);
  if (fechas)
    return <HolidaysEditor list={list} onBack={() => setFechas(false)} />;
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[14px] font-semibold">Tipos de recordatorio</p>
        <button
          type="button"
          onClick={onClose}
          className="pressable h-8 rounded-full bg-ink px-3.5 text-[11px] font-semibold text-surface"
        >
          Listo
        </button>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {allKinds(custom).map((k) => {
          const mine = custom.some((c) => c.id === k.id);
          return (
            <li
              key={k.id}
              className="rounded-lg border border-line px-2.5 py-1.5"
            >
              {editing === k.id ? (
                <KindForm
                  initial={k}
                  used={allKinds(custom).map((x) => x.color)}
                  onSave={(def) => {
                    // Los de siempre se guardan como propios con su mismo id (los reemplazan).
                    updateList(list.id, {
                      customKinds: custom.some((c) => c.id === def.id)
                        ? custom.map((c) => (c.id === def.id ? def : c))
                        : [...custom, def],
                    });
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full text-[11.5px]"
                    style={{
                      background: `color-mix(in oklab, ${k.color} 18%, var(--color-surface))`,
                    }}
                  >
                    {k.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">
                    {k.name}
                  </span>
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: k.color }}
                  />
                  {k.id === "feriado" && (
                    <button
                      type="button"
                      onClick={() => setFechas(true)}
                      className="pressable h-7 rounded-full px-2 text-[10.5px] font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    >
                      Ver fechas
                    </button>
                  )}
                  {k.id !== "feriado" && builtIn(k.id) && (
                    <button
                      type="button"
                      onClick={() => setEditing(k.id)}
                      className="pressable h-7 rounded-full px-2 text-[10.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    >
                      Editar
                    </button>
                  )}
                  {mine && !builtIn(k.id) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(k.id)}
                        className="pressable h-7 rounded-full px-2 text-[10.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          window.confirm(
                            `¿Borrar el tipo «${k.name}»? Sus recordatorios pasan a Tareas.`,
                          ) &&
                          updateList(list.id, {
                            customKinds: custom.filter((c) => c.id !== k.id),
                            items: list.items.map((i) =>
                              i.kind === k.id ? { ...i, kind: undefined } : i,
                            ),
                          })
                        }
                        className="pressable h-7 rounded-full px-2 text-[10.5px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-danger"
                      >
                        Borrar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!hidden.includes(k.id)}
                    aria-label={`Mostrar ${k.name}`}
                    onClick={() => toggle(k.id)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      hidden.includes(k.id) ? "bg-ink/15" : "",
                    )}
                    style={
                      hidden.includes(k.id)
                        ? undefined
                        : { background: k.color }
                    }
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-150",
                        hidden.includes(k.id) ? "left-0.5" : "left-[18px]",
                      )}
                    />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {(list.hiddenHolidays ?? []).length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[10.5px] text-ink-muted">
          Fechas quitadas:{" "}
          {(list.hiddenHolidays ?? [])
            .map((h) => h.replace(/@(\d{4})-\d{2}-\d{2}$/, " ($1)"))
            .join(", ")}
          <button
            type="button"
            onClick={() => updateList(list.id, { hiddenHolidays: [] })}
            className="font-semibold text-ink underline underline-offset-2"
          >
            Volver a mostrarlas
          </button>
        </p>
      )}
      <NewKindRow list={list} />
    </div>
  );
}

const KIND_IDS = KINDS.map((k) => k.id as string);

/**
 * Los feriados y fechas especiales del año: cada uno se puede quitar (solo este año o siempre), volver a
 * mostrar o cambiarle el nombre.
 */
function HolidaysEditor({
  list,
  onBack,
}: {
  list: UserList;
  onBack: () => void;
}) {
  const updateList = usePlanner((s) => s.updateList);
  const year = new Date().getFullYear();
  const hidden = list.hiddenHolidays ?? [];
  const names = list.holidayNames ?? {};
  const country = usePlanner((s) => s.country);
  const setCountry = usePlanner((s) => s.setCountry);
  const all = holidays(year, country);
  const isHidden = (h: { name: string; date: DateKey }) =>
    hidden.includes(h.name) || hidden.includes(`${h.name}@${h.date}`);
  const toggleHidden = (h: { name: string; date: DateKey }) =>
    updateList(list.id, {
      hiddenHolidays: isHidden(h)
        ? hidden.filter((x) => x !== h.name && x !== `${h.name}@${h.date}`)
        : [...hidden, h.name],
    });
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[14px] font-semibold">
          Feriados y fechas especiales · {year}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="pressable h-8 rounded-full bg-ink px-3.5 text-[11px] font-semibold text-surface"
        >
          Volver
        </button>
      </div>
      <label className="mb-2 flex items-center gap-2 text-[11.5px] text-ink-muted">
        País
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-7 rounded-full border border-line bg-surface px-2 text-[11.5px] text-ink focus:border-ink focus:outline-none"
        >
          {COUNTRIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mb-2 text-[11px] text-ink-muted">
        Tocá el nombre para cambiarlo. El interruptor lo muestra u oculta en tus
        recordatorios y el calendario.
      </p>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {all.map((h) => (
          <li
            key={h.date + h.name}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5",
              isHidden(h) && "opacity-50",
            )}
          >
            <span className="w-14 shrink-0 text-[10.5px] font-semibold text-[#0e7490] tabular-nums">
              {dayShort.format(fromKey(h.date))}
            </span>
            <input
              defaultValue={names[h.name] ?? h.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== (names[h.name] ?? h.name))
                  updateList(list.id, {
                    holidayNames: { ...names, [h.name]: v },
                  });
              }}
              aria-label={`Nombre de ${h.name}`}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12px] hover:border-line focus:border-ink focus:outline-none"
            />
            {h.feriado && (
              <span className="shrink-0 rounded-full bg-[#0891b2]/15 px-1.5 text-[9.5px] font-semibold text-[#0e7490]">
                Feriado
              </span>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={!isHidden(h)}
              aria-label={`Mostrar ${h.name}`}
              onClick={() => toggleHidden(h)}
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                isHidden(h) ? "bg-ink/15" : "bg-[#0891b2]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-150",
                  isHidden(h) ? "left-0.5" : "left-[18px]",
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewKindRow({ list }: { list: UserList }) {
  const updateList = usePlanner((s) => s.updateList);
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="mt-2">
      <KindForm
        used={allKinds(list.customKinds).map((x) => x.color)}
        onSave={(def) => {
          updateList(list.id, {
            customKinds: [...(list.customKinds ?? []), def],
          });
          setOpen(false);
          play("pop");
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="pressable mt-2 inline-flex h-9 items-center justify-center gap-1 rounded-full border border-dashed border-ink/30 text-[11px] font-semibold text-ink-muted hover:text-ink"
    >
      <Plus aria-hidden className="size-4" />
      Nuevo tipo
    </button>
  );
}

/** Los feriados y fechas especiales que no ocultaste. */
function visibleHolidays(list: UserList, from: DateKey, to: DateKey) {
  const hidden = list.hiddenHolidays ?? [];
  const names = list.holidayNames ?? {};
  return holidaysBetween(from, to, usePlanner.getState().country)
    .filter(
      (h) =>
        !hidden.includes(h.name) && !hidden.includes(`${h.name}@${h.date}`),
    )
    .map((h) => ({ ...h, name: names[h.name] ?? h.name, orig: h.name }));
}

/** Quitar un feriado o fecha especial: solo este año o para siempre. */
function HideHoliday({
  list,
  name,
  date,
}: {
  list: UserList;
  name: string;
  date: DateKey;
}) {
  const updateList = usePlanner((s) => s.updateList);
  const [ask, setAsk] = useState(false);
  // El menú flota por fuera de la celda (no queda cortado): va al diálogo abierto o a la página.
  const [pos, setPos] = useState<{ host: HTMLElement; top: number; left: number } | null>(null);
  const open = (btn: HTMLElement) => {
    if (ask) return setAsk(false);
    const host = (btn.closest("dialog") as HTMLElement | null) ?? document.body;
    const r = btn.getBoundingClientRect();
    // Si el diálogo está transformado, lo fijo se mide desde el diálogo.
    const box = host !== document.body && getComputedStyle(host).transform !== "none" ? host.getBoundingClientRect() : { top: 0, left: 0 };
    setPos({ host, top: r.bottom + 4 - box.top, left: Math.max(8, Math.min(r.right - 176, window.innerWidth - 184)) - box.left });
    setAsk(true);
  };
  useEffect(() => {
    if (!ask) return;
    const close = (e: PointerEvent) => !(e.target as HTMLElement).closest("[data-hide-holiday]") && setAsk(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [ask]);
  const hide = (key: string) => {
    updateList(list.id, {
      hiddenHolidays: [...(list.hiddenHolidays ?? []), key],
    });
    play("delete");
    setAsk(false);
  };
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label={`Quitar ${name}`}
        title="Quitar"
        onClick={(e) => open(e.currentTarget)}
        className="grid size-4 place-items-center rounded text-[#0e7490]/70 opacity-0 group-hover/h:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <X aria-hidden className="size-3" />
      </button>
      {ask && pos && createPortal(
        <span data-hide-holiday style={{ top: pos.top, left: pos.left }} className="animate-fade-up fixed z-[300] flex w-44 flex-col rounded-xl border border-line bg-surface p-1 text-ink shadow-[var(--shadow-popover)]">
          <span className="px-2 pt-1 pb-1 text-[10.5px] font-semibold">
            Quitar «{name}»
          </span>
          <button
            type="button"
            onClick={() => hide(`${name}@${date}`)}
            className="rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-surface-sunken"
          >
            Solo este año
          </button>
          <button
            type="button"
            onClick={() => hide(name)}
            className="rounded-md px-2 py-1.5 text-left text-[11px] text-danger hover:bg-danger/10"
          >
            Para siempre
          </button>
        </span>,
        pos.host,
      )}
    </span>
  );
}

/**
 * Arriba, al lado de «Mis listas»: la ficha «Recordatorios» (abre la vista grande) con la campanita de lo que
 * vence hoy (o ya venció) y, en otro color, lo de los próximos 7 días; y un campo para sumar uno rápido. Las
 * opciones del campo flotan debajo, sin ocupar lugar.
 */
export function RemindersChip({ compact }: { compact?: boolean }) {
  const list = usePlanner((s) => s.lists.find((l) => l.type === "pendientes"));
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [big, setBig] = useState(false);
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [due, setDue] = useState("");
  const [kind, setKind] = useState("");
  const [remind, setRemind] = useState("1440");
  const t = today();
  const setupDone = usePlanner((s) => s.setupDone);
  // Lo que viene: de mañana a 4 días.
  const week = toKey(addDays(new Date(), 4));
  const open = list?.items.filter((i) => !i.done && i.due) ?? [];
  const now = open.filter((i) => i.due! <= t);
  const soon = open.filter((i) => i.due! > t && i.due! <= week);
  const custom = list?.customKinds ?? [];
  // Lo que viene, por tipo (corazón 1, pago 2…), para el título de la ficha.
  const byKind = [...now, ...soon].reduce<Record<string, number>>(
    (acc, i) => ({
      ...acc,
      [i.kind ?? "tarea"]: (acc[i.kind ?? "tarea"] ?? 0) + 1,
    }),
    {},
  );
  const summary = Object.entries(byKind)
    .map(([k, n]) => `${kindInfo(k, custom).emoji} ${n}`)
    .join("  ");

  const parsed = text.trim() ? parseLogro(text) : null;
  const guessDue = parsed?.date && parsed.date >= t ? parsed.date : "";
  const k = kind || guessKind(text) || "tarea";
  const ensureList = () => {
    const s = usePlanner.getState();
    const l = s.lists.find((x) => x.type === "pendientes");
    if (l) return l;
    s.addList("pendientes", "Recordatorios");
    return usePlanner.getState().lists.find((x) => x.type === "pendientes")!;
  };
  const add = () => {
    const raw = text.trim();
    if (!raw) return;
    const l = ensureList();
    const r = parsed?.repeat
      ? parsed.repeat.length >= 5
        ? "diaria"
        : "semanal"
      : (KIND_REPEAT[k as ReminderKind] ?? undefined);
    let d = (due || guessDue || undefined) as DateKey | undefined;
    if (r && !d) d = t;
    usePlanner
      .getState()
      .setListItems(l.id, [
        ...l.items,
        {
          id: newId(),
          text:
            (guessDue || parsed?.repeat) && parsed?.text ? parsed.text : raw,
          meta: "media",
          due: d,
          repeat: r as Repeat | undefined,
          kind: k === "tarea" ? undefined : k,
          at: parsed?.start ?? undefined,
          remind: d ? Number(remind) : undefined,
        },
      ]);
    play("pop");
    setText("");
    setDue("");
    setKind("");
    setRemind("1440");
  };
  const ctl =
    "h-7 rounded-full border border-line bg-surface px-2 text-[11px] text-ink focus:border-ink focus:outline-none";

  return (
    <div className="relative">
      {/* Una sola ficha: la campanita con «Recordatorios» y, pegado, el campo para sumar uno. */}
      <div className={cn("flex items-center rounded-full", !compact && "bg-surface/80 shadow-[var(--shadow-card)] ring-1 ring-transparent focus-within:bg-surface focus-within:ring-ink/15")}>
        <button
          type="button"
          data-tour="recordatorios-chip"
          title={summary ? `Lo que viene: ${summary}` : "Tus recordatorios"}
          onClick={() => {
            ensureList();
            play("open");
            setBig(true);
          }}
          aria-label={compact ? "Recordatorios" : undefined}
          className={cn("pressable relative flex items-center gap-2 rounded-full whitespace-nowrap", compact ? "size-8 justify-center" : "py-2 pr-2.5 pl-3.5 text-[13px] font-medium hover:bg-surface")}
        >
          {!compact && "Recordatorios"}
          <Bell aria-hidden className={cn("size-4 origin-top", now.length ? "text-danger" : "text-ink-muted", (now.length > 0 || soon.length > 0) && "motion-safe:animate-[bell-ring_2.6s_ease-in-out_infinite]")} />
          {/* Los numeritos: en rojo lo de hoy (o vencido), en amarillo lo de los próximos días. */}
          <span className={cn("flex items-center gap-0.5", compact && "absolute -top-1 -right-1")}>
            {now.length > 0 && (
              <span aria-label={`${now.length} para hoy o vencidos`} className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9.5px] font-bold text-white tabular-nums">
                {now.length}
              </span>
            )}
            {soon.length > 0 && (!compact || !now.length) && (
              <span aria-label={`${soon.length} en los próximos días`} className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e3a008] px-1 text-[9.5px] font-bold text-white tabular-nums">
                {soon.length}
              </span>
            )}
          </span>
        </button>
        {!compact && (
          <div className="relative flex items-center border-l border-line" onFocus={() => setFocus(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocus(false)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
              className="flex items-center"
            >
              <Plus aria-hidden className="pointer-events-none absolute left-2.5 size-3.5 text-ink-faint" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Agregar un recordatorio"
                aria-label="Agregar un recordatorio"
                className="h-9 w-[222px] rounded-r-full bg-transparent pr-9 pl-7 text-[12.5px] placeholder:text-ink-faint focus:outline-none max-[1279px]:w-[176px]"
              />
              <button type="submit" disabled={!text.trim()} aria-label="Guardar recordatorio" className="pressable absolute right-1 grid size-7 place-items-center rounded-full bg-ink text-surface disabled:opacity-0">
                <Plus aria-hidden className="size-3.5" />
              </button>
            </form>
            {focus && text.trim() && (
              <div className="animate-fade-up absolute top-full left-0 z-[60] mt-2 w-[280px] rounded-2xl border border-line bg-surface p-2.5 shadow-[var(--shadow-popover)]">
                <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-ink-faint uppercase">Opciones</p>
                <div className="flex flex-wrap gap-1.5">
                  <input type="date" value={due || guessDue} min={t} onChange={(e) => setDue(e.target.value)} aria-label="Fecha" className={ctl} />
                  <select value={k} onChange={(e) => setKind(e.target.value)} aria-label="Tipo" className={ctl}>
                    {allKinds(custom)
                      .filter((x) => x.id !== "feriado")
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.emoji} {x.name}
                        </option>
                      ))}
                  </select>
                  <select value={remind} onChange={(e) => setRemind(e.target.value)} aria-label="Avisar" className={ctl}>
                    {REMIND_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-[10.5px] text-ink-muted">Enter para guardarlo. Te avisa también el día y la hora del evento.</p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Al abrir la app, lo que vence (o venció) aparece acá, debajo de la ficha. */}
      {setupDone && !focus && <PendingAlerts compact={compact} />}
      {big && list && <PendingExpanded list={list} isMobile={!desktop} onClose={() => setBig(false)} />}
    </div>
  );
}

/** Cuánto falta para una fecha: «hoy», «mañana», «faltan 5 días». */
function daysLeft(date: DateKey, t: DateKey) {
  const n = Math.round((fromKey(date).getTime() - fromKey(t).getTime()) / 86_400_000);
  return n <= 0 ? "hoy" : n === 1 ? "mañana" : `faltan ${n} días`;
}
