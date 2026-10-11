"use client";

import { Moon } from "lucide-react";
import { cn } from "@/lib/format";
import { hoursLabel, SLEEP_GOAL_HOURS, SLEEP_RANGE, sleepStats } from "@/lib/sleep-stats";
import { usePlanner } from "@/lib/store";

/** La escala de la barrita: de 4 a 11 h por noche. */
const MIN = 4;
const MAX = 11;
const at = (h: number) => `${((Math.min(MAX, Math.max(MIN, h)) - MIN) / (MAX - MIN)) * 100}%`;

/** La barrita del sueño: la franja recomendada (7–9 h), la meta (8 h) y dónde estás vos. */
function SleepBar({ perNight, thick }: { perNight: number; thick?: boolean }) {
  const ok = perNight >= SLEEP_RANGE[0] && perNight <= SLEEP_RANGE[1];
  return (
    <div className={cn("relative w-full rounded-full bg-surface-sunken", thick ? "h-2.5" : "h-1.5")} aria-hidden>
      {/* Lo recomendado */}
      <span
        className="absolute inset-y-0 rounded-full bg-[color-mix(in_oklab,var(--color-success)_22%,transparent)]"
        style={{ left: at(SLEEP_RANGE[0]), width: `calc(${at(SLEEP_RANGE[1])} - ${at(SLEEP_RANGE[0])})` }}
      />
      {/* Lo que dormís */}
      <span className={cn("absolute inset-y-0 left-0 rounded-full", ok ? "bg-success" : "bg-[#e0922f]")} style={{ width: at(perNight) }} />
      {/* La meta */}
      <span className="absolute -inset-y-1 w-0.5 rounded-full bg-ink/60" style={{ left: at(SLEEP_GOAL_HOURS) }} />
    </div>
  );
}

/** Versión chica para el encabezado: horas por noche y la barrita; al pasar el mouse, el detalle. */
export function SleepPill({ compact }: { compact?: boolean }) {
  const sleep = usePlanner((s) => s.sleep);
  const st = sleepStats(sleep);
  return (
    <div tabIndex={0} className="group relative flex items-center gap-2 rounded-full bg-surface/80 px-3 py-2 shadow-[var(--shadow-card)]">
      <Moon aria-hidden className="size-4 text-[var(--color-sleep)]" />
      <span className="text-[13px] tabular-nums">
        <span className="font-semibold">{hoursLabel(st.perNight)}</span>
        {!compact && <span className="text-ink-muted"> /noche</span>}
      </span>
      {!compact && (
        <span className="w-14">
          <SleepBar perNight={st.perNight} />
        </span>
      )}
      <div role="tooltip" className="pointer-events-none absolute top-full right-0 z-40 mt-3 hidden w-60 rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-popover)] group-hover:block group-focus:block">
        <SleepSummary st={st} />
      </div>
    </div>
  );
}

/** Versión para Resultados. */
export function SleepCard() {
  const sleep = usePlanner((s) => s.sleep);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[12.5px] font-semibold">Sueño</h3>
      <div className="rounded-xl bg-surface-sunken/60 p-3">
        <SleepSummary st={sleepStats(sleep)} big />
      </div>
    </section>
  );
}

function SleepSummary({ st, big }: { st: ReturnType<typeof sleepStats>; big?: boolean }) {
  const text =
    st.status === "ok"
      ? "Con esta organización dormís lo recomendado."
      : st.status === "poco"
        ? `Te faltan ${hoursLabel(SLEEP_RANGE[0] - st.perNight)} por noche para llegar a lo recomendado.`
        : "Dormís más de lo recomendado.";
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline justify-between gap-2">
        <span className={cn("font-semibold tabular-nums", big ? "text-[22px] leading-none" : "text-[13px]")}>
          {hoursLabel(st.perNight)} <span className="text-[12px] font-normal text-ink-muted">por noche</span>
        </span>
        <span className="text-[12px] text-ink-muted tabular-nums">{hoursLabel(st.weekHours)} por semana</span>
      </p>
      <SleepBar perNight={st.perNight} thick={big} />
      <p className="flex justify-between text-[10.5px] text-ink-faint tabular-nums">
        <span>Meta {SLEEP_GOAL_HOURS} h (recomendado {SLEEP_RANGE[0]}–{SLEEP_RANGE[1]} h)</span>
      </p>
      <p className={cn("text-[12px] leading-snug", st.status === "ok" ? "text-success" : "text-ink")}>{text}</p>
    </div>
  );
}
