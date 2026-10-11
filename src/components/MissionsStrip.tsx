"use client";

import { CalendarPlus, Check, Target, X } from "lucide-react";
import { useMemo } from "react";
import type { DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { quadrantStyle } from "@/lib/quadrants";
import { usePlanner, type Mission } from "@/lib/store";
import { QuadrantIcon } from "./QuadrantIcon";

interface MissionsStripProps {
  week: DateKey;
  onSchedule: (mission: Mission) => void;
}

/** Las misiones de la semana, siempre a la vista arriba del calendario. */
export function MissionsStrip({ week, onSchedule }: MissionsStripProps) {
  const missions = usePlanner((s) => s.missions);
  const blocks = usePlanner((s) => s.blocks);
  const updateMission = usePlanner((s) => s.updateMission);

  const mine = useMemo(() => missions.filter((m) => m.week === week && m.status !== "dismissed"), [missions, week]);
  if (!mine.length) return null;

  const progress = (m: Mission) => {
    const linked = blocks.filter((b) => m.blockIds.includes(b.id));
    return { done: linked.filter((b) => b.status === "done").length, scheduled: linked.length };
  };

  return (
    <section aria-labelledby="missions-title" className="flex flex-col gap-2">
      <h2 id="missions-title" className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Target aria-hidden className="size-4" strokeWidth={1.75} />
        Misiones de la semana
      </h2>
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {mine.map((m) => {
          const p = progress(m);
          const complete = p.done >= m.count;
          const pending = m.count - p.scheduled;
          return (
            <li
              key={m.id}
              style={quadrantStyle(m.quadrant)}
              className={cn(
                "card group relative flex min-w-[250px] snap-start items-center gap-3 p-3 pr-2 sm:min-w-[280px]",
                complete && "bg-[color-mix(in_oklab,var(--q-soft)_60%,white)]",
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full",
                  complete ? "bg-[var(--q)] text-white" : "bg-[var(--q-soft)] text-[var(--q)]",
                )}
              >
                {complete ? <Check aria-hidden className="size-4" strokeWidth={2.5} /> : <QuadrantIcon id={m.quadrant} className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{m.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {/* Una bolita por vez: llena = hecha, borde = agendada, punteada = falta agendar. */}
                  <span className="flex gap-1" aria-label={`${p.done} de ${m.count} hechas`}>
                    {Array.from({ length: m.count }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2.5 rounded-full border-[1.5px]",
                          i < p.done
                            ? "border-[var(--q)] bg-[var(--q)]"
                            : i < p.scheduled
                              ? "border-[var(--q)]"
                              : "border-dashed border-ink-faint",
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] text-ink-muted tabular-nums">
                    {complete ? "¡Cumplida!" : pending > 0 ? `${pending} sin agendar` : `${p.done} de ${m.count}`}
                  </span>
                </div>
              </div>
              {!complete && pending > 0 && (
                <button
                  type="button"
                  onClick={() => onSchedule(m)}
                  className="pressable inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-ink px-2.5 text-[12px] font-medium text-surface"
                >
                  <CalendarPlus aria-hidden className="size-3.5" />
                  Agendar
                </button>
              )}
              <button
                type="button"
                aria-label={`Quitar la misión ${m.title}`}
                onClick={() => updateMission(m.id, { status: "dismissed" })}
                className="pressable grid size-7 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
