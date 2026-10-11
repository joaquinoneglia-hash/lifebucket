"use client";

import { useDroppable } from "@dnd-kit/core";
import { dayLabel, fromKey, weekdayShort, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { QUADRANTS, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import type { Block } from "@/lib/store";
import { COMPACT_BAR_H } from "./BalanceCard";
import { isVirtual } from "@/lib/sleep";
import { TimeGrid } from "./TimeGrid";

export const DAY_DROP_PREFIX = "day:";

interface DayChipProps {
  date: DateKey;
  selected: boolean;
  isToday: boolean;
  quadrants: QuadrantId[];
  onSelect: (date: DateKey) => void;
}

/** Chip de día: se toca para ver el día y también recibe bloques arrastrados. */
function DayChip({ date, selected, isToday, quadrants, onSelect }: DayChipProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DAY_DROP_PREFIX}${date}` });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={selected}
      aria-label={`${dayLabel(date)}${isToday ? ", hoy" : ""}`}
      onClick={() => onSelect(date)}
      className={cn(
        "pressable flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-lg",
        selected ? "bg-ink text-surface" : "text-ink",
        isOver && !selected && "bg-surface-sunken",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-medium capitalize",
          selected ? "text-surface/70" : isToday ? "text-ink" : "text-ink-muted",
        )}
      >
        {weekdayShort(date)}
      </span>
      <span className="text-[15px] leading-none font-semibold tabular-nums">{fromKey(date).getDate()}</span>
      {/* Puntitos con los cuadrantes que tiene ese día. */}
      <span aria-hidden className="flex h-1 gap-0.5">
        {quadrants.map((q) => (
          <span key={q} style={quadrantStyle(q)} className="size-1 rounded-full bg-[var(--q)]" />
        ))}
      </span>
    </button>
  );
}

interface DayViewProps {
  days: DateKey[];
  todayKey: DateKey;
  selectedDay: DateKey;
  onSelectDay: (date: DateKey) => void;
  blocksByDay: Map<DateKey, Block[]>;
  onCreate: (date: DateKey, start: number, minutes?: number) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onEditSleep: (date: DateKey) => void;
  dragging: boolean;
  highlightLibre?: boolean;
}

export function DayView({ days, todayKey, selectedDay, onSelectDay, blocksByDay, onCreate, onOpen, onDelete, onEditSleep, dragging, highlightLibre }: DayViewProps) {
  const quadrantsOf = (d: DateKey) => {
    const present = new Set((blocksByDay.get(d) ?? []).filter((b) => !isVirtual(b)).map((b) => b.quadrant));
    return QUADRANTS.filter((q) => present.has(q.id)).map((q) => q.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Días de la semana"
        className="card sticky z-20 flex gap-0.5 p-1.5"
        style={{ top: COMPACT_BAR_H + 8 }}
      >
        {days.map((d) => (
          <DayChip
            key={d}
            date={d}
            selected={d === selectedDay}
            isToday={d === todayKey}
            quadrants={quadrantsOf(d)}
            onSelect={onSelectDay}
          />
        ))}
      </nav>

      <div className="card overflow-clip py-2 pr-1">
        <TimeGrid
          days={[selectedDay]}
          todayKey={todayKey}
          blocksByDay={blocksByDay}
          onCreate={onCreate}
          onOpen={onOpen}
          onDelete={onDelete}
          onEditSleep={onEditSleep}
          highlightLibre={highlightLibre}
          hideHeader
          dragging={dragging}
        />
      </div>
    </div>
  );
}
