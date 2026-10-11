"use client";

import { ArrowLeft, ArrowRight, CalendarPlus, Check, Clock3, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeBalance } from "@/lib/balance";
import {
  applyAdjustment,
  roundTo5,
  deferMission,
  proposeMissions,
  scheduleMission,
  suggestAdjustment,
  type Source,
  type TargetAdjustment,
} from "@/lib/coach";
import { addDays, dayLabel, formatWeekRange, fromKey, toKey, type DateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { weekGap, type MissionDraft } from "@/lib/missions";
import { isRoutine, QUADRANT_BY_ID, QUADRANTS, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import { overdueBlocks, periodBlocks } from "@/lib/report";
import { daysBetween } from "@/lib/sleep";
import { targetsAt, usePlanner } from "@/lib/store";
import { formatTime, formatTimeRange, nowMinutes } from "@/lib/time";
import { LayeredBar, LayerLegend } from "./BalanceCard";
import { BalanceRing } from "./BalanceRing";
import { DistributionBars } from "./Distribution";
import { QuadrantIcon } from "./QuadrantIcon";
import { NightsCheck, SleepEditor, sleepSuggestion } from "./Sleep";
import { IdealWeekPanel } from "./TargetsDialog";
import { GhostButton, PrimaryButton, SecondaryButton, Sheet } from "./ui";

const STEPS = ["Cómo venís", "Tu objetivo", "Tu sueño", "Lo pendiente", "Tu semana", "Misiones", "Listo"] as const;

interface RitualProps {
  /** Lunes de la semana que se arma. */
  week: DateKey;
  isMobile: boolean;
  onClose: (result: "done" | "skipped") => void;
}

/**
 * El ritual de reprogramación: un corte para mirar cómo venís, cerrar lo pendiente,
 * ver cómo está armada la semana y salir con misiones concretas para equilibrarla.
 */
export function Ritual({ week, isMobile, onClose }: RitualProps) {
  const [step, setStep] = useState(0);
  const weekStart = fromKey(week);
  const range = { start: week, end: toKey(addDays(weekStart, 6)) };
  const prevRange = { start: toKey(addDays(weekStart, -7)), end: toKey(addDays(weekStart, -1)) };

  return (
    <Sheet isMobile={isMobile} onClose={() => onClose("skipped")} labelledBy="ritual-title" width="max-w-[640px]">
      <div className="flex flex-col gap-6 p-5 sm:p-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-ink-muted">Semana del {formatWeekRange(weekStart)}</p>
              <h2 id="ritual-title" className="type-display">
                Reprogramá tu semana
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onClose("skipped")}
              aria-label="Saltear el ritual esta semana"
              title="Saltear esta semana"
              className="pressable -mt-1 -mr-2 grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="Pasos">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-1.5">
                <span className={cn("h-1 rounded-full transition-colors duration-300", i <= step ? "bg-ink" : "bg-line")} />
                <span className={cn("hidden text-[11px] sm:block", i === step ? "font-semibold text-ink" : "text-ink-muted")}>{s}</span>
              </li>
            ))}
          </ol>
        </header>

        <div key={step} className="animate-fade-up">
          {step === 0 && <StepPast range={prevRange} />}
          {step === 1 && <StepTargets range={prevRange} />}
          {step === 2 && <StepSleep range={prevRange} />}
          {step === 3 && <StepPending />}
          {step === 4 && <StepWeek range={range} />}
          {step === 5 && <StepMissions week={week} />}
          {step === 6 && <StepDone range={range} week={week} />}
        </div>

        <footer className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "items-center justify-between")}>
          {step > 0 ? (
            <GhostButton onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft aria-hidden className="size-4" />
              Atrás
            </GhostButton>
          ) : (
            <GhostButton onClick={() => onClose("skipped")}>Esta semana no</GhostButton>
          )}
          {step < STEPS.length - 1 ? (
            <PrimaryButton autoFocus className={isMobile ? "h-12" : ""} onClick={() => setStep((s) => s + 1)}>
              Seguir
              <ArrowRight aria-hidden className="size-4" />
            </PrimaryButton>
          ) : (
            <PrimaryButton autoFocus className={isMobile ? "h-12" : ""} onClick={() => onClose("done")}>
              Ver mi semana
            </PrimaryButton>
          )}
        </footer>
      </div>
    </Sheet>
  );
}

function StepTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5">
      <h3 className="type-headline">{title}</h3>
      <p className="type-body mt-1 text-ink-muted">{text}</p>
    </div>
  );
}

/** Paso 1: la semana que termina, en tres capas, y si hace falta, un ajuste del objetivo. */
function StepPast({ range }: { range: { start: DateKey; end: DateKey } }) {
  const blocks = usePlanner((s) => s.blocks);
  const history = usePlanner((s) => s.targetsHistory);
  const current = usePlanner((s) => s.targets);
  const targets = targetsAt(history, current, range.start);
  const stats = useMemo(() => computeBalance(periodBlocks(blocks, range), targets), [blocks, range, targets]);
  const [adjustment, setAdjustment] = useState<TargetAdjustment | null>(() => suggestAdjustment());

  return (
    <>
      <StepTitle
        title="Así viene tu balance"
        text={stats.plannedTotal ? "La semana que termina, sin juicio: qué agendaste y qué pudiste sostener." : "La semana pasada no agendaste nada. Arrancamos de cero, que también está bien."}
      />
      {stats.plannedTotal > 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-5">
            <BalanceRing planned={stats.planned} done={stats.done} targets={targets} size={120} thickness={14} label="Semana que termina">
              <span className="text-xl font-semibold tabular-nums">{stats.completion === null ? "—" : `${Math.round(stats.completion * 100)}%`}</span>
              <span className="text-[10px] text-ink-muted">cumplido</span>
            </BalanceRing>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-ink-muted">Distribución</dt>
              <dd className="font-semibold tabular-nums">{stats.planScore}/100</dd>
              <dt className="text-ink-muted">Balance real</dt>
              <dd className="font-semibold tabular-nums">{stats.score ?? "—"}</dd>
              <dt className="text-ink-muted">Horas hechas</dt>
              <dd className="font-semibold tabular-nums">{formatMinutes(stats.doneTotal)}</dd>
            </dl>
          </div>
          <ul className="flex flex-col gap-3">
            {QUADRANTS.map((q) => (
              <li key={q.id} className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-3" style={quadrantStyle(q.id)}>
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  <QuadrantIcon id={q.id} className="size-3.5 text-[var(--q)]" />
                  {q.name}
                </span>
                <LayeredBar quadrant={q.id} plan={stats.plan[q.id]} donePct={stats.plannedTotal ? (stats.done[q.id] / stats.plannedTotal) * 100 : 0} target={targets[q.id]} />
                <span className="w-24 text-right text-[12px] text-ink-muted tabular-nums">
                  {Math.round(stats.plan[q.id])}% · obj {targets[q.id]}%
                </span>
              </li>
            ))}
          </ul>
          <LayerLegend />
        </div>
      )}

      {adjustment && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line p-4" style={quadrantStyle(adjustment.quadrant)}>
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
              <QuadrantIcon id={adjustment.quadrant} className="size-4" />
            </span>
            <div>
              <p className="text-[14px] font-semibold">¿Ajustamos {QUADRANT_BY_ID[adjustment.quadrant].name}?</p>
              <p className="text-[13px] leading-snug text-ink-muted">
                Hace {adjustment.weeks} semanas que agendás bastante menos que tu {adjustment.from}%. Podemos bajarlo a {adjustment.to}% para
                que sea alcanzable, o mantenerlo y armar misiones para llegar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <GhostButton className="h-9" onClick={() => setAdjustment(null)}>
              Mantenerlo
            </GhostButton>
            <SecondaryButton
              className="h-9"
              onClick={() => {
                applyAdjustment(adjustment);
                setAdjustment(null);
              }}
            >
              Bajar a {adjustment.to}%
            </SecondaryButton>
          </div>
        </div>
      )}

    </>
  );
}

/**
 * Paso 2: tu objetivo frente a lo que viviste. Mantenerlo, igualarlo a la semana que
 * termina (si fue un buen balance) o moverlo a mano con las perillas.
 */
function StepTargets({ range }: { range: { start: DateKey; end: DateKey } }) {
  const blocks = usePlanner((s) => s.blocks);
  const current = usePlanner((s) => s.targets);
  const setTargets = usePlanner((s) => s.setTargets);
  const week = useMemo(() => computeBalance(periodBlocks(blocks, range), current), [blocks, range, current]);
  // Promedio de las últimas cuatro semanas con algo agendado.
  const average = useMemo(() => {
    const weeks = [0, 1, 2, 3]
      .map((i) => {
        const start = addDays(fromKey(range.start), -7 * i);
        return computeBalance(periodBlocks(blocks, { start: toKey(start), end: toKey(addDays(start, 6)) }), current);
      })
      .filter((w) => w.plannedTotal > 0 && w.plannedTotal !== w.planned.libre);
    if (!weeks.length) return null;
    return Object.fromEntries(QUADRANTS.map((q) => [q.id, weeks.reduce((acc, w) => acc + w.plan[q.id], 0) / weeks.length])) as Record<QuadrantId, number>;
  }, [blocks, range, current]);
  const [choice, setChoice] = useState<"keep" | "week" | "manual">("keep");
  const [draft, setDraft] = useState(current);
  const [saved, setSaved] = useState(false);
  const hasWeek = week.plannedTotal > 0 && week.plannedTotal !== week.planned.libre;

  return (
    <>
      <StepTitle
        title="¿Seguís con este objetivo?"
        text="Tu objetivo al lado de lo que viviste. Si la semana que termina fue un buen balance, la podés usar como nuevo objetivo."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] text-ink-muted">
              <th className="pb-2 font-medium">Cuadrante</th>
              <th className="pb-2 text-right font-medium">Objetivo</th>
              <th className="pb-2 text-right font-medium">Esta semana</th>
              <th className="pb-2 text-right font-medium">Promedio</th>
              <th className="pb-2 text-right font-medium">Cumplido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {QUADRANTS.map((q) => (
              <tr key={q.id} style={quadrantStyle(q.id)}>
                <td className="py-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <QuadrantIcon id={q.id} className="size-3.5 text-[var(--q)]" />
                    {q.name}
                  </span>
                </td>
                <td className="py-2 text-right font-semibold">{current[q.id]}%</td>
                <td className="py-2 text-right">{hasWeek ? `${Math.round(week.plan[q.id])}%` : "—"}</td>
                <td className="py-2 text-right text-ink-muted">{average ? `${Math.round(average[q.id])}%` : "—"}</td>
                <td className="py-2 text-right text-ink-muted">
                  {isRoutine(q.id) ? "no se marca" : week.rate[q.id] === null ? "—" : `${Math.round((week.rate[q.id] ?? 0) * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div role="radiogroup" aria-label="Qué hacer con tu objetivo" className="mt-5 grid gap-2 sm:grid-cols-3">
        {(
          [
            { id: "keep", title: "Mantenerlo", text: "Sigo apuntando a lo mismo." },
            { id: "week", title: "Igualar a esta semana", text: "Fue un buen balance para mí.", disabled: !hasWeek },
            { id: "manual", title: "Ajustarlo", text: "Rearmo mi semana ideal." },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={choice === o.id}
            disabled={"disabled" in o && o.disabled}
            onClick={() => {
              setChoice(o.id);
              setSaved(false);
              if (o.id === "week") setDraft(roundTo5(week.plan));
            }}
            className={cn(
              "pressable flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left disabled:opacity-40",
              choice === o.id ? "border-ink bg-surface-sunken" : "border-line hover:bg-surface-sunken/60",
            )}
          >
            <span className="text-[13px] font-semibold">{o.title}</span>
            <span className="text-[12px] text-ink-muted">{o.text}</span>
          </button>
        ))}
      </div>

      {choice === "week" && (
        <div className="animate-fade-up mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
          <p className="text-[13px] text-ink-muted">
            Tu nuevo objetivo:{" "}
            {QUADRANTS.map((q) => `${q.name} ${draft[q.id]}%`).join(" · ")}
          </p>
          <div className="flex items-center gap-3">
            {saved && <span role="status" className="text-[12px] text-ink-muted">Objetivo guardado.</span>}
            <PrimaryButton className="h-9" onClick={() => { setTargets(draft); setSaved(true); }}>
              Usar como objetivo
            </PrimaryButton>
          </div>
        </div>
      )}
      {choice === "manual" && (
        <div className="animate-fade-up mt-5 rounded-xl border border-line p-4">
          {saved ? (
            <p role="status" className="text-[13px] text-ink-muted">Guardaste tu semana ideal: desde hoy es tu rutina y su % es tu objetivo.</p>
          ) : (
            <IdealWeekPanel onSaved={() => setSaved(true)} />
          )}
        </div>
      )}
    </>
  );
}

/** Paso 2: el sueño de la semana que termina, noche por noche. No entra en el balance, pero sostiene todo. */
function StepSleep({ range }: { range: { start: DateKey; end: DateKey } }) {
  const sleep = usePlanner((s) => s.sleep);
  const log = usePlanner((s) => s.sleepLog);
  const setSleep = usePlanner((s) => s.setSleep);
  const days = daysBetween(range.start, range.end);
  const suggestion = sleepSuggestion(days, log, sleep);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sleep);

  if (editing) {
    return (
      <>
        <StepTitle title="Tu horario de sueño" text="Que sea realista: un horario que podés sostener vale más que uno ideal." />
        <SleepEditor value={draft} onChange={setDraft} />
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton className="h-9" onClick={() => setEditing(false)}>Cancelar</GhostButton>
          <PrimaryButton className="h-9" onClick={() => { setSleep(draft); setEditing(false); }}>Guardar horario</PrimaryButton>
        </div>
      </>
    );
  }

  return (
    <>
      <StepTitle title="¿Cómo dormiste?" text="Tu sueño no entra en el balance, pero sostiene todo lo demás. Marcá cómo fue cada noche." />
      <NightsCheck days={days} />
      {suggestion && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line p-4">
          <p className="text-[13px] leading-snug">
            Te acostaste tarde {suggestion.late} noches. ¿Pasamos tu hora de dormir de {formatTime(suggestion.from)} a {formatTime(suggestion.to)} para que sea más real, o la mantenemos?
          </p>
          <div className="flex justify-end gap-2">
            <GhostButton className="h-9" onClick={() => setEditing(true)}>Elegir otro horario</GhostButton>
            <SecondaryButton className="h-9" onClick={() => setSleep({ ...sleep, weekday: { ...sleep.weekday, bed: suggestion.to } })}>
              Pasar a {formatTime(suggestion.to)}
            </SecondaryButton>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setEditing(true)} className="mt-4 text-[13px] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        Cambiar mi horario de sueño
      </button>
    </>
  );
}

/** Paso 3: cerrar lo que quedó sin marcar, con un toque por bloque. */
function StepPending() {
  const blocks = usePlanner((s) => s.blocks);
  const setStatus = usePlanner((s) => s.setStatus);
  // La lista se fija al entrar: lo que marcás se queda visible con su respuesta.
  const [ids] = useState(() => overdueBlocks(blocks, toKey(new Date()), nowMinutes()).slice(0, 12).map((b) => b.id));
  const items = ids.map((id) => blocks.find((b) => b.id === id)).filter((b) => !!b);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="animate-check-pop grid size-12 place-items-center rounded-full bg-ink text-surface">
          <Check aria-hidden className="size-5" strokeWidth={2.5} />
        </span>
        <h3 className="type-headline">Todo al día</h3>
        <p className="type-body text-ink-muted">No quedó nada sin marcar. Sigamos.</p>
      </div>
    );
  }

  return (
    <>
      <StepTitle title="Lo que quedó pendiente" text="Marcá lo que hiciste. Lo que no, no pasa nada: suma igual que lo registres." />
      <ul className="flex flex-col gap-2">
        {items.map((b) => (
          <li key={b.id} style={quadrantStyle(b.quadrant)} className="flex items-center gap-3 rounded-lg bg-[var(--q-soft)] px-3 py-2">
            <QuadrantIcon id={b.quadrant} className="size-4 shrink-0 text-[var(--q)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{b.title}</p>
              <p className="text-[12px] text-[color-mix(in_oklab,var(--q)_55%,var(--color-ink))] first-letter:uppercase tabular-nums">
                {dayLabel(b.date)} · {formatTimeRange(b.start, b.minutes)}
              </p>
            </div>
            {b.status === "pending" ? (
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setStatus(b.id, "done")} className="pressable h-8 rounded-md bg-ink px-3 text-[12px] font-medium text-surface">
                  Lo hice
                </button>
                <button type="button" onClick={() => setStatus(b.id, "skipped")} className="pressable h-8 rounded-md bg-surface px-3 text-[12px] font-medium text-ink-muted hover:text-ink">
                  No pude
                </button>
              </div>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-muted">
                {b.status === "done" ? <Check aria-hidden className="size-3.5" /> : null}
                {b.status === "done" ? "Hecho" : "No se hizo"}
                <button type="button" onClick={() => setStatus(b.id, "pending")} className="ml-1 underline-offset-2 hover:text-ink hover:underline">
                  deshacer
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Paso 3: cómo está repartida la semana que viene contra el objetivo, en horas concretas. */
function StepWeek({ range }: { range: { start: DateKey; end: DateKey } }) {
  const blocks = usePlanner((s) => s.blocks);
  const targets = usePlanner((s) => s.targets);
  const { stats, gap, reference } = useMemo(() => weekGap(range.start, blocks, targets), [blocks, range.start, targets]);

  return (
    <>
      <StepTitle
        title="Cómo está armada tu semana"
        text={
          !stats.plannedTotal
            ? "Tu semana todavía está vacía. En el próximo paso te propongo por dónde arrancar."
            : `Tus ${formatMinutes(reference)} despierto de la semana, repartidas contra tu balance ideal. Lo que no es una actividad cuenta como Libre.`
        }
      />
      <DistributionBars
        rows={[
          { label: "Tu objetivo", values: targets },
          { label: "Lo agendado", values: stats.plan, empty: "Nada agendado todavía" },
        ]}
      />
      {stats.plannedTotal > 0 && (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {QUADRANTS.map((q) => {
            const g = gap[q.id];
            const ok = Math.abs(g) < 45;
            return (
              <li key={q.id} style={quadrantStyle(q.id)} className="flex items-center gap-2.5 rounded-lg bg-surface-sunken/70 px-3 py-2.5">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                  <QuadrantIcon id={q.id} className="size-3.5" />
                </span>
                <span className="text-[13px] font-medium">{q.name}</span>
                <span className="ml-auto text-[12px] text-ink-muted tabular-nums">
                  {ok ? "En su lugar" : g > 0 ? `Faltan ${formatMinutes(g)}` : `Sobran ${formatMinutes(-g)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

type Decision = "scheduled" | "later" | "dismissed";

/** Paso 4: misiones concretas (IA o reglas) para acercar la semana al objetivo. */
function StepMissions({ week }: { week: DateKey }) {
  const [state, setState] = useState<{ intro: string; missions: MissionDraft[]; source: Source } | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [slots, setSlots] = useState<Record<number, MissionDraft["slots"]>>({});

  useEffect(() => {
    let alive = true;
    proposeMissions(week).then((r) => {
      if (!alive) return;
      setState(r);
      setSlots(Object.fromEntries(r.missions.map((m, i) => [i, m.slots])));
    });
    return () => {
      alive = false;
    };
  }, [week]);

  if (!state) {
    return (
      <p className="flex items-center gap-2 py-10 text-[14px] text-ink-muted" role="status">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((d) => (
            <span key={d} className="animate-typing size-1.5 rounded-full bg-ink-muted" style={{ animationDelay: `${d * 160}ms` }} />
          ))}
        </span>
        Buscando qué le falta a tu semana…
      </p>
    );
  }

  const decide = (i: number, d: Decision) => {
    const m = state.missions[i];
    if (d === "scheduled") scheduleMission(m, week, slots[i]);
    if (d === "later") deferMission(m, week);
    setDecisions((x) => ({ ...x, [i]: d }));
  };

  return (
    <>
      <StepTitle title="Misiones de la semana" text={state.intro} />
      {state.missions.length === 0 && (
        <p className="type-body rounded-lg bg-surface-sunken/70 p-4">Tu semana ya está bien repartida. Nada que sumar.</p>
      )}
      <ul className="flex flex-col gap-3">
        {state.missions.map((m, i) => {
          const d = decisions[i];
          const mySlots = slots[i] ?? [];
          return (
            <li key={i} style={quadrantStyle(m.quadrant)} className={cn("flex flex-col gap-3 rounded-xl border p-4 transition-opacity duration-200", d ? "border-line opacity-70" : "border-[color-mix(in_oklab,var(--q)_35%,transparent)] bg-[color-mix(in_oklab,var(--q-soft)_50%,white)]")}>
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--q)] text-white">
                  <QuadrantIcon id={m.quadrant} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{m.title}</p>
                  <p className="text-[13px] leading-snug text-ink-muted">{m.why}</p>
                </div>
              </div>
              {mySlots.length > 0 && !d && (
                <div className="flex flex-wrap gap-1.5" aria-label="Horarios sugeridos">
                  {mySlots.map((s, j) => (
                    <span key={j} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface pr-1 pl-3 text-[12px] font-medium tabular-nums">
                      <span className="first-letter:uppercase">{dayLabel(s.date)}</span> · {formatTime(s.start)}
                      <button
                        type="button"
                        aria-label={`Quitar ${dayLabel(s.date)} ${formatTime(s.start)}`}
                        onClick={() => setSlots((x) => ({ ...x, [i]: mySlots.filter((_, k) => k !== j) }))}
                        className="grid size-6 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        <X aria-hidden className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {d ? (
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
                  {d === "scheduled" && <><CalendarPlus aria-hidden className="size-3.5" /> Agendada en tu semana</>}
                  {d === "later" && <><Clock3 aria-hidden className="size-3.5" /> Quedó como tarea para agendar</>}
                  {d === "dismissed" && "Esta semana no"}
                </p>
              ) : (
                <div className="flex flex-wrap justify-end gap-1.5">
                  <GhostButton className="h-9" onClick={() => decide(i, "dismissed")}>
                    Esta semana no
                  </GhostButton>
                  <SecondaryButton className="h-9" onClick={() => decide(i, "later")}>
                    Lo agendo después
                  </SecondaryButton>
                  {mySlots.length > 0 && (
                    <PrimaryButton className="h-9 px-4" onClick={() => decide(i, "scheduled")}>
                      Agendar {mySlots.length === 1 ? "" : `${mySlots.length} veces`}
                    </PrimaryButton>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
        <Sparkles aria-hidden className="size-3" />
        {state.source === "ai" ? "Misiones pensadas con IA a partir de tu semana" : "Misiones calculadas con lo que le falta a tu semana"}
      </p>
    </>
  );
}

/** Paso 5: cómo quedó armada la semana. */
function StepDone({ range, week }: { range: { start: DateKey; end: DateKey }; week: DateKey }) {
  const blocks = usePlanner((s) => s.blocks);
  const targets = usePlanner((s) => s.targets);
  const allMissions = usePlanner((s) => s.missions);
  const missions = useMemo(() => allMissions.filter((m) => m.week === week && m.status !== "dismissed"), [allMissions, week]);
  const stats = useMemo(() => computeBalance(periodBlocks(blocks, range), targets), [blocks, range, targets]);
  const score = stats.planScore;
  const message =
    score === null
      ? "Tu semana está liviana. A veces eso también es balance."
      : score >= 85
        ? "Tu semana quedó muy bien balanceada."
        : score >= 70
          ? "Tu semana quedó bastante balanceada."
          : "Es un buen arranque. Lo importante es que la miraste.";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <BalanceRing planned={stats.planned} done={stats.done} targets={targets} size={168} thickness={18} label={`Distribución ${score ?? "sin datos"}`}>
        <span className="text-[36px] leading-none font-semibold tabular-nums">{score ?? "—"}</span>
        <span className="mt-1 text-[11px] text-ink-muted">distribución</span>
      </BalanceRing>
      <h3 className="type-headline">{message}</h3>
      <p className="type-body max-w-[44ch] text-ink-muted">
        {missions.length
          ? `Tenés ${missions.length === 1 ? "1 misión" : `${missions.length} misiones`} para esta semana. Las vas a ver arriba de tu calendario.`
          : "Nos vemos en el próximo ritual."}
      </p>
    </div>
  );
}
