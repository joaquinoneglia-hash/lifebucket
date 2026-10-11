"use client";

import { BadgeCheck, CalendarCheck2, Clock3, PieChart, Scale, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeBalance } from "@/lib/balance";
import { toKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { QUADRANTS, quadrantRecord, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import {
  achievements as getAchievements,
  periodBlocks,
  PERIOD_NOUN,
  periodLabel,
  shiftPeriod,
  type Achievement,
  type Period,
} from "@/lib/report";
import { usePlanner } from "@/lib/store";
import { BalanceRing } from "./BalanceRing";
import { QuadrantIcon } from "./QuadrantIcon";
import { GhostButton, PrimaryButton, Sheet } from "./ui";

const ICONS: Record<string, LucideIcon> = {
  balance: Scale,
  five: PieChart,
  calendar: CalendarCheck2,
  check: BadgeCheck,
  work: Clock3,
};

const isQuadrant = (icon: string): icon is QuadrantId => QUADRANTS.some((q) => q.id === icon);

/** Número que sube de 0 al valor (se salta con reduced motion). */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function AchievementBadge({ a, index = 0 }: { a: Achievement; index?: number }) {
  const Icon = isQuadrant(a.icon) ? null : ICONS[a.icon];
  const style = isQuadrant(a.icon) ? quadrantStyle(a.icon) : undefined;
  return (
    <li
      style={{ ...style, animationDelay: `${120 + index * 60}ms` }}
      className="animate-fade-up flex items-center gap-3 rounded-lg bg-surface-sunken/70 p-3"
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface",
          style ? "bg-[var(--q-soft)] text-[var(--q)] ring-[var(--q)]" : "bg-ink text-surface ring-ink",
        )}
      >
        {isQuadrant(a.icon) ? <QuadrantIcon id={a.icon} className="size-5" /> : Icon && <Icon aria-hidden className="size-5" strokeWidth={1.75} />}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{a.title}</p>
        <p className="text-[12px] leading-snug text-ink-muted">{a.description}</p>
      </div>
    </li>
  );
}

interface RecapProps {
  period: Period;
  isMobile: boolean;
  onClose: () => void;
  onOpenReports: (period: Period) => void;
}

/** El cierre de la semana o del mes: un momento para ver lo logrado, sin reproches. */
export function Recap({ period, isMobile, onClose, onOpenReports }: RecapProps) {
  const blocks = usePlanner((s) => s.blocks);
  const targets = usePlanner((s) => s.targets);
  const todayKey = toKey(new Date());

  const data = useMemo(() => {
    const mine = periodBlocks(blocks, period);
    const stats = computeBalance(mine, targets);
    const prev = computeBalance(periodBlocks(blocks, shiftPeriod(period, -1)), targets);
    return { stats, prev, wins: getAchievements(mine, stats, targets, period.kind, todayKey) };
  }, [blocks, targets, period, todayKey]);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const score = useCountUp(data.stats.score ?? 0);
  const noun = PERIOD_NOUN[period.kind];

  let comparison: string | null = null;
  if (data.stats.score !== null && data.prev.score !== null) {
    const diff = data.stats.score - data.prev.score;
    comparison =
      diff > 0
        ? `${diff} puntos más que ${period.kind === "week" ? "la semana" : "el mes"} anterior`
        : `${period.kind === "week" ? "La semana" : "El mes"} anterior tuvo ${data.prev.score}. Cada ${noun} arranca de cero.`;
  }

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="recap-title" width="max-w-[560px]">
      <div className="flex flex-col gap-6 p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="recap-title" className="type-display">
              Así fue tu {noun}
            </h2>
            <p className="type-body text-ink-muted first-letter:uppercase">{periodLabel(period)}</p>
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

        <div className="flex flex-col items-center gap-3 text-center">
          {/* Lo agendado queda fijo y lo cumplido se va llenando. */}
          <BalanceRing
            planned={data.stats.planned}
            done={shown ? data.stats.done : quadrantRecord(0)}
            targets={targets}
            size={188}
            thickness={20}
            label={`Balance real ${data.stats.score ?? "sin datos"}`}
          >
            <span className="text-[40px] leading-none font-semibold tabular-nums">
              {data.stats.score === null ? "—" : score}
            </span>
            <span className="type-label mt-1.5 text-ink-muted">balance real</span>
          </BalanceRing>
          <dl className="flex gap-6 text-center">
            <div>
              <dt className="text-[11px] text-ink-muted">Distribución</dt>
              <dd className="text-[15px] font-semibold tabular-nums">
                {data.stats.planScore === null ? "—" : `${data.stats.planScore}/100`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-muted">Cumplimiento</dt>
              <dd className="text-[15px] font-semibold tabular-nums">
                {data.stats.completion === null ? "—" : `${Math.round(data.stats.completion * 100)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-muted">Horas hechas</dt>
              <dd className="text-[15px] font-semibold tabular-nums">{formatMinutes(data.stats.doneTotal)}</dd>
            </div>
          </dl>
          {comparison && <p className="type-label text-ink-muted">{comparison}</p>}
        </div>

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Por cuadrante">
          {QUADRANTS.map((q) => {
            const real = Math.round(data.stats.real[q.id]);
            const hit = data.stats.done[q.id] > 0 && real >= targets[q.id];
            return (
              <li key={q.id} style={quadrantStyle(q.id)} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full transition-colors duration-300",
                    hit ? "bg-[var(--q)] text-white" : "bg-[var(--q-soft)] text-[var(--q)]",
                  )}
                >
                  <QuadrantIcon id={q.id} className="size-4" />
                </span>
                <span className="text-[11px] font-medium text-ink-muted">{q.name}</span>
                <span className="text-[15px] font-semibold tabular-nums">{real}%</span>
                <span className="text-[11px] text-ink-muted tabular-nums">obj. {targets[q.id]}%</span>
              </li>
            );
          })}
        </ul>

        <section aria-labelledby="recap-wins" className="flex flex-col gap-3">
          <h3 id="recap-wins" className="type-title">
            {data.wins.length ? `Logros de tu ${noun}` : "Logros"}
          </h3>
          {data.wins.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.wins.map((a, i) => (
                <AchievementBadge key={a.id} a={a} index={i} />
              ))}
            </ul>
          ) : (
            <p className="type-body text-ink-muted">
              Esta vez no hubo logros, y está bien. Lo que marcaste igual suma: seguimos la próxima.
            </p>
          )}
        </section>

        <footer className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "items-center justify-end")}>
          <GhostButton onClick={() => onOpenReports(period)}>Ver reporte completo</GhostButton>
          <PrimaryButton autoFocus className={isMobile ? "h-12" : ""} onClick={onClose}>
            Seguir
          </PrimaryButton>
        </footer>
      </div>
    </Sheet>
  );
}
