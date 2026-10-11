"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/format";
import { QUADRANT_BY_ID, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import { QuadrantIcon } from "../QuadrantIcon";
import { LIFE } from "./ActivityAdder";

export type Goals = Record<"cuerpo" | "mente" | "alma", number>;

const h = (m: number) => {
  const v = Math.round((m / 60) * 2) / 2;
  return `${v.toLocaleString("es-AR")} h`;
};
/** De a media hora hasta 2 h; de a una hora después. */
const step = (m: number, dir: 1 | -1) => Math.max(0, dir > 0 ? m + (m < 120 ? 30 : 60) : m - (m <= 120 ? 30 : 60));

/**
 * "¿Cuál es tu objetivo?": cuántas horas por semana querés para cuerpo, mente y alma, al lado de
 * las que tenés hoy. El % sale solo; Libre es lo que sobra.
 */
export function GoalSetter({
  today,
  goals,
  onChange,
  awakeMinutes,
  workMinutes,
}: {
  today: Goals;
  goals: Goals;
  onChange: (g: Goals) => void;
  awakeMinutes: number;
  workMinutes: number;
}) {
  const used = LIFE.reduce((acc, q) => acc + goals[q as keyof Goals], 0);
  const libre = awakeMinutes - workMinutes - used;
  const pct = (m: number) => Math.round((m / awakeMinutes) * 100);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {LIFE.map((id) => {
          const q = id as keyof Goals;
          const up = goals[q] - today[q];
          return (
            <li key={id} style={quadrantStyle(id as QuadrantId)} className="flex items-center gap-3 rounded-xl bg-[var(--q-soft)] p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface/80 text-[var(--q)]">
                <QuadrantIcon id={id} className="size-4" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[14px] font-semibold">{QUADRANT_BY_ID[id].name}</p>
                <p className="text-[12px] text-ink-muted tabular-nums">
                  Hoy {h(today[q])}
                  {up !== 0 && <span className={cn("ml-1.5 font-semibold", up > 0 ? "text-success" : "text-ink")}>{up > 0 ? `+${h(up)}` : `−${h(-up)}`}</span>}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Menos ${QUADRANT_BY_ID[id].name}`}
                disabled={goals[q] === 0}
                onClick={() => onChange({ ...goals, [q]: step(goals[q], -1) })}
                className="pressable grid size-9 place-items-center rounded-md border border-line bg-surface text-ink-muted hover:text-ink disabled:opacity-35"
              >
                <Minus aria-hidden className="size-4" />
              </button>
              <output className="w-16 text-center leading-tight tabular-nums" aria-label={`${QUADRANT_BY_ID[id].name}: ${h(goals[q])} por semana`}>
                <span className="block text-[18px] font-semibold">{h(goals[q])}</span>
                <span className="block text-[11px] text-ink-muted">{pct(goals[q])}% · sem</span>
              </output>
              <button
                type="button"
                aria-label={`Más ${QUADRANT_BY_ID[id].name}`}
                disabled={libre < 60}
                onClick={() => onChange({ ...goals, [q]: step(goals[q], 1) })}
                className="pressable grid size-9 place-items-center rounded-md border border-line bg-surface text-ink-muted hover:text-ink disabled:opacity-35"
              >
                <Plus aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-1 text-[12.5px] text-ink-muted tabular-nums">
        Trabajo {h(workMinutes)} ({pct(workMinutes)}%) · te quedan <span className="font-semibold text-ink">{h(Math.max(0, libre))}</span> libres ({pct(Math.max(0, libre))}%).
      </p>
    </div>
  );
}
