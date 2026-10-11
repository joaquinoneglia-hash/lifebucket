"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Moon, Plus } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { fromKey, weekdayShort, type DateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { quadrantStyle } from "@/lib/quadrants";
import { awakeWindow, isVirtual } from "@/lib/sleep";
import { SLOTS } from "@/lib/slots";
import { usePlanner, type Block } from "@/lib/store";
import { clampStart, dayEnd, dayStart, formatTime, nowMinutes, STEP } from "@/lib/time";
import { SIMPLE_MODE } from "@/lib/mode";
import { BlockFace } from "./BlockCard";

/**
 * Alto de cada tramo de 30 minutos. Se ajusta al alto de la pantalla para que el día
 * entero entre sin scroll (lo fija el Planner antes de dibujar, como el rango del día).
 */
let rowPx = 26;
export const ROW_MIN = 16;
export const ROW_MAX = 26;
export const row = () => rowPx;
export function setRow(px: number) {
  rowPx = Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor(px)));
}
const AXIS = 52;

export const COL_DROP_PREFIX = "col:";
export const blockHeight = (minutes: number) => (minutes / STEP) * rowPx - 2;
const topOf = (start: number) => ((start - dayStart()) / STEP) * rowPx;
const gridHeight = () => ((dayEnd() - dayStart()) / STEP) * rowPx;

/**
 * Ubica los bloques del día:
 * - si uno está completamente dentro de otro (el almuerzo dentro del horario de trabajo),
 *   va encima con sangría, como en Google Calendar, sin achicar al de abajo;
 * - si se pisan en parte, van en carriles lado a lado.
 */
function layout(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.minutes - a.minutes);
  const depth = new Map<string, number>();
  for (const b of sorted) {
    const parent = sorted.find(
      (c) => c !== b && c.start <= b.start && c.start + c.minutes >= b.start + b.minutes && c.minutes > b.minutes,
    );
    depth.set(b.id, parent ? (depth.get(parent.id) ?? 0) + 1 : 0);
  }
  const out = lanes(sorted.filter((b) => !depth.get(b.id)));
  // Cada uno anidado va dentro del carril de su bloque de base (el de más afuera).
  const root = (b: Block): Block => {
    const parent = sorted.find(
      (c) => c !== b && c.start <= b.start && c.start + c.minutes >= b.start + b.minutes && c.minutes > b.minutes,
    );
    return parent ? root(parent) : b;
  };
  const nested = sorted
    .filter((b) => (depth.get(b.id) ?? 0) > 0)
    .map((block) => {
      const base = out.find((o) => o.block.id === root(block).id);
      return { block, depth: depth.get(block.id)!, lane: base?.lane ?? 0, lanes: base?.lanes ?? 1 };
    });
  return { out, nested };
}

function lanes(sorted: Block[]) {
  const out: { block: Block; lane: number; lanes: number }[] = [];
  let cluster: { block: Block; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const c of cluster) out.push({ ...c, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    if (b.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.start + b.minutes;
    cluster.push({ block: b, lane });
    clusterEnd = Math.max(clusterEnd, b.start + b.minutes);
  }
  flush();
  return out;
}

interface TimeGridProps {
  days: DateKey[];
  todayKey: DateKey;
  /** Bloques de cada día, incluidos los Libre que completan los huecos. */
  blocksByDay: Map<DateKey, Block[]>;
  onCreate: (date: DateKey, start: number, minutes?: number) => void;
  onOpen: (id: string) => void;
  /** Borrado rápido desde la tarjeta (con deshacer). */
  onDelete: (id: string) => void;
  /** Tocar la franja de sueño de un día para cambiarlo. */
  onEditSleep: (date: DateKey) => void;
  /** Sin encabezado de días (en mobile lo reemplaza el selector). */
  hideHeader?: boolean;
  /** Barra (p. ej. navegación de semana) que viaja pegada junto con los días. */
  toolbar?: ReactNode;
  /** Distancia desde arriba a la que se pega el encabezado al hacer scroll en la página. */
  stickyTop?: number;
  dragging: boolean;
  /** Modo completar: los espacios Libre se resaltan para llenarlos. */
  highlightLibre?: boolean;
}

export function TimeGrid({
  days,
  todayKey,
  blocksByDay,
  onCreate,
  onOpen,
  onDelete,
  onEditSleep,
  hideHeader,
  toolbar,
  stickyTop = 0,
  dragging,
  highlightLibre = false,
}: TimeGridProps) {
  const columns = `${AXIS}px repeat(${days.length}, minmax(0, 1fr))`;

  // Sin scroll propio: la grilla crece con la página y el encabezado queda pegado arriba.
  return (
    <div className="relative">
      {(!hideHeader || toolbar) && (
        <div className="sticky z-20 bg-surface" style={{ top: stickyTop }}>
          {toolbar}
          {!hideHeader && (
            <div className="grid border-b border-line" style={{ gridTemplateColumns: columns }}>
              <div />
              {days.map((d) => (
                <DayHeader key={d} date={d} isToday={d === todayKey} blocks={blocksByDay.get(d) ?? []} />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: columns }}>
        <TimeAxis />
        {days.map((d) => (
          <DayColumn
            key={d}
            date={d}
            isToday={d === todayKey}
            blocks={blocksByDay.get(d) ?? []}
            onCreate={onCreate}
            onOpen={onOpen}
            onDelete={onDelete}
            onEditSleep={onEditSleep}
            dragging={dragging}
            highlightLibre={highlightLibre}
          />
        ))}
      </div>
    </div>
  );
}

function DayHeader({ date, isToday, blocks }: { date: DateKey; isToday: boolean; blocks: Block[] }) {
  const libre = blocks.filter((b) => b.quadrant === "libre").reduce((acc, b) => acc + b.minutes, 0);
  return (
    <div className="flex items-center gap-2 border-l border-line px-2.5 py-2.5">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-semibold tabular-nums",
          isToday ? "bg-ink text-surface" : "text-ink",
        )}
      >
        {fromKey(date).getDate()}
      </span>
      <div className="min-w-0 leading-tight">
        <p className={cn("text-xs font-medium capitalize", isToday ? "text-ink" : "text-ink-muted")}>
          {weekdayShort(date)}
          {isToday && <span className="text-ink-muted"> · hoy</span>}
        </p>
        {!SIMPLE_MODE && <p className="truncate text-[11px] text-ink-muted tabular-nums">Libre {formatMinutes(libre)}</p>}
      </div>
    </div>
  );
}

function TimeAxis() {
  const hours: number[] = [];
  for (let m = dayStart(); m < dayEnd(); m += 60) hours.push(m);
  return (
    <div className="relative" style={{ height: gridHeight() }} aria-hidden>
      {hours.map((m) => (
        <span
          key={m}
          className="absolute right-2 text-[11px] text-ink-muted tabular-nums"
          style={{ top: topOf(m), transform: m === dayStart() ? "translateY(2px)" : "translateY(-50%)" }}
        >
          {formatTime(m)}
        </span>
      ))}
      {SLOTS.filter((s) => s.start >= dayStart() && s.start < dayEnd()).map((s) => (
        <span
          key={s.id}
          className="absolute right-2 text-[11px] font-semibold text-ink"
          style={{ top: topOf(s.start) + (s.start === dayStart() ? 16 : 9) }}
        >
          {s.name}
        </span>
      ))}
    </div>
  );
}

// Líneas de hora (más marcadas) y de media hora (suaves), sin divs por celda.
const gridBackground = (): CSSProperties => ({
  backgroundImage: [
    "linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)",
    "linear-gradient(to bottom, color-mix(in oklab, var(--color-line) 45%, transparent) 1px, transparent 1px)",
  ].join(","),
  backgroundSize: `100% ${rowPx * 2}px, 100% ${rowPx * 2}px`,
  backgroundPosition: `0 0, 0 ${rowPx}px`,
});

interface DayColumnProps {
  date: DateKey;
  isToday: boolean;
  blocks: Block[];
  onCreate: (date: DateKey, start: number, minutes?: number) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onEditSleep: (date: DateKey) => void;
  dragging: boolean;
  highlightLibre: boolean;
}

function DayColumn({ date, isToday, blocks, onCreate, onOpen, onDelete, onEditSleep, dragging, highlightLibre }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COL_DROP_PREFIX}${date}` });
  const sleep = usePlanner((s) => s.sleep);
  const [hover, setHover] = useState<number | null>(null);
  const [now, setNow] = useState(nowMinutes);
  const { wake, bed } = awakeWindow(date, sleep);

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // La hora bajo el puntero, siempre dentro de tu ventana despierto: el sueño no se agenda.
  const startAt = (clientY: number, el: HTMLElement) => {
    const y = clientY - el.getBoundingClientRect().top;
    const raw = dayStart() + Math.floor(Math.max(0, y) / rowPx) * STEP;
    return clampStart(raw, STEP, wake, bed);
  };
  const real = blocks.filter((b) => !isVirtual(b));
  const placed = layout(real);
  const virtual = SIMPLE_MODE ? [] : blocks.filter(isVirtual);
  const busy = (start: number) => real.some((b) => start < b.start + b.minutes && start + STEP > b.start);

  // Crear arrastrando (como Google Calendar): apretás en un hueco y estirás hacia abajo o arriba.
  const [sel, setSel] = useState<{ from: number; to: number } | null>(null);
  const selFrom = sel ? Math.min(sel.from, sel.to) : 0;
  const selMinutes = sel ? Math.abs(sel.to - sel.from) + STEP : 0;

  return (
    <div
      ref={setNodeRef}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0 || dragging || e.target !== e.currentTarget) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const s = startAt(e.clientY, e.currentTarget);
        setSel({ from: s, to: s });
        setHover(null);
      }}
      onPointerMove={(e) => {
        if (sel) return setSel({ ...sel, to: startAt(e.clientY, e.currentTarget) });
        if (e.pointerType !== "mouse" || dragging || e.target !== e.currentTarget) return setHover(null);
        setHover(startAt(e.clientY, e.currentTarget));
      }}
      onPointerUp={() => {
        if (!sel) return;
        setSel(null);
        onCreate(date, selFrom, selMinutes);
      }}
      onPointerCancel={() => setSel(null)}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        // Con mouse lo resuelve el arrastre; acá queda el toque en pantallas táctiles.
        if (e.target !== e.currentTarget || (e.nativeEvent as PointerEvent).pointerType === "mouse") return;
        onCreate(date, startAt(e.clientY, e.currentTarget));
      }}
      className={cn(
        "relative cursor-pointer border-l border-line transition-colors duration-150 select-none",
        isToday && "bg-[color-mix(in_oklab,var(--color-surface-sunken)_45%,transparent)]",
        isOver && "bg-surface-sunken",
      )}
      style={{ height: gridHeight(), ...gridBackground() }}
    >
      {/* El sueño: franja fija, no se agenda nada ahí. */}
      {wake > dayStart() && <SleepBand from={dayStart()} to={wake} label={`Hasta las ${formatTime(wake)}`} onEdit={() => onEditSleep(date)} />}
      {bed < dayEnd() && <SleepBand from={bed} to={dayEnd()} label={`Desde las ${formatTime(bed)}`} onEdit={() => onEditSleep(date)} />}

      {/* Libre: completa cada minuto despierto sin actividad. Es fondo: se agenda encima. */}
      {virtual.map((b) => (
        <div
          key={b.id}
          aria-hidden
          style={{ ...quadrantStyle("libre"), top: topOf(b.start) + 1, height: blockHeight(b.minutes) }}
          className={cn(
            "pointer-events-none absolute inset-x-[3px] flex flex-col rounded-md bg-[color-mix(in_oklab,var(--q-soft)_75%,transparent)] px-2.5 py-1.5",
            highlightLibre && "border-2 border-dashed border-[color-mix(in_oklab,var(--q)_60%,transparent)]",
          )}
        >
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]">
            {highlightLibre && <Plus aria-hidden className="size-3" />}
            {highlightLibre ? "Libre · tocá para llenar" : "Libre"}
          </span>
          {b.minutes >= 60 && (
            <span className="text-[11px] text-[color-mix(in_oklab,var(--q)_55%,var(--color-ink))] tabular-nums">{formatMinutes(b.minutes)}</span>
          )}
        </div>
      ))}

      {sel && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 z-[6] flex flex-col rounded-md border border-ink/40 bg-surface/90 px-2 py-1 text-[11px] font-medium text-ink tabular-nums"
          style={{ top: topOf(selFrom) + 1, height: (selMinutes / STEP) * rowPx - 2 }}
        >
          <span>
            {formatTime(selFrom)} – {formatTime(selFrom + selMinutes)}
          </span>
          {selMinutes >= 60 && <span className="text-ink-muted">{formatMinutes(selMinutes)}</span>}
        </div>
      )}

      {!sel && hover !== null && !busy(hover) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 z-[4] flex items-center gap-1 rounded-md border border-dashed border-ink-faint bg-surface/90 px-2 text-[11px] font-medium text-ink-muted tabular-nums"
          style={{ top: topOf(hover) + 1, height: rowPx - 2 }}
        >
          <Plus className="size-3" />
          {formatTime(hover)}
        </div>
      )}

      {isToday && now >= dayStart() && now < dayEnd() && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: topOf(now) }}>
          <div className="h-px bg-ink" />
          <div className="absolute -top-[3px] -left-[3.5px] size-[7px] rounded-full bg-ink" />
        </div>
      )}

      {placed.out.map(({ block, lane, lanes }) => (
        <TimeBlock
          key={block.id}
          block={block}
          onOpen={onOpen}
          onDelete={onDelete}
          style={{
            top: topOf(block.start) + 1,
            left: `calc(${(lane / lanes) * 100}% + 3px)`,
            width: `calc(${100 / lanes}% - 6px)`,
          }}
        />
      ))}
      {/* Los que caen dentro de otro bloque van encima, con sangría y un borde para separarlos. */}
      {placed.nested.map(({ block, depth, lane, lanes }) => (
        <TimeBlock
          key={block.id}
          block={block}
          onOpen={onOpen}
          onDelete={onDelete}
          nested
          style={{
            top: topOf(block.start) + 1,
            left: `calc(${(lane / lanes) * 100 + (Math.min(depth * 8, 24) * (1 / lanes))}% + 3px)`,
            width: `calc(${(100 / lanes) * (1 - Math.min(depth * 8, 24) / 100)}% - 6px)`,
            zIndex: 5 + depth,
          }}
        />
      ))}
    </div>
  );
}

function SleepBand({ from, to, label, onEdit }: { from: number; to: number; label: string; onEdit: () => void }) {
  const height = ((to - from) / STEP) * rowPx;
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      title={`Dormir · ${label.toLowerCase()} · tocá para cambiarlo`}
      aria-label={`Dormir, ${label.toLowerCase()}. Cambiar el sueño de este día`}
      style={{
        top: topOf(from),
        height,
        backgroundImage:
          "repeating-linear-gradient(135deg, var(--color-sleep-soft) 0 6px, color-mix(in oklab, var(--color-sleep-soft) 55%, var(--color-surface)) 6px 12px)",
      }}
      className="group/sleep absolute inset-x-0 z-[3] flex items-start gap-1 overflow-hidden px-2.5 pt-1.5 text-left text-[11px] font-medium text-[color-mix(in_oklab,var(--color-sleep)_75%,transparent)] hover:text-[var(--color-sleep)]"
    >
      {height >= 22 && (
        <>
          <Moon aria-hidden className="mt-px size-3 shrink-0" />
          <span className="truncate">Dormir · {label.toLowerCase()}</span>
          <span className="ml-auto hidden shrink-0 underline-offset-2 group-hover/sleep:inline group-hover/sleep:underline">cambiar</span>
        </>
      )}
    </button>
  );
}

function TimeBlock({
  block,
  onOpen,
  onDelete,
  style,
  nested = false,
}: {
  block: Block;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  style: CSSProperties;
  nested?: boolean;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: block.id });
  const setStatus = usePlanner((s) => s.setStatus);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={style}
      className={cn(
        "absolute z-[5] touch-manipulation",
        nested && "rounded-md shadow-[0_0_0_2px_var(--color-surface),0_2px_8px_rgba(37,40,54,0.12)]",
        isDragging && "opacity-30",
      )}
    >
      <BlockFace
        block={block}
        height={blockHeight(block.minutes)}
        onOpen={onOpen}
        onDelete={onDelete}
        onToggleDone={() => setStatus(block.id, block.status === "done" ? "pending" : "done")}
      />
    </div>
  );
}
