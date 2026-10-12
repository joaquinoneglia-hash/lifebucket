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

/** El botón del encabezado para configurar el sueño; al pasar el mouse, cuánto dormís. */
export function SleepPill({ compact, onClick }: { compact?: boolean; onClick?: () => void }) {
  const sleep = usePlanner((s) => s.sleep);
  const st = sleepStats(sleep);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sueño: ${hoursLabel(st.perNight)} por noche. Tocá para configurarlo`}
      className={cn(
        "pressable group relative flex items-center rounded-full bg-surface/80 text-left shadow-[var(--shadow-card)] hover:bg-surface",
        compact ? "gap-1.5 px-2.5 py-1.5 max-[359px]:gap-1 max-[359px]:px-2" : "gap-2 px-3.5 py-2",
      )}
    >
      <Moon aria-hidden className="size-4 shrink-0 text-[var(--color-sleep)]" />
      {compact ? (
        <span className="flex flex-col text-[10.5px] leading-[1.15] font-medium max-[359px]:text-[9.5px]">
          <span className="text-ink-muted">Configurar</span>
          <span className="whitespace-nowrap">horarios de sueño</span>
        </span>
      ) : (
        <span className="text-[13px] font-medium whitespace-nowrap">Configurar horarios de sueño</span>
      )}
      {/* En compu se abre hacia la izquierda (la pastilla está a la derecha); en el celular, hacia adentro. */}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-40 mt-3 hidden w-60 max-w-[calc(100vw-32px)] rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-popover)] [@media(hover:hover)]:group-hover:block",
          compact ? "left-0" : "right-0",
        )}
      >
        <SleepSummary st={st} />
      </div>
    </button>
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
