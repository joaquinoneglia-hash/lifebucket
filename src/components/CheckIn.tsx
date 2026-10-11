"use client";

import { ArrowLeft, CalendarClock, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, dayLabel, fromKey, toKey, weekdayShort, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { quadrantStyle } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { clampStart, formatTime, formatTimeRange, nextHalfHour, nowMinutes, timeOptions } from "@/lib/time";
import { QuadrantIcon } from "./QuadrantIcon";
import { GhostButton, PrimaryButton, SecondaryButton, Select, Sheet } from "./ui";

interface CheckInProps {
  /** Ids fijados al abrir: la lista no se reordena mientras respondés. */
  ids: string[];
  todayKey: DateKey;
  isMobile: boolean;
  onClose: () => void;
}

/** "¿Hiciste X?" bloque por bloque: sí, no pude, o pasarlo a otro día. */
export function CheckIn({ ids, todayKey, isMobile, onClose }: CheckInProps) {
  const blocks = usePlanner((s) => s.blocks);
  const setStatus = usePlanner((s) => s.setStatus);
  const moveBlock = usePlanner((s) => s.moveBlock);

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [moving, setMoving] = useState(false);

  const block = useMemo(() => blocks.find((b) => b.id === ids[index]), [blocks, ids, index]);
  const finished = index >= ids.length;

  const next = () => {
    setAnswered((n) => n + 1);
    setMoving(false);
    setIndex((i) => i + 1);
  };

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="checkin-title" width="max-w-[420px]">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {finished || !block ? (
          <AllDone count={answered} onClose={onClose} />
        ) : (
          <>
            <header className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 id="checkin-title" className="type-title">
                  ¿Cómo te fue?
                </h2>
                <span className="type-label text-ink-muted tabular-nums">
                  {index + 1} de {ids.length}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <div
                  className="bar-fill h-full rounded-full bg-ink"
                  style={{ width: `${(index / ids.length) * 100}%` }}
                />
              </div>
            </header>

            <div key={block.id} className="animate-fade-up flex items-center gap-4" style={quadrantStyle(block.quadrant)}>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                <QuadrantIcon id={block.quadrant} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="type-headline">¿Hiciste {block.title}?</p>
                <p className="type-body text-ink-muted first-letter:uppercase tabular-nums">
                  {dayLabel(block.date)} · {formatTimeRange(block.start, block.minutes)}
                </p>
              </div>
            </div>

            {moving ? (
              <MovePicker
                key={`move-${block.id}`}
                todayKey={todayKey}
                minutes={block.minutes}
                initialStart={block.start}
                isMobile={isMobile}
                onBack={() => setMoving(false)}
                onMove={(date, start) => {
                  moveBlock(block.id, date, start);
                  next();
                }}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <PrimaryButton
                  autoFocus
                  className="h-12"
                  onClick={() => {
                    setStatus(block.id, "done");
                    next();
                  }}
                >
                  <Check aria-hidden className="size-4" />
                  Sí, lo hice
                </PrimaryButton>
                <SecondaryButton
                  className="h-12"
                  onClick={() => {
                    setStatus(block.id, "skipped");
                    next();
                  }}
                >
                  No pude
                </SecondaryButton>
                <GhostButton className="h-11" onClick={() => setMoving(true)}>
                  <CalendarClock aria-hidden className="size-4" />
                  Pasarlo a otro día
                </GhostButton>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function MovePicker({
  todayKey,
  minutes,
  initialStart,
  isMobile,
  onBack,
  onMove,
}: {
  todayKey: DateKey;
  minutes: number;
  initialStart: number;
  isMobile: boolean;
  onBack: () => void;
  onMove: (date: DateKey, start: number) => void;
}) {
  const today = fromKey(todayKey);
  const options = Array.from({ length: 7 }, (_, i) => toKey(addDays(today, i)));
  // Hoy solo si todavía estás a tiempo de hacerlo a esa hora; si no, mañana.
  const fitsToday = initialStart > nowMinutes();
  const [date, setDate] = useState<DateKey>(fitsToday ? options[0] : options[1]);
  const [start, setStart] = useState(() =>
    date === todayKey && !fitsToday ? nextHalfHour(minutes) : clampStart(initialStart, minutes),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="type-label text-ink-muted">¿Qué día?</span>
        <div className="grid grid-cols-7 gap-1">
          {options.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === date}
              aria-label={i === 0 ? "Hoy" : i === 1 ? "Mañana" : dayLabel(d)}
              onClick={() => {
                setDate(d);
                if (d === todayKey && start <= nowMinutes()) setStart(nextHalfHour(minutes));
              }}
              className={cn(
                "pressable flex h-12 flex-col items-center justify-center rounded-md text-[11px] leading-tight",
                d === date ? "bg-ink text-surface" : "bg-surface-sunken text-ink hover:bg-line",
              )}
            >
              <span className={cn(d === date ? "text-surface/70" : "text-ink-muted", i > 1 && "capitalize")}>
                {i === 0 ? "hoy" : i === 1 ? "mañana" : weekdayShort(d)}
              </span>
              <span className="font-semibold tabular-nums">{fromKey(d).getDate()}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          label="Hora"
          value={String(start)}
          onChange={(v) => setStart(Number(v))}
          options={timeOptions(minutes).map((t) => ({ value: String(t), label: formatTime(t) }))}
          className="w-32"
        />
        <span className="text-[13px] text-ink-muted tabular-nums">hasta las {formatTime(start + minutes)}</span>
      </div>
      <div className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "items-center justify-between")}>
        <GhostButton onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" />
          Volver
        </GhostButton>
        <PrimaryButton className={isMobile ? "h-12" : ""} onClick={() => onMove(date, start)}>
          Mover
        </PrimaryButton>
      </div>
    </div>
  );
}

function AllDone({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="animate-check-pop grid size-14 place-items-center rounded-full bg-ink text-surface">
        <Check aria-hidden className="size-6" strokeWidth={2.5} />
      </span>
      <h2 id="checkin-title" className="type-headline mt-1">
        Todo al día
      </h2>
      <p className="type-body max-w-[32ch] text-ink-muted">
        {count === 1 ? "Marcaste 1 bloque." : `Marcaste ${count} bloques.`} Tu balance ya está actualizado.
      </p>
      <PrimaryButton autoFocus className="mt-2 h-11 w-full" onClick={onClose}>
        Seguir
      </PrimaryButton>
    </div>
  );
}
