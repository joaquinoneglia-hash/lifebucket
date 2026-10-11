"use client";

import { CalendarSync, ChevronLeft, ChevronRight, Lightbulb, PartyPopper, SlidersHorizontal, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { computeBalance } from "@/lib/balance";
import { fromKey, startOfWeek, toKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { isRoutine, QUADRANTS, quadrantStyle } from "@/lib/quadrants";
import {
  achievements,
  buckets,
  periodBlocks,
  periodLabel,
  periodOf,
  quadrantReports,
  recommendations,
  shiftPeriod,
  THIS_PERIOD,
  trend,
  type Period,
  type PeriodKind,
} from "@/lib/report";
import { daysBetween } from "@/lib/sleep";
import { targetsAt, usePlanner } from "@/lib/store";
import { formatTime } from "@/lib/time";
import { LayeredBar, LayerLegend, ringLabel, TimeSplit } from "./BalanceCard";
import { BalanceRing } from "./BalanceRing";
import { BucketsTable, QuadrantLegend, StackedBars, TrendLine } from "./charts";
import { DistributionBars } from "./Distribution";
import { QuadrantIcon } from "./QuadrantIcon";
import { SleepCard } from "./Sleep";
import { AchievementBadge } from "./Recap";
import { Segmented, Select } from "./ui";

const KINDS = [
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "year", label: "Año" },
] as const satisfies readonly { id: PeriodKind; label: string }[];

const BARS_TITLE: Record<PeriodKind, string> = {
  week: "Horas cumplidas por día",
  month: "Horas cumplidas por día",
  year: "Horas cumplidas por mes",
};

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

interface ReportViewProps {
  period: Period;
  onPeriodChange: (p: Period) => void;
  onSchedule: (activityId: string | undefined, minutes: number) => void;
  onEditTargets: () => void;
  onOpenRecap: (p: Period) => void;
  onReprogram: () => void;
}

export function ReportView({ period, onPeriodChange, onSchedule, onEditTargets, onOpenRecap, onReprogram }: ReportViewProps) {
  const blocks = usePlanner((s) => s.blocks);
  const current = usePlanner((s) => s.targets);
  const history = usePlanner((s) => s.targetsHistory);
  const activities = usePlanner((s) => s.activities);
  const missions = usePlanner((s) => s.missions);
  const [asTable, setAsTable] = useState(false);
  const todayKey = toKey(new Date());
  // Cada período se mide contra el objetivo que regía entonces.
  const targets = useMemo(() => targetsAt(history, current, period.start), [history, current, period.start]);

  const data = useMemo(() => {
    const mine = periodBlocks(blocks, period);
    const stats = computeBalance(mine, targets);
    const reports = quadrantReports(mine, stats, targets, todayKey);
    const firstWeek = toKey(startOfWeek(fromKey(period.start)));
    const periodMissions = missions.filter((m) => m.week >= firstWeek && m.week <= period.end && m.status !== "dismissed");
    const missionDone = periodMissions.filter(
      (m) => blocks.filter((b) => m.blockIds.includes(b.id) && b.status === "done").length >= m.count,
    ).length;
    return {
      stats,
      bars: buckets(mine, period),
      line: trend(blocks, targets, period, todayKey),
      wins: achievements(mine, stats, targets, period.kind, todayKey),
      recs: recommendations(mine, reports, activities, todayKey),
      missions: { total: periodMissions.length, done: missionDone },
    };
  }, [blocks, targets, activities, missions, period, todayKey]);

  const { stats } = data;
  const isCurrent = period.start <= todayKey && todayKey <= period.end;
  const isFuture = period.start > todayKey;
  const hardest = QUADRANTS.filter((q) => stats.rate[q.id] !== null).sort(
    (a, b) => (stats.rate[a.id] ?? 0) - (stats.rate[b.id] ?? 0),
  )[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Período"
          options={KINDS}
          value={period.kind}
          onChange={(k) => onPeriodChange(periodOf(k, new Date()))}
          className="w-full sm:w-auto"
        />
        <div className="flex items-center gap-1">
          <NavButton label="Período anterior" onClick={() => onPeriodChange(shiftPeriod(period, -1))}>
            <ChevronLeft aria-hidden className="size-4" />
          </NavButton>
          <span className="min-w-[120px] text-center text-sm font-semibold first-letter:uppercase">{periodLabel(period)}</span>
          <NavButton label="Período siguiente" onClick={() => onPeriodChange(shiftPeriod(period, 1))}>
            <ChevronRight aria-hidden className="size-4" />
          </NavButton>
        </div>
      </div>

      {/* Hero oscuro: la firma de esta vista, para que no se confunda con el calendario. */}
      <section aria-label="Resumen del balance" className="relative overflow-hidden rounded-2xl bg-ink p-6 text-surface sm:p-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center">
          <BalanceRing planned={stats.planned} done={stats.done} targets={targets} size={196} thickness={20} dark label={ringLabel(stats, targets)}>
            <span className="text-[40px] leading-none font-semibold tabular-nums">{stats.planScore ?? "—"}</span>
            <span className="mt-1 text-[11px] text-surface/60">distribución</span>
          </BalanceRing>
          <div className="flex w-full flex-col gap-5">
            <h2 className="type-headline first-letter:uppercase">Tu balance · {periodLabel(period)}</h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Metric
                label="Distribución"
                value={stats.planScore === null ? "—" : `${stats.planScore}`}
                unit="/100"
                hint="Qué tan cerca está lo que agendaste de tu objetivo."
              />
              <Metric
                label="Cumplimiento"
                value={stats.completion === null ? "—" : `${Math.round(stats.completion * 100)}`}
                unit="%"
                hint="De lo agendado que ya pasó, cuánto hiciste."
              />
              <Metric
                label="Balance real"
                value={stats.score === null ? "—" : `${stats.score}`}
                unit="/100"
                hint="Cómo se repartió lo que de verdad hiciste."
              />
            </dl>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onReprogram}
                className="pressable inline-flex h-10 items-center gap-1.5 rounded-md bg-surface px-4 text-[13px] font-semibold text-ink hover:bg-surface/90"
              >
                <CalendarSync aria-hidden className="size-4" />
                Reprogramar semana
              </button>
              <button
                type="button"
                onClick={onEditTargets}
                className="pressable inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-surface/80 hover:bg-white/10 hover:text-surface"
              >
                <SlidersHorizontal aria-hidden className="size-4" />
                Objetivo
              </button>
              {period.kind !== "year" && stats.doneTotal > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenRecap(period)}
                  className="pressable inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-surface/80 hover:bg-white/10 hover:text-surface"
                >
                  <PartyPopper aria-hidden className="size-4" />
                  Resumen
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="split-title">
        <h2 id="split-title" className="type-title">
          Tu tiempo · {periodLabel(period)}
        </h2>
        <TimeSplit days={daysBetween(period.start, period.end)} stats={stats} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="dist-title">
          <div>
            <h2 id="dist-title" className="type-title">
              ¿A dónde va tu 100%?
            </h2>
            <p className="text-[12px] text-ink-muted">Tu objetivo, cómo lo agendaste y cómo lo viviste, uno debajo del otro.</p>
          </div>
          <DistributionBars
            rows={[
              { label: "Objetivo", values: targets },
              { label: "Agendado", values: stats.plan, empty: "Nada agendado" },
              { label: "Cumplido", values: stats.real, empty: "Nada cumplido todavía" },
            ]}
          />
          <QuadrantLegend />
        </section>

        <section className="card flex flex-col gap-4 p-5" aria-labelledby="comp-title">
          <div>
            <h2 id="comp-title" className="type-title">
              Cumplimiento por cuadrante
            </h2>
            <p className="text-[12px] text-ink-muted">
              {stats.completion === null
                ? "Cuando pasen días con bloques, vas a ver acá qué sostuviste."
                : `De lo agendado que ya pasó, hiciste ${Math.round(stats.completion * 100)}%.`}
            </p>
          </div>
          <ul className="flex flex-col gap-3.5">
            {/* Solo lo que se marca: Trabajo y Libre no se cumplen, se viven. */}
            {QUADRANTS.filter((q) => !isRoutine(q.id)).map((q) => {
              const rate = stats.rate[q.id];
              return (
                <li key={q.id} style={quadrantStyle(q.id)} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <QuadrantIcon id={q.id} className="size-3.5 text-[var(--q)]" />
                    <span className="text-[13px] font-medium">{q.name}</span>
                    {hardest?.id === q.id && (rate ?? 1) < 0.7 && (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-ink-muted">el que más costó</span>
                    )}
                    <span className="ml-auto text-[12px] text-ink-muted tabular-nums">
                      {stats.due[q.id] > 0 ? `${formatMinutes(stats.done[q.id])} de ${formatMinutes(stats.due[q.id])}` : "—"}
                    </span>
                    <span className="w-10 text-right text-[13px] font-semibold tabular-nums">{rate === null ? "—" : `${Math.round(rate * 100)}%`}</span>
                  </div>
                  <LayeredBar
                    quadrant={q.id}
                    plan={stats.plan[q.id]}
                    donePct={stats.plannedTotal ? (stats.done[q.id] / stats.plannedTotal) * 100 : 0}
                    target={targets[q.id]}
                  />
                </li>
              );
            })}
          </ul>
          <LayerLegend />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="bars-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bars-title" className="type-title">
              {BARS_TITLE[period.kind]}
            </h2>
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              className="pressable rounded-md px-2 py-1 text-[12px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {asTable ? "Ver gráfico" : "Ver como tabla"}
            </button>
          </div>
          {asTable ? (
            <BucketsTable data={data.bars} />
          ) : (
            <>
              <QuadrantLegend />
              <StackedBars data={data.bars} />
            </>
          )}
        </section>

        <section className="card flex flex-col gap-4 p-5" aria-labelledby="trend-title">
          <div>
            <h2 id="trend-title" className="type-title">
              Semana a semana
            </h2>
            <p className="text-[12px] text-ink-muted">De 0 a 100: cómo armaste cada semana y cómo la viviste.</p>
          </div>
          <TrendLine data={data.line} />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="recs-title">
          <h2 id="recs-title" className="type-title">
            Recomendaciones
          </h2>
          {data.recs.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.recs.map((r) => (
                <li key={r.id} style={r.quadrant ? quadrantStyle(r.quadrant) : undefined} className="flex gap-3 rounded-lg bg-surface-sunken/70 p-3">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full",
                      r.quadrant ? "bg-[var(--q-soft)] text-[var(--q)]" : "bg-surface text-ink",
                    )}
                  >
                    {r.quadrant ? <QuadrantIcon id={r.quadrant} className="size-4" /> : <Lightbulb aria-hidden className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{r.title}</p>
                    <p className="text-[12.5px] leading-snug text-ink-muted">{r.body}</p>
                    {r.action && !isFuture && (
                      <button
                        type="button"
                        onClick={() => onSchedule(r.action!.activityId, r.action!.minutes)}
                        className="pressable mt-2 inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-[12px] font-medium hover:bg-surface-sunken"
                      >
                        Agendar un bloque
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-ink-muted">
              {isFuture ? "Este período todavía no empezó." : "Cuando marques algunos bloques como cumplidos te vamos a sugerir cómo equilibrar."}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="card flex items-center gap-4 p-5" aria-labelledby="missions-sum-title">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink">
              <Target aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="missions-sum-title" className="type-title">
                Misiones
              </h2>
              <p className="text-[13px] text-ink-muted tabular-nums">
                {data.missions.total
                  ? `Cumpliste ${data.missions.done} de ${data.missions.total} ${isCurrent ? `de ${THIS_PERIOD[period.kind]}` : "del período"}.`
                  : "Las misiones nacen en el ritual de reprogramación."}
              </p>
            </div>
          </section>
          <SleepCard days={daysBetween(period.start, period.end < todayKey ? period.end : todayKey)} />
          <RitualSettings />
        </div>
      </div>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="wins-title">
        <h2 id="wins-title" className="type-title">
          Logros {isCurrent ? `de ${THIS_PERIOD[period.kind]}` : `de ${periodLabel(period)}`}
        </h2>
        {data.wins.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.wins.map((a, i) => (
              <AchievementBadge key={a.id} a={a} index={i} />
            ))}
          </ul>
        ) : (
          <p className="type-body text-ink-muted">
            Todavía no hay logros acá. Equilibrio, constancia, los cinco cuadrantes: se desbloquean a medida que marcás.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, unit, hint }: { label: string; value: string; unit: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-white/15 pl-4">
      <dt className="text-[12px] font-medium text-surface/70">{label}</dt>
      <dd className="flex items-baseline gap-0.5">
        <span className="text-[30px] leading-none font-semibold tabular-nums">{value}</span>
        {value !== "—" && <span className="text-[13px] text-surface/60">{unit}</span>}
      </dd>
      <p className="text-[12px] leading-snug text-surface/60">{hint}</p>
    </div>
  );
}

/** Cuándo se abre solo el ritual de reprogramar. */
function RitualSettings() {
  const ritual = usePlanner((s) => s.ritual);
  const setRitual = usePlanner((s) => s.setRitual);
  return (
    <section className="card flex flex-col gap-3 p-5" aria-labelledby="ritual-settings-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ritual-settings-title" className="type-title">
          Tu ritual semanal
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-muted">
          <input
            type="checkbox"
            checked={ritual.enabled}
            onChange={(e) => setRitual({ enabled: e.target.checked })}
            className="size-4 accent-[var(--color-ink)]"
          />
          Abrir solo
        </label>
      </div>
      <p className="text-[12px] text-ink-muted">Un momento fijo para mirar cómo venís y armar la semana.</p>
      <div className={cn("flex gap-2", !ritual.enabled && "pointer-events-none opacity-50")}>
        <Select
          label="Día del ritual"
          value={String(ritual.day)}
          onChange={(v) => setRitual({ day: Number(v) })}
          options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAYS[d].charAt(0).toUpperCase() + DAYS[d].slice(1) }))}
          className="flex-1"
        />
        <Select
          label="Hora del ritual"
          value={String(ritual.hour)}
          onChange={(v) => setRitual({ hour: Number(v) })}
          options={Array.from({ length: 17 }, (_, i) => i + 6).map((h) => ({ value: String(h), label: formatTime(h * 60) }))}
          className="w-28"
        />
      </div>
    </section>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pressable grid size-9 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </button>
  );
}
