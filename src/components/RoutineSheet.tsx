"use client";

import { ChevronRight, Moon, Plus, X } from "lucide-react";
import { partStyle } from "@/lib/mode";
import { QUADRANT_BY_ID, type QuadrantId } from "@/lib/quadrants";
import { hoursLabel, sleepStats } from "@/lib/sleep-stats";
import { describeRepeat, usePlanner, type RoutineBlock } from "@/lib/store";
import { formatMinutes } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { QuadrantIcon } from "./QuadrantIcon";
import { Sheet } from "./ui";

const ORDER: QuadrantId[] = ["trabajo", "cuerpo", "interior", "alma", "mente", "vinculos", "libre"];

/**
 * Editar tu rutina: el sueño (tu horario) y cada bloque que se repite, agrupado por categoría, con sus días,
 * su horario y sus horas por semana. Tocando uno se edita; también se puede sumar otro.
 */
export function RoutineSheet({
  isMobile,
  onClose,
  onSleep,
  onEdit,
  onAdd,
}: {
  isMobile: boolean;
  onClose: () => void;
  onSleep: () => void;
  onEdit: (block: RoutineBlock) => void;
  onAdd: () => void;
}) {
  const routine = usePlanner((s) => s.routine);
  const sleep = usePlanner((s) => s.sleep);
  const st = sleepStats(sleep);
  const groups = ORDER.map((q) => ({ q, list: routine.filter((b) => b.quadrant === q).sort((a, b) => a.start - b.start) })).filter((g) => g.list.length);

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="routine-sheet-title" width="max-w-[560px]">
      <div className="flex max-h-[min(760px,88dvh)] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="routine-sheet-title" data-autofocus tabIndex={-1} className="type-title outline-none">
            Editar tu rutina
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-faint uppercase">Sueño</h3>
            <button type="button" onClick={onSleep} className="pressable flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left hover:bg-surface-sunken">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--color-sleep)_15%,transparent)] text-[var(--color-sleep)]">
                <Moon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[14px] font-semibold">Tu horario de sueño</b>
                <span className="text-[12.5px] text-ink-muted tabular-nums">
                  {hoursLabel(st.perNight)} por noche · {hoursLabel(st.weekHours)} por semana
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-ink-faint" />
            </button>
          </section>

          {groups.map(({ q, list }) => (
            <section key={q} className="flex flex-col gap-1.5">
              <h3 className="flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
                {QUADRANT_BY_ID[q].name}
                <span className="font-medium tracking-normal normal-case tabular-nums">{formatMinutes(list.reduce((acc, b) => acc + b.minutes * b.days.length, 0))} por semana</span>
              </h3>
              <ul className="flex flex-col gap-1">
                {list.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => onEdit(b)} style={partStyle(b.quadrant)} className="pressable flex w-full items-center gap-3 rounded-xl bg-[var(--q-soft)] px-3 py-2 text-left hover:brightness-[0.97]">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q)] text-white">
                        <QuadrantIcon id={b.quadrant} className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px] font-semibold">{b.name}</b>
                        <span className="text-[12px] text-ink-muted tabular-nums">
                          {describeRepeat(b.days)} · {formatTime(b.start)}–{formatTime(b.start + b.minutes)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-ink-muted tabular-nums">{formatMinutes(b.minutes * b.days.length)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!groups.length && <p className="text-[13px] text-ink-muted">Todavía no cargaste bloques. Empezá por tu trabajo.</p>}

          <button type="button" onClick={onAdd} className="pressable inline-flex h-10 items-center gap-1.5 self-start rounded-full bg-ink px-4 text-[13px] font-semibold text-surface hover:bg-ink/90">
            <Plus aria-hidden className="size-4" />
            Sumar un bloque
          </button>
        </div>
      </div>
    </Sheet>
  );
}
