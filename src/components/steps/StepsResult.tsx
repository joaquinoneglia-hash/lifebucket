"use client";

import { AlertTriangle, ArrowLeft, Check, Lightbulb, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AVERAGE_WEEK } from "@/lib/benchmarks";
import { cn } from "@/lib/format";
import { partStyle } from "@/lib/mode";
import type { RoutineBlock } from "@/lib/routine";
import { play } from "@/lib/sfx";
import type { SleepSettings } from "@/lib/sleep";
import { advice, propose, stepMinutes } from "@/lib/steps";
import { useSteps, type Cat } from "@/lib/steps-store";
import { usePlanner } from "@/lib/store";
import { formatTime } from "@/lib/time";
import { WEEK_MINUTES, type Part } from "@/lib/week-shares";
import { QuadrantIcon } from "../QuadrantIcon";
import { CATS, daysLabel, StepTitle, useNav, WeekPreview } from "./StepsApp";

/** Las partes que se miden en los pasos (Vínculos va por Momentos, en la app). */
const PARTS_SHOWN: { id: Part; label: string }[] = [
  { id: "sueno", label: "Sueño" },
  { id: "trabajo", label: "Trabajo" },
  { id: "cuerpo", label: "Cuerpo" },
  { id: "mente", label: "Mente" },
  { id: "alma", label: "Disfrute" },
  { id: "libre", label: "Libre" },
];
const AVG: Partial<Record<Part, number>> = { sueno: AVERAGE_WEEK.dormir, trabajo: AVERAGE_WEEK.trabajo, cuerpo: AVERAGE_WEEK.cuerpo, mente: AVERAGE_WEEK.mente, alma: AVERAGE_WEEK.alma, libre: AVERAGE_WEEK.libre };
const color = (p: Part) => (p === "libre" ? "#aab1be" : p === "sueno" ? "var(--color-sleep)" : `var(--color-${p})`);
const hours = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;

/** Tu semana entera (168 h) en una sola barra de colores. */
function WeekBar({ routine, sleep }: { routine: RoutineBlock[]; sleep: SleepSettings }) {
  const m = stepMinutes(routine, sleep);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {PARTS_SHOWN.filter((p) => m[p.id] > 0).map((p) => (
          <span key={p.id} className="animate-welcome-fill h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(m[p.id] / WEEK_MINUTES) * 100}%`, background: color(p.id) }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted">
        {PARTS_SHOWN.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: color(p.id) }} />
            {p.label} <span className="font-semibold text-ink tabular-nums">{Math.round((m[p.id] / WEEK_MINUTES) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Una barra por parte: tus horas por semana, con la marca de una persona promedio. Con `before`,
 * muestra también cómo era antes (para comparar).
 */
function PartBars({ routine, sleep, before }: { routine: RoutineBlock[]; sleep: SleepSettings; before?: RoutineBlock[] }) {
  const m = stepMinutes(routine, sleep);
  const b = before ? stepMinutes(before, sleep) : null;
  const max = Math.max(...PARTS_SHOWN.map((p) => Math.max(m[p.id], b?.[p.id] ?? 0, (AVG[p.id] ?? 0) * 60)), 60);
  return (
    <ul className="flex flex-col gap-3.5">
      {PARTS_SHOWN.map((p) => {
        const delta = b ? m[p.id] - b[p.id] : 0;
        return (
          <li key={p.id} style={partStyle(p.id as never)} className="flex flex-col gap-1">
            <span className="flex items-baseline gap-2 text-[13.5px]">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="size-2.5 rounded-full" style={{ background: color(p.id) }} />
                {p.label}
              </span>
              <span className="ml-auto text-ink-muted tabular-nums">{hours(m[p.id])} por semana</span>
              <span className="w-10 text-right font-semibold tabular-nums">{Math.round((m[p.id] / WEEK_MINUTES) * 100)}%</span>
            </span>
            <span className="relative block h-3 overflow-hidden rounded-full bg-surface-sunken">
              {b && <span className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${(b[p.id] / max) * 100}%`, background: color(p.id) }} />}
              <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${(m[p.id] / max) * 100}%`, background: color(p.id) }} />
              {AVG[p.id] != null && !b && <span title="Una persona promedio" className="absolute inset-y-[-2px] w-[2px] rounded-full bg-ink/50" style={{ left: `${((AVG[p.id]! * 60) / max) * 100}%` }} />}
            </span>
            {b && delta !== 0 ? (
              <span className={cn("text-[11.5px] font-semibold tabular-nums", delta > 0 ? "text-success" : "text-ink-muted")}>
                {delta > 0 ? "+" : "−"}
                {hours(Math.abs(delta))} respecto de antes
              </span>
            ) : (
              AVG[p.id] != null && !b && <span className="text-[11px] text-ink-faint tabular-nums">Una persona promedio: {AVG[p.id]} h</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lo que más tiempo te lleva (por nombre). */
function TopActivities({ routine }: { routine: RoutineBlock[] }) {
  const by = new Map<string, { q: Cat; m: number }>();
  for (const b of routine) {
    const cur = by.get(b.name) ?? { q: b.quadrant as Cat, m: 0 };
    cur.m += b.minutes * b.days.length;
    by.set(b.name, cur);
  }
  const top = [...by.entries()].sort((a, b) => b[1].m - a[1].m).slice(0, 5);
  if (!top.length) return null;
  return (
    <ol className="flex flex-col gap-2">
      {top.map(([name, v], i) => (
        <li key={name} style={partStyle(v.q)} className="flex items-center gap-3">
          <span className="w-4 text-[12px] font-semibold text-ink-faint tabular-nums">{i + 1}</span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
            <QuadrantIcon id={v.q} className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{name}</span>
          <span className="text-[13px] font-semibold tabular-nums">{hours(v.m)}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- Paso 8: así es tu vida hoy

export function ResultStep() {
  const { back } = useNav();
  const routine = useSteps((s) => s.routine);
  const sleep = useSteps((s) => s.sleep);
  const go = useSteps((s) => s.go);
  const setHappy = useSteps((s) => s.setHappy);
  const report = advice(routine, sleep);

  return (
    <>
      <StepTitle kicker="Paso 8 · Resultado" title="Así es tu vida hoy">
        Tu semana tipo entera, 168 horas, repartida en cada parte de tu vida.
      </StepTitle>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-4 p-5">
            <WeekBar routine={routine} sleep={sleep} />
          </section>
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="text-[16px] font-semibold">Parte por parte</h2>
            <PartBars routine={routine} sleep={sleep} />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Sparkles aria-hidden className="size-4" />
              Tu informe
            </h2>
            <ul className="flex flex-col gap-2.5">
              {report.map((a) => (
                <li key={a.title} style={partStyle(a.part as never)} className={cn("flex gap-3 rounded-xl p-3", a.tone === "alert" ? "bg-[var(--q-soft)]" : "bg-surface-sunken/70")}>
                  <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", a.tone === "alert" ? "bg-[var(--q)] text-white" : "bg-surface text-ink-muted")}>
                    {a.tone === "alert" ? <AlertTriangle aria-hidden className="size-3.5" /> : a.tone === "ok" ? <Check aria-hidden className="size-3.5" /> : <Lightbulb aria-hidden className="size-3.5" />}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold">{a.title}</span>
                    <span className="text-[13px] leading-snug text-ink-muted">{a.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold">Lo que más tiempo te lleva</h2>
            <TopActivities routine={routine} />
          </section>
        </div>
      </div>

      <section className="card mt-6 flex flex-col items-center gap-4 p-6 text-center">
        <p className="text-[13px] font-medium text-ink-muted">Esta es tu semana.</p>
        <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.01em]">¿Te pone contento lo que ves?</h2>
        <p className="-mt-2 text-[13px] text-ink-muted">Si respondés que no, te ayudamos a mejorarla.</p>
        <div className="flex w-full max-w-[360px] gap-2">
          <button
            type="button"
            onClick={() => {
              setHappy(true);
              play("complete");
              go("done");
            }}
            className="pressable inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-success text-[15px] font-semibold text-white"
          >
            <ThumbsUp aria-hidden className="size-4" />
            Sí
          </button>
          <button
            type="button"
            onClick={() => {
              setHappy(false);
              play("pop");
              go("improve");
              window.scrollTo({ top: 0 });
            }}
            className="pressable inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-surface"
          >
            <ThumbsDown aria-hidden className="size-4" />
            No
          </button>
        </div>
      </section>
      <div className="mt-4">
        <button type="button" onClick={back} className="pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          Volver a los huecos
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Paso 9: mejorar

const IMPROVABLE: Cat[] = ["cuerpo", "mente", "alma", "libre"];
const STEPS_H = [0, 1, 2, 3, 5];

export function ImproveStep() {
  const routine = useSteps((s) => s.routine);
  const sleep = useSteps((s) => s.sleep);
  const goals = useSteps((s) => s.goals);
  const setGoal = useSteps((s) => s.setGoal);
  const applyProposal = useSteps((s) => s.applyProposal);
  const go = useSteps((s) => s.go);
  const m = stepMinutes(routine, sleep);

  // Arranca con lo que el informe marcó en rojo (+2 h), si todavía no elegiste nada.
  useEffect(() => {
    if (Object.keys(goals).length) return;
    for (const a of advice(routine, sleep)) if (a.tone === "alert" && IMPROVABLE.includes(a.part as Cat)) setGoal(a.part as Cat, 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = Object.fromEntries(Object.entries(goals).filter(([, h]) => h && h > 0)) as Partial<Record<Cat, number>>;
  const proposal = useMemo(() => propose(routine, sleep, active), [routine, sleep, JSON.stringify(active)]); // eslint-disable-line react-hooks/exhaustive-deps
  const any = Object.keys(active).length > 0;

  return (
    <>
      <StepTitle kicker="Paso 9 · Mejorar" title="¿Qué querés sumarle a tu semana?">
        Elegí cuántas horas más por semana querés para cada parte. Te proponemos dónde ponerlas: primero en tus ratos libres.
      </StepTitle>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="flex flex-col gap-3">
          <ul className="card flex flex-col divide-y divide-line">
            {IMPROVABLE.map((c) => (
              <li key={c} style={partStyle(c)} className="flex flex-col gap-2.5 p-4">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                    <QuadrantIcon id={c} className="size-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[14.5px] font-semibold">{c === "libre" ? "Descanso" : CATS[c].label}</span>
                    <span className="text-[12px] text-ink-muted tabular-nums">Hoy: {hours(m[c])} por semana</span>
                  </span>
                </span>
                <div role="radiogroup" aria-label={`Horas más de ${CATS[c].label}`} className="grid grid-cols-5 gap-1">
                  {STEPS_H.map((h) => {
                    const on = (goals[c] ?? 0) === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setGoal(c, h);
                          play("click");
                        }}
                        className={cn("pressable h-10 rounded-lg text-[13px] font-semibold tabular-nums", on ? "bg-[var(--q)] text-white" : "bg-surface-sunken text-ink-muted")}
                      >
                        {h ? `+${h} h` : "Igual"}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          {any && (
            <section className="card animate-fade-up flex flex-col gap-2.5 p-4">
              <h2 className="text-[15px] font-semibold">Te proponemos</h2>
              <ul className="flex flex-col gap-1.5">
                {proposal.added.map((b) => (
                  <li key={b.id} style={partStyle(b.quadrant)} className="flex items-center gap-2 rounded-lg bg-[var(--q-soft)] px-3 py-2 text-[13px]">
                    <span className="font-semibold text-[var(--q)]">+</span>
                    <span className="font-semibold">{b.name}</span>
                    <span className="text-ink-muted tabular-nums">
                      · {daysLabel(b.days)} · {formatTime(b.start)} a {formatTime(b.start + b.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
              {Object.entries(proposal.missing).map(([c, h]) => (
                <p key={c} className="text-[12.5px] text-ink-muted">
                  No encontramos lugar para {h} h de {CATS[c as Cat].label.toLowerCase()}: tu semana está muy llena. Probá con menos o sacá algo.
                </p>
              ))}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <WeekPreview routine={any ? proposal.routine : routine} highlight={proposal.added.map((b) => b.id)} />
          {any && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="text-[15px] font-semibold">Antes y después</h2>
              <PartBars routine={proposal.routine} sleep={sleep} before={routine} />
            </section>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center gap-2 bg-[color-mix(in_oklab,var(--color-canvas)_85%,transparent)] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={() => go("result")}
          aria-label="Volver al resultado"
          className="pressable grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink-muted shadow-[var(--shadow-card)] hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          disabled={!any || !proposal.added.length}
          onClick={() => {
            applyProposal(proposal.routine);
            play("complete");
            go("done");
            window.scrollTo({ top: 0 });
          }}
          className="pressable ml-auto inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-surface hover:bg-ink/90 disabled:opacity-30"
        >
          <Check aria-hidden className="size-4" />
          Usar esta semana
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Final

export function DoneStep() {
  const router = useRouter();
  const routine = useSteps((s) => s.routine);
  const sleep = useSteps((s) => s.sleep);
  const before = useSteps((s) => s.before);
  const happy = useSteps((s) => s.happy);
  const go = useSteps((s) => s.go);
  const reset = useSteps((s) => s.reset);
  const setRoutine = usePlanner((s) => s.setRoutine);
  const setSleep = usePlanner((s) => s.setSleep);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <StepTitle kicker={before ? "Tu semana nueva" : "Listo"} title={before ? "Así queda tu semana" : happy ? "¡Qué bueno!" : "Tu semana"}>
        {before
          ? "Comparada con cómo era. Podés pasarla a LifeBucket y seguir ajustándola ahí."
          : "Tu semana te cierra. Pasala a LifeBucket para tenerla a mano y ver cómo cambia semana a semana."}
      </StepTitle>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="card flex flex-col gap-4 p-5">
          <WeekBar routine={routine} sleep={sleep} />
          <PartBars routine={routine} sleep={sleep} before={before ?? undefined} />
        </section>
        <WeekPreview routine={routine} />
      </div>

      <section className="card mt-6 flex flex-col gap-3 p-5">
        {confirm ? (
          <>
            <p className="text-[14px] leading-snug">
              <span className="font-semibold">¿Reemplazar tu semana de LifeBucket por esta?</span> También se usa este horario de sueño. Tus momentos y objetivos no se tocan.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setRoutine(routine, []);
                  setSleep(sleep);
                  play("complete");
                  router.push("/");
                }}
                className="pressable h-11 rounded-full bg-ink px-5 text-[14px] font-semibold text-surface"
              >
                Sí, reemplazar
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="pressable h-11 rounded-full px-4 text-[14px] font-medium text-ink-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setConfirm(true)} className="pressable h-12 rounded-full bg-ink px-6 text-[15px] font-semibold text-surface hover:bg-ink/90">
              Pasar esta semana a LifeBucket
            </button>
            <button type="button" onClick={() => go("improve")} className="pressable h-11 rounded-full px-4 text-[14px] font-medium text-ink-muted hover:text-ink">
              Seguir mejorando
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                window.scrollTo({ top: 0 });
              }}
              className="pressable ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-ink-muted hover:text-danger"
            >
              <RotateCcw aria-hidden className="size-4" />
              Empezar de cero
            </button>
          </div>
        )}
      </section>
    </>
  );
}
