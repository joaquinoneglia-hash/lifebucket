"use client";

import { ArrowDown } from "lucide-react";
import type { BalanceStats } from "@/lib/balance";
import { cn, formatMinutes } from "@/lib/format";
import type { DateKey } from "@/lib/dates";
import {
  isRoutine,
  LIFE_QUADRANTS,
  QUADRANTS,
  quadrantStyle,
  type Quadrant,
  type QuadrantId,
  type QuadrantRecord,
} from "@/lib/quadrants";
import { sleepTotal } from "@/lib/sleep";
import { usePlanner } from "@/lib/store";
import { QuadrantIcon } from "./QuadrantIcon";

interface BalanceCardProps {
  stats: BalanceStats;
  targets: QuadrantRecord<number>;
  compact?: boolean;
  title?: string;
  /** Días del período: si viene, muestra arriba cuánto se duerme, cuánto es Libre y cuánto actividades. */
  days?: DateKey[];
}

export function ringLabel(
  stats: BalanceStats,
  targets: QuadrantRecord<number>,
): string {
  if (stats.plannedTotal === 0) return "Todavía no hay bloques agendados.";
  const parts = QUADRANTS.map(
    (q) =>
      `${q.name}: agendado ${Math.round(stats.plan[q.id])}% (objetivo ${targets[q.id]}%), cumplido ${formatMinutes(stats.done[q.id])}`,
  );
  return `${parts.join("; ")}.`;
}

const pct = (n: number | null) =>
  n === null ? "—" : `${Math.round(n * 100)}%`;

/**
 * La barra de tres capas: marca fina = objetivo, color suave = lo agendado,
 * color pleno = lo cumplido. Todo medido sobre el 100% de lo agendado.
 */
export function LayeredBar({
  quadrant,
  plan,
  donePct,
  target,
  dark,
  className,
}: {
  quadrant: QuadrantId;
  plan: number;
  donePct: number;
  target: number;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={quadrantStyle(quadrant)}
      className={cn(
        "relative h-2 rounded-full",
        dark ? "bg-white/10" : "bg-surface-sunken",
        className,
      )}
    >
      <div
        className="bar-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.min(plan, 100)}%`,
          background: `color-mix(in oklab, var(--q) ${dark ? 42 : 30}%, ${dark ? "var(--color-ink)" : "white"})`,
        }}
      />
      <div
        className="bar-fill absolute inset-y-0 left-0 rounded-full bg-[var(--q)]"
        style={{ width: `${Math.min(donePct, 100)}%` }}
      />
      <div
        className={cn(
          "absolute -top-1 h-4 w-0.5 rounded-full",
          dark ? "bg-white/70" : "bg-ink/55",
        )}
        style={{ left: `calc(${Math.min(target, 100)}% - 1px)` }}
      />
    </div>
  );
}

/** Referencia de las tres capas, para que se entienda la barra sin explicaciones largas. */
export function LayerLegend({ dark }: { dark?: boolean }) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]",
        dark ? "text-surface/70" : "text-ink-muted",
      )}
    >
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "h-3 w-0.5 rounded-full",
            dark ? "bg-white/70" : "bg-ink/55",
          )}
        />
        Objetivo
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "h-2 w-4 rounded-full",
            dark
              ? "bg-white/25"
              : "bg-[color-mix(in_oklab,var(--color-mente)_30%,white)]",
          )}
        />
        Agendado
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-4 rounded-full bg-[var(--color-mente)]"
        />
        Cumplido
      </li>
    </ul>
  );
}

/** Cuánto duermo, cuánto tengo libre y cuánto en actividades: las dos categorías grandes de la semana. */
export function TimeSplit({
  days,
  stats,
}: {
  days: DateKey[];
  stats: BalanceStats;
}) {
  const sleep = usePlanner((s) => s.sleep);
  const sleepMin = sleepTotal(days, sleep);
  const libre = stats.planned.libre;
  const activities = stats.plannedTotal - libre;
  const total = sleepMin + libre + activities || 1;
  const share = (m: number) => `${Math.round((m / total) * 100)}%`;
  const life = LIFE_QUADRANTS.filter((q) => stats.planned[q.id] > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-ink-muted">Base</span>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <SplitStat
              color="var(--color-sleep)"
              label="Dormir"
              minutes={sleepMin}
              share={share(sleepMin)}
            />
            <SplitStat
              color="var(--color-libre)"
              label="Libre"
              minutes={libre}
              share={share(libre)}
            />
          </div>
        </div>
        <span aria-hidden className="hidden h-10 w-px bg-line sm:block" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-ink-muted">
            Actividades
          </span>
          <SplitStat
            color="var(--color-ink)"
            label="Actividades"
            minutes={activities}
            share={share(activities)}
            hideLabel
          />
        </div>
      </div>
      <div
        className="flex h-3.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Semana: dormir ${share(sleepMin)}, libre ${share(libre)}, actividades ${share(activities)}`}
      >
        <span
          className="bar-fill h-full border-r-2 border-surface"
          style={{
            width: share(sleepMin),
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--color-sleep) 0 5px, color-mix(in oklab, var(--color-sleep) 80%, white) 5px 10px)",
          }}
        />
        <span
          className="bar-fill h-full border-r-2 border-surface bg-[var(--color-libre)]"
          style={{ width: share(libre) }}
        />
        {/* Las actividades, cada una con su color, dentro de su tramo. */}
        {life.map((q) => (
          <span
            key={q.id}
            title={`${q.name}: ${formatMinutes(stats.planned[q.id])}`}
            className="bar-fill h-full border-r border-surface last:border-r-0"
            style={{
              width: share(stats.planned[q.id]),
              background: `var(--color-${q.id})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SplitStat({
  color,
  label,
  minutes,
  share,
  hideLabel,
}: {
  color: string;
  label: string;
  minutes: number;
  share: string;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        aria-hidden
        className="size-2 -translate-y-px rounded-full"
        style={{ background: color }}
      />
      {hideLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="text-[13px] font-medium">{label}</span>
      )}
      <span className="text-[17px] font-semibold tabular-nums">
        {formatMinutes(minutes)}
      </span>
      <span className="text-[12px] text-ink-muted tabular-nums">{share}</span>
    </div>
  );
}

/** Anillo de tres capas + las seis tarjetas de cuadrante: distribución y cumplimiento, separados. */
export function BalanceCard({
  stats,
  targets,
  compact,
  title = "Balance de la semana",
  days,
}: BalanceCardProps) {
  // Sin nada agendado todavía, el peso es el objetivo.
  const weightOf = (id: QuadrantId) =>
    stats.plannedTotal > 0 ? stats.plan[id] : targets[id];
  // Primero lo que se marca (ordenado por peso); Trabajo y Libre, la base, al final y más chicos.
  const byWeight = [
    ...QUADRANTS.filter((q) => !isRoutine(q.id)).sort((a, b) => weightOf(b.id) - weightOf(a.id)),
    ...QUADRANTS.filter((q) => isRoutine(q.id)).sort((a, b) => weightOf(b.id) - weightOf(a.id)),
  ];
  return (
    <section
      aria-label={title}
      className={cn(
        "card flex flex-col",
        compact ? "gap-4 p-4" : "gap-4 px-6 py-5",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="type-title first-letter:uppercase">{title}</h2>
        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[12.5px] tabular-nums">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-muted">Distribución</dt>
            <dd className="font-semibold">
              {stats.planScore === null ? "—" : `${stats.planScore}/100`}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-muted">Cumplimiento</dt>
            <dd className="font-semibold">{pct(stats.completion)}</dd>
          </div>
          <div className="text-ink-muted">
            {stats.plannedTotal === 0
              ? "Agendá bloques para ver cómo se reparte tu semana."
              : `${formatMinutes(stats.plannedTotal)} despierto · ${formatMinutes(stats.doneTotal)} ya vividas`}
          </div>
        </dl>
      </div>
      {days && <TimeSplit days={days} stats={stats} />}
      {/* Ordenadas por peso sobre el total, y cada una tan ancha como lo que pesa (la base va aparte, chica). */}
      <ul className="flex flex-wrap gap-2">
        {byWeight.map((q) => (
          <QuadrantStat
            key={q.id}
            quadrant={q}
            stats={stats}
            target={targets[q.id]}
            weight={isRoutine(q.id) ? 6 : weightOf(q.id)}
            minWidth={compact ? 150 : 132}
          />
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-ink-muted">
        <span className="font-medium text-ink">%</span>: qué parte de tu tiempo
        despierto (el 100%) va a cada cosa, contra tu objetivo.{" "}
        <span className="font-medium text-ink">Barra</span>: cuánto cumpliste de
        lo agendado esta semana.
      </p>
    </section>
  );
}

interface QuadrantStatProps {
  quadrant: Quadrant;
  stats: BalanceStats;
  target: number;
  /** Parte del total (0–100): define el ancho de la tarjeta. */
  weight: number;
  minWidth: number;
}

/**
 * Un cuadrante en dos lecturas que no se parecen a propósito:
 * - Distribución: un número sobre el 100% de tu tiempo despierto, con el objetivo al lado.
 * - Cumplido: una barra verde sobre gris (con un brillo de líquido) de lo agendado que ya pasó.
 */
function QuadrantStat({
  quadrant,
  stats,
  target,
  weight,
  minWidth,
}: QuadrantStatProps) {
  const big = weight >= 25 && !isRoutine(quadrant.id);
  const id = quadrant.id;
  const plan = Math.round(stats.plan[id]);
  const rate = stats.rate[id];
  const routine = isRoutine(id);
  const gap = stats.plannedTotal > 0 ? plan - target : 0;

  return (
    <li
      style={{
        ...quadrantStyle(id),
        flex: `${Math.max(weight, 4)} 1 0`,
        minWidth,
      }}
      aria-label={`${quadrant.name}: ${plan}% de tu tiempo, objetivo ${target}%.${routine ? "" : ` Cumplido ${pct(rate)}.`}`}
      className={cn("flex min-w-0 flex-col gap-2 rounded-lg px-3 py-2.5", routine ? "bg-surface-sunken/60" : "bg-surface-sunken")}
    >
      <div className="flex items-center gap-1.5">
        <QuadrantIcon id={id} className="size-3.5 shrink-0 text-[var(--q)]" />
        <span className="truncate text-[12.5px] font-medium">
          {quadrant.name}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "leading-none font-semibold tracking-[-0.02em] tabular-nums",
            big ? "text-[30px]" : "text-[22px]",
          )}
        >
          {plan}
          <span
            className={cn("font-medium", big ? "text-[16px]" : "text-[13px]")}
          >
            %
          </span>
        </span>
        <span className="text-right text-[11px] leading-tight text-ink-muted tabular-nums">
          obj. {target}%
          {Math.abs(gap) >= 3 && (
            <span className="block font-medium text-ink">
              {gap > 0 ? `+${gap}` : gap} pts
            </span>
          )}
        </span>
      </div>

      {routine ? (
        <p className="text-[11px] leading-tight text-ink-muted">
          {id === "libre" ? "Se vive, no se marca." : "Se respeta el horario, no se marca."}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-ink-muted">Cumplido semana</span>
            <span className="font-semibold tabular-nums">{pct(rate)}</span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="bar-fill liquid-bar h-full rounded-full bg-success"
              style={{ width: `${Math.round((rate ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </li>
  );
}

/** Alto de la barra compacta: los encabezados pegajosos de abajo se acomodan debajo. */
export const COMPACT_BAR_H = 56;

/**
 * El balance comprimido en una barra fija arriba: aparece cuando la tarjeta grande
 * sale de la pantalla, así el calendario usa casi toda la altura.
 */
export function CompactBalance({
  stats,
  targets,
  visible,
  offsetLeft,
}: {
  stats: BalanceStats;
  targets: QuadrantRecord<number>;
  visible: boolean;
  offsetLeft: number;
}) {
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      style={{ left: offsetLeft, height: COMPACT_BAR_H }}
      className={cn(
        "fixed top-0 right-0 z-30 flex items-center gap-3 bg-surface px-4 shadow-[0_1px_0_var(--color-line),0_4px_16px_rgba(142,134,171,0.08)] sm:px-6 lg:px-8",
        "transition-[transform,opacity] duration-200 ease-[var(--ease-out)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0",
      )}
    >
      <div
        className="hidden shrink-0 leading-tight md:block"
        aria-label={ringLabel(stats, targets)}
      >
        <p className="text-[11px] text-ink-muted">Distribución · cumplido</p>
        <p className="text-sm font-semibold tabular-nums">
          {stats.planScore ?? "—"} · {pct(stats.completion)}
        </p>
      </div>
      <ul className="flex min-w-0 flex-1 gap-1 sm:gap-1.5">
        {QUADRANTS.map((q) => {
          const plan = Math.round(stats.plan[q.id]);
          const short = stats.plannedTotal > 0 && plan < targets[q.id] - 4;
          return (
            <li
              key={q.id}
              style={quadrantStyle(q.id)}
              title={`${q.name}: agendado ${plan}% (objetivo ${targets[q.id]}%)`}
              // En mobile los cinco se reparten el ancho; desde sm cada uno toma su tamaño.
              className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-[var(--q-soft)] px-1.5 sm:h-9 sm:flex-none sm:justify-start sm:gap-1.5 sm:pr-3 sm:pl-1"
            >
              <span className="grid shrink-0 place-items-center rounded-full text-[var(--q)] sm:size-7 sm:bg-surface/80">
                <QuadrantIcon id={q.id} className="size-3.5" />
              </span>
              <span className="hidden text-[12px] font-medium text-ink-muted lg:inline">
                {q.name}
              </span>
              <span className="text-[12px] font-semibold tabular-nums sm:text-[13px]">
                {plan}%
              </span>
              {/* Una flechita cuando el cuadrante quedó corto contra su objetivo. */}
              {short && (
                <ArrowDown
                  aria-label="por debajo del objetivo"
                  className="hidden size-3 text-ink-muted sm:block"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
