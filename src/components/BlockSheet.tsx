"use client";

import { Plus, Repeat2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { searchActivities } from "@/lib/activities";
import { dayLabel, fromKey, weekdayShort, type DateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { QUADRANT_BY_ID, QUADRANTS as ALL_QUADRANTS, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import { SIMPLE_MODE, SIMPLE_QUADRANTS } from "@/lib/mode";
import { describeRepeat, usePlanner, type Activity, type Block, type Scope } from "@/lib/store";
import { awakeWindow } from "@/lib/sleep";
import { clampStart, formatTime, formatTimeRange } from "@/lib/time";
import { QuadrantIcon } from "./QuadrantIcon";
import { GhostButton, PrimaryButton, Select, Sheet } from "./ui";

export type SheetState =
  | {
      mode: "create";
      date: DateKey;
      start: number;
      activityId?: string;
      minutes?: number;
      /** Si viene de una misión ("Lo agendo después"), el bloque queda vinculado a ella. */
      missionId?: string;
    }
  | { mode: "edit"; id: string };

/** En modo simple, solo Trabajo, Cuerpo, Mente y Alma. */
const QUADRANTS = SIMPLE_MODE ? ALL_QUADRANTS.filter((q) => SIMPLE_QUADRANTS.includes(q.id)) : ALL_QUADRANTS;

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: "this", label: "Solo este evento" },
  { id: "following", label: "Este y los siguientes" },
  { id: "all", label: "Todos los eventos" },
];

/** Id de la actividad "virtual" para bloques viejos cuyo nombre no está en la lista. */
const CURRENT = "__current";

interface BlockSheetProps {
  state: SheetState;
  days: DateKey[];
  isMobile: boolean;
  onClose: () => void;
}

export function BlockSheet({ state, days, isMobile, onClose }: BlockSheetProps) {
  const block = usePlanner((s) =>
    state.mode === "edit" ? s.blocks.find((b) => b.id === state.id) : undefined,
  );
  if (state.mode === "edit" && !block) return null;

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="sheet-title">
      <SheetForm state={state} block={block} days={days} isMobile={isMobile} onClose={onClose} />
    </Sheet>
  );
}

interface SheetFormProps {
  state: SheetState;
  block?: Block;
  days: DateKey[];
  isMobile: boolean;
  onClose: () => void;
}

function SheetForm({ state, block, days, isMobile, onClose }: SheetFormProps) {
  const store = usePlanner();
  const isEdit = state.mode === "edit";
  const create = state.mode === "create" ? state : undefined;
  const series = block?.seriesId ? store.series.find((s) => s.id === block.seriesId) : undefined;

  // La actividad define el cuadrante: no hay que elegirlo aparte.
  const [activityId, setActivityId] = useState<string | undefined>(() => {
    if (create) return create.activityId;
    if (!block) return undefined;
    if (block.activityId && store.activities.some((a) => a.id === block.activityId)) return block.activityId;
    const byName = store.activities.find(
      (a) => a.quadrant === block.quadrant && a.name.toLowerCase() === block.title.toLowerCase(),
    );
    return byName?.id ?? CURRENT;
  });
  const [minutes, setMinutes] = useState<number>(block?.minutes ?? create?.minutes ?? store.lastMinutes);
  const [date, setDate] = useState<DateKey>(block?.date ?? create?.date ?? days[0]);
  const [start, setStart] = useState<number>(block?.start ?? create?.start ?? 9 * 60);
  // Al crear: uno o varios días, y si se repite todas las semanas (en esos días).
  const [selDates, setSelDates] = useState<DateKey[]>(() => [create?.date ?? days[0]]);
  const [weekly, setWeekly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scopeFor, setScopeFor] = useState<"save" | "delete" | null>(null);

  const activity = store.activities.find((a) => a.id === activityId);
  const quadrant: QuadrantId | undefined = activity?.quadrant ?? (activityId === CURRENT ? block?.quadrant : undefined);
  // Si la fecha elegida no está en la semana visible (p. ej. al editar), la sumamos a las opciones.
  const dayOptions = days.includes(date) ? days : [...days, date].sort();

  // Solo horarios despierto: el sueño es fijo.
  const awake = awakeWindow(date, store.sleep);
  // Horario como franja: desde y hasta (de a media hora, solo despierto).
  const fromOptions: number[] = [];
  for (let t = awake.wake; t + 30 <= awake.bed; t += 30) fromOptions.push(t);
  const toOptions: number[] = [];
  for (let t = start + 30; t <= awake.bed; t += 30) toOptions.push(t);
  const changeStart = (s: number) => {
    setStart(s);
    setMinutes((m) => Math.min(m, awake.bed - s));
  };
  const changeDate = (d: DateKey) => {
    setDate(d);
    const w = awakeWindow(d, store.sleep);
    setStart((s) => clampStart(s, minutes, w.wake, w.bed));
  };

  const draft = () => ({
    title: activity?.name ?? block?.title ?? "",
    quadrant: quadrant ?? "cuerpo",
    activityId: activity?.id,
    minutes,
    date,
    start,
  });

  const submit = () => {
    if (!activityId || !quadrant) return setError("Elegí una actividad o creá una nueva");
    if (!isEdit) {
      if (!selDates.length) return setError("Elegí al menos un día");
      const sorted = [...selDates].sort();
      let id: string | undefined;
      if (weekly) {
        // Se repite todas las semanas en esos días de la semana.
        id = store.addBlock({ ...draft(), date: sorted[0] }, [...new Set(sorted.map((d) => fromKey(d).getDay()))]);
      } else {
        for (const d of sorted) id = store.addBlock({ ...draft(), date: d }, null);
      }
      const mission = create?.missionId ? store.missions.find((m) => m.id === create.missionId) : undefined;
      if (mission && id) {
        const blockIds = [...mission.blockIds, id];
        store.updateMission(mission.id, { blockIds, status: blockIds.length >= mission.count ? "scheduled" : "later" });
      }
      onClose();
      return;
    }
    if (!block) return;
    const d = draft();
    const sharedChanged =
      d.title !== block.title || d.quadrant !== block.quadrant || d.minutes !== block.minutes || d.start !== block.start;
    if (series && sharedChanged) {
      setScopeFor("save");
      return;
    }
    store.updateBlock(block.id, d, "this");
    onClose();
  };

  const remove = () => {
    if (!block) return;
    if (series) return setScopeFor("delete");
    if (!confirmDelete) return setConfirmDelete(true);
    store.removeBlock(block.id, "this");
    onClose();
  };

  if (scopeFor && block) {
    return (
      <ScopeStep
        action={scopeFor}
        isMobile={isMobile}
        onCancel={() => setScopeFor(null)}
        onConfirm={(scope) => {
          if (scopeFor === "delete") store.removeBlock(block.id, scope);
          else store.updateBlock(block.id, draft(), scope);
          onClose();
        }}
      />
    );
  }

  return (
    <form
      method="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5 p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="sheet-title" className="type-headline">
            {isEdit ? "Editar bloque" : "Nuevo bloque"}
          </h2>
          <p className="type-body mt-0.5 text-ink-muted first-letter:uppercase tabular-nums">
            {dayLabel(date)} · {formatTimeRange(start, minutes)}
          </p>
          {series && (
            <p className="type-label mt-1.5 inline-flex items-center gap-1 text-ink-muted first-letter:uppercase">
              <Repeat2 aria-hidden className="size-3.5" />
              Se repite {describeRepeat(series.days)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="pressable -mt-1 -mr-2 grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <Field label="Actividad" error={error?.startsWith("Elegí una") ? error : undefined}>
        <ActivityPicker
          activities={store.activities}
          current={isEdit && block && activityId === CURRENT ? block : undefined}
          selectedId={activityId}
          autoFocus={!isEdit && !isMobile}
          onSelect={(id) => {
            setActivityId(id);
            setError(null);
          }}
          onCreate={(q, name) => {
            const a = store.addActivity(q, name);
            setActivityId(a.id);
            setError(null);
          }}
        />
      </Field>

      <Field label="Horario">
        <div className="flex items-center gap-2">
          <Select
            label="Desde"
            value={String(start)}
            onChange={(v) => changeStart(Number(v))}
            options={fromOptions.map((t) => ({ value: String(t), label: formatTime(t) }))}
            className="w-28"
          />
          <span className="text-[13px] text-ink-muted">a</span>
          <Select
            label="Hasta"
            value={String(start + minutes)}
            onChange={(v) => setMinutes(Number(v) - start)}
            options={toOptions.map((t) => ({ value: String(t), label: formatTime(t) }))}
            className="w-28"
          />
          <span className="text-[13px] text-ink-muted tabular-nums">{formatMinutes(minutes)}</span>
        </div>
      </Field>

      <Field label={isEdit ? "Cuándo" : "Qué días"} error={error?.startsWith("Elegí al menos") ? error : undefined}>
        <div className="flex flex-col gap-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${dayOptions.length}, minmax(0, 1fr))` }}>
            {dayOptions.map((d) => {
              const on = isEdit ? d === date : selDates.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={dayLabel(d)}
                  onClick={() => {
                    setError(null);
                    if (isEdit) return changeDate(d);
                    // Varios días a la vez: tocás para sumar o sacar.
                    setSelDates((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));
                    if (!selDates.length) changeDate(d);
                  }}
                  className={cn(
                    "pressable flex h-11 flex-col items-center justify-center rounded-md text-[11px] leading-tight",
                    on ? "bg-ink text-surface" : "bg-surface-sunken text-ink hover:bg-line",
                  )}
                >
                  <span className={cn("capitalize", on ? "text-surface/70" : "text-ink-muted")}>{weekdayShort(d)}</span>
                  <span className="font-semibold tabular-nums">{fromKey(d).getDate()}</span>
                </button>
              );
            })}
          </div>
          {!isEdit && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
              Repetir todas las semanas
              {weekly && selDates.length > 0 && (
                <span className="text-ink-muted">({describeRepeat([...new Set(selDates.map((d) => fromKey(d).getDay()))])})</span>
              )}
            </label>
          )}
        </div>
      </Field>

      <footer className={cn("flex gap-2 pt-1", isMobile ? "flex-col-reverse" : "flex-row items-center")}>
        {isEdit && block && (
          <div className={cn("flex gap-1", isMobile ? "justify-between" : "mr-auto")}>
            <GhostButton
              onClick={() => {
                store.setStatus(block.id, block.status === "pending" ? "skipped" : "pending");
                onClose();
              }}
            >
              {block.status === "pending" ? "Hoy no" : "Volver a pendiente"}
            </GhostButton>
            <GhostButton danger onClick={remove}>
              {confirmDelete ? "¿Seguro? Tocá de nuevo" : "Borrar"}
            </GhostButton>
          </div>
        )}
        <PrimaryButton type="submit" className={isMobile ? "h-12 w-full" : "ml-auto"}>
          {isEdit ? "Guardar" : "Agregar"}
        </PrimaryButton>
      </footer>
    </form>
  );
}

interface ActivityPickerProps {
  activities: Activity[];
  /** Bloque viejo cuyo nombre no está entre las actividades: se muestra como opción propia. */
  current?: Block;
  selectedId?: string;
  autoFocus?: boolean;
  onSelect: (id: string) => void;
  onCreate: (quadrant: QuadrantId, name: string) => void;
}

/**
 * Todas tus actividades juntas, cada una con el ícono de su cuadrante.
 * Elegís la actividad y el cuadrante sale solo.
 */
function ActivityPicker({ activities, current, selectedId, autoFocus, onSelect, onCreate }: ActivityPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [newQuadrant, setNewQuadrant] = useState<QuadrantId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const all = QUADRANTS.flatMap((q) => activities.filter((a) => a.quadrant === q.id));
  const ordered = searchActivities(all, query);
  const startCreating = (prefill = "") => {
    setName(prefill);
    setCreating(true);
  };
  const selected = activities.find((a) => a.id === selectedId);
  const selectedQuadrant = selected?.quadrant ?? (selectedId === CURRENT ? current?.quadrant : undefined);

  const create = () => {
    const clean = name.trim();
    if (!clean || !newQuadrant) return;
    onCreate(newQuadrant, clean);
    setName("");
    setNewQuadrant(null);
    setCreating(false);
  };

  const chip = (id: string, label: string, q: QuadrantId, first: boolean) => {
    const isSelected = selectedId === id;
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={`${label} (${QUADRANT_BY_ID[q].name})`}
        data-autofocus={autoFocus && first ? true : undefined}
        onClick={() => onSelect(id)}
        style={quadrantStyle(q)}
        className={cn(
          "pressable inline-flex h-9 items-center gap-1.5 rounded-full border pr-3.5 pl-1.5 text-[13px] font-medium",
          isSelected ? "border-[var(--q)] bg-[var(--q-soft)] text-ink" : "border-line bg-surface text-ink hover:bg-surface-sunken",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-6 place-items-center rounded-full transition-colors duration-150",
            isSelected ? "bg-[var(--q)] text-white" : "bg-[var(--q-soft)] text-[var(--q)]",
          )}
        >
          <QuadrantIcon id={q} className="size-3.5" />
        </span>
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {all.length > 0 && !creating && (
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={query}
            data-autofocus={autoFocus ? true : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Enter elige la primera coincidencia; si no hay, ofrece crearla.
                e.preventDefault();
                if (ordered[0]) {
                  onSelect(ordered[0].id);
                  setQuery("");
                } else if (query.trim()) startCreating(query.trim());
              }
              if (e.key === "Escape" && query) {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
              }
            }}
            placeholder="Buscar actividad…"
            aria-label="Buscar actividad"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-[13px] placeholder:text-ink-muted/80 focus:border-ink focus:shadow-[0_0_0_3px_rgba(37,40,54,0.08)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      )}

      <div role="radiogroup" aria-label="Actividad" className="flex flex-wrap gap-1.5">
        {current && !query && chip(CURRENT, current.title, current.quadrant, false)}
        {ordered.map((a) => chip(a.id, a.name, a.quadrant, false))}
        {!creating && (
          <button
            type="button"
            onClick={() => startCreating(query.trim())}
            className="pressable inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-ink-faint px-3 text-[13px] font-medium text-ink-muted hover:border-ink hover:text-ink"
          >
            <Plus aria-hidden className="size-3.5" />
            {query.trim() && !ordered.length ? `Crear «${query.trim()}»` : "Nueva"}
          </button>
        )}
      </div>
      {query && ordered.length === 0 && !creating && (
        <p className="text-[12px] text-ink-muted">No tenés una actividad con ese nombre. Podés crearla.</p>
      )}

      {selectedQuadrant && !creating && (
        <p
          style={quadrantStyle(selectedQuadrant)}
          className="animate-fade-up flex items-center gap-1.5 text-[12px] text-ink-muted"
        >
          <span aria-hidden className="size-2 rounded-full bg-[var(--q)]" />
          Suma a <span className="font-semibold text-ink">{QUADRANT_BY_ID[selectedQuadrant].name}</span>
          <span className="truncate">· {QUADRANT_BY_ID[selectedQuadrant].hint.toLowerCase()}</span>
        </p>
      )}

      {creating && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-surface-sunken/70 p-3">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setCreating(false);
              }
            }}
            placeholder="Nombre de la actividad"
            aria-label="Nombre de la nueva actividad"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[13px] placeholder:text-ink-muted/80 focus:border-ink focus:shadow-[0_0_0_3px_rgba(37,40,54,0.08)] focus:outline-none"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-ink-muted">¿A qué parte de tu vida le suma?</span>
            <div role="radiogroup" aria-label="Cuadrante de la nueva actividad" className="flex flex-wrap gap-1.5">
              {QUADRANTS.map((q) => {
                const on = newQuadrant === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    title={q.hint}
                    onClick={() => setNewQuadrant(q.id)}
                    style={quadrantStyle(q.id)}
                    className={cn(
                      "pressable inline-flex h-8 items-center gap-1.5 rounded-full border pr-3 pl-1 text-[12px] font-medium",
                      on ? "border-[var(--q)] bg-[var(--q-soft)]" : "border-line bg-surface hover:bg-surface-sunken",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-6 place-items-center rounded-full",
                        on ? "bg-[var(--q)] text-white" : "bg-[var(--q-soft)] text-[var(--q)]",
                      )}
                    >
                      <QuadrantIcon id={q.id} className="size-3" />
                    </span>
                    {q.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-1">
            <GhostButton className="h-9" onClick={() => setCreating(false)}>
              Cancelar
            </GhostButton>
            <button
              type="button"
              onClick={create}
              disabled={!name.trim() || !newQuadrant}
              className="pressable h-9 rounded-md border border-line bg-surface px-3.5 text-[13px] font-medium hover:bg-surface-sunken disabled:opacity-40"
            >
              Crear actividad
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 && !creating && !current && (
        <p className="type-label text-ink-muted">Todavía no tenés actividades. Creá la primera.</p>
      )}
    </div>
  );
}

function ScopeStep({
  action,
  isMobile,
  onCancel,
  onConfirm,
}: {
  action: "save" | "delete";
  isMobile: boolean;
  onCancel: () => void;
  onConfirm: (scope: Scope) => void;
}) {
  const [scope, setScope] = useState<Scope>("this");
  const name = useId();

  return (
    <form
      method="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(scope);
      }}
      className="flex flex-col gap-5 p-5 sm:p-6"
    >
      <h2 id="sheet-title" className="type-headline">
        {action === "delete" ? "Borrar evento que se repite" : "Guardar evento que se repite"}
      </h2>
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Aplicar a</legend>
        {SCOPE_OPTIONS.map((o, i) => (
          <label
            key={o.id}
            className={cn(
              "flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors duration-150",
              scope === o.id ? "bg-surface-sunken" : "hover:bg-surface-sunken/60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={scope === o.id}
              data-autofocus={i === 0 ? true : undefined}
              onChange={() => setScope(o.id)}
              className="size-4 accent-[var(--color-ink)]"
            />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </fieldset>
      <div className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "justify-end")}>
        <GhostButton onClick={onCancel}>Cancelar</GhostButton>
        <button
          type="submit"
          className={cn(
            "pressable rounded-md px-5 font-medium text-surface",
            action === "delete" ? "bg-danger hover:bg-danger/90" : "bg-ink hover:bg-ink/90",
            isMobile ? "h-12" : "h-10",
          )}
        >
          {action === "delete" ? "Borrar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="type-label text-ink-muted">{label}</span>
      {children}
      {error && (
        <p role="alert" className="type-label text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
