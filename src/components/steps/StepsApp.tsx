"use client";

import { ArrowLeft, ArrowRight, Check, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { SUGGESTED_ACTIVITIES } from "@/lib/activities";
import { cn, formatMinutes } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { partStyle } from "@/lib/mode";
import { WEEK_ORDER, type RoutineBlock } from "@/lib/routine";
import { play } from "@/lib/sfx";
import { sleepStats, hoursLabel } from "@/lib/sleep-stats";
import { findGaps, DEFAULT_NAME } from "@/lib/steps";
import { STEPS, useSteps, type Cat, type StepId } from "@/lib/steps-store";
import { formatTime } from "@/lib/time";
import { BrandMark } from "../BrandMark";
import { QuadrantIcon } from "../QuadrantIcon";
import { WeekTemplateGrid } from "../setup/WeekTemplateGrid";
import { Select } from "../ui";
import { DoneStep, ImproveStep, ResultStep } from "./StepsResult";

const DAY_LETTER: Record<number, string> = { 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S", 0: "D" };
const DAY_NAME: Record<number, string> = { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 0: "domingo" };
const TIMES = Array.from({ length: 39 }, (_, i) => 5 * 60 + i * 30);
const RANGE: [number, number] = [5 * 60, 24 * 60];

/** Cada categoría: la pregunta, una ayuda y un horario para arrancar. */
export const CATS: Record<Cat, { label: string; question: string; hint: string; days: number[]; start: number; minutes: number; names: string[] }> = {
  trabajo: { label: "Trabajo", question: "¿Cuándo trabajás?", hint: "Tu empleo, tu emprendimiento o tus proyectos. Si cambia según el día, cargalo por partes.", days: [1, 2, 3, 4, 5], start: 9 * 60, minutes: 9 * 60, names: ["Trabajo", "Oficina", "Proyecto", "Facultad"] },
  cuerpo: { label: "Cuerpo", question: "¿Cuándo te movés?", hint: "Gimnasio, correr, caminar, un deporte, yoga: todo lo físico.", days: [1, 3, 5], start: 19 * 60, minutes: 60, names: SUGGESTED_ACTIVITIES.cuerpo.slice(0, 5) },
  mente: { label: "Mente", question: "¿Cuándo le das a tu cabeza?", hint: "Leer, estudiar, un curso, un idioma, meditar.", days: [1, 2, 3, 4, 5], start: 22 * 60, minutes: 60, names: ["Leer", "Estudiar", "Curso", "Idiomas", "Meditar"] },
  alma: { label: "Disfrute", question: "¿Cuándo hacés lo que te gusta?", hint: "Hobbies, música, series, salir, cocinar: lo que hacés porque te gusta.", days: [6, 0], start: 17 * 60, minutes: 120, names: SUGGESTED_ACTIVITIES.alma.slice(0, 5) },
  libre: { label: "Comidas, traslados y descanso", question: "¿Comidas, viajes, descanso?", hint: "Lo que ocupa tiempo pero no es ninguna de las anteriores: almuerzo, viajes, siesta, la casa.", days: [1, 2, 3, 4, 5], start: 13 * 60, minutes: 60, names: ["Almuerzo", "Desayuno", "Cena", "Traslados", "Siesta"] },
};
const CAT_STEPS: Cat[] = ["trabajo", "cuerpo", "mente", "alma", "libre"];

/** Las etapas que se ven arriba (varios pasos pueden ser parte de una misma etapa). */
const STAGES: { label: string; steps: StepId[] }[] = [
  { label: "Sueño", steps: ["sleep"] },
  { label: "Tu semana", steps: ["trabajo", "cuerpo", "mente", "alma", "libre", "gaps"] },
  { label: "Resultado", steps: ["result"] },
  { label: "Mejorar", steps: ["improve", "done"] },
];

/**
 * LifeBucket en pasos (versión de prueba): como una encuesta. Primero el sueño, después la semana categoría
 * por categoría, los huecos, el resultado con un informe y, si no te gusta, una propuesta para mejorarla.
 * Trabaja sobre una copia aparte: no toca la semana de la app hasta que elegís pasarla.
 */
export function StepsApp() {
  const step = useSteps((s) => s.step);
  const [ready, setReady] = useState(false);
  // Lo guardado se lee en el navegador: hasta entonces no se dibuja (evita un salto).
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  const stage = STAGES.findIndex((st) => st.steps.includes(step));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex flex-col gap-3 bg-[color-mix(in_oklab,var(--color-canvas)_85%,transparent)] px-4 pt-3 pb-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-[13px] font-semibold tracking-[0.14em]">LIFEBUCKET</span>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-wide text-surface">BETA</span>
          </span>
          <Link href="/" className="pressable inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-muted hover:bg-surface hover:text-ink">
            <X aria-hidden className="size-4" />
            Salir
          </Link>
        </div>
        {step !== "intro" && (
          <ol aria-label="Etapas" className="grid grid-cols-4 gap-1.5">
            {STAGES.map((st, i) => (
              <li key={st.label} className="flex flex-col gap-1">
                <span className={cn("h-1 rounded-full transition-colors duration-300", i <= stage ? "bg-ink" : "bg-ink/10")} />
                <span className={cn("text-[11px] font-medium", i === stage ? "text-ink" : "text-ink-faint")}>{st.label}</span>
              </li>
            ))}
          </ol>
        )}
      </header>

      <main key={step} className="animate-fade-up mx-auto flex w-full max-w-[980px] flex-1 flex-col px-4 pt-2 pb-8 sm:px-6">
        {step === "intro" && <IntroStep />}
        {step === "sleep" && <SleepStep />}
        {CAT_STEPS.includes(step as Cat) && <CategoryStep cat={step as Cat} />}
        {step === "gaps" && <GapsStep />}
        {step === "result" && <ResultStep />}
        {step === "improve" && <ImproveStep />}
        {step === "done" && <DoneStep />}
      </main>
    </div>
  );
}

/** Ir al paso anterior o al siguiente. */
export function useNav() {
  const step = useSteps((s) => s.step);
  const go = useSteps((s) => s.go);
  const i = STEPS.indexOf(step);
  return {
    next: () => {
      play("pop");
      go(STEPS[Math.min(STEPS.length - 1, i + 1)]);
      window.scrollTo({ top: 0 });
    },
    back: () => {
      play("click");
      go(STEPS[Math.max(0, i - 1)]);
      window.scrollTo({ top: 0 });
    },
  };
}

/** El título de cada paso. */
export function StepTitle({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 pt-2 pb-5">
      {kicker && <p className="text-[12.5px] font-medium text-ink-muted">{kicker}</p>}
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[34px]">{title}</h1>
      {children && <p className="max-w-[56ch] text-[15px] leading-snug text-ink-muted">{children}</p>}
    </div>
  );
}

/** Los botones de abajo: atrás y seguir. */
export function Footer({ onBack, onNext, nextLabel = "Seguir", nextDisabled, extra }: { onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex items-center gap-2 bg-[color-mix(in_oklab,var(--color-canvas)_85%,transparent)] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:-mx-6 sm:px-6">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Atrás" className="pressable grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink-muted shadow-[var(--shadow-card)] hover:text-ink">
          <ArrowLeft aria-hidden className="size-5" />
        </button>
      )}
      {extra}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="pressable ml-auto inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-surface hover:bg-ink/90 disabled:opacity-30"
      >
        {nextLabel}
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** El calendario de la semana (solo para mirar) mientras la vas armando. */
export function WeekPreview({ routine, ghost, highlight, height }: { routine: RoutineBlock[]; ghost?: RoutineBlock[]; highlight?: string[]; height?: number }) {
  const sleep = useSteps((s) => s.sleep);
  const wide = useMediaQuery("(min-width: 900px)");
  return (
    <div className="card p-3">
      <WeekTemplateGrid template={routine} ghost={ghost} highlight={highlight} sleep={sleep} range={RANGE} showSleep height={height ?? (wide ? 520 : 340)} />
    </div>
  );
}

// ---------------------------------------------------------------- Paso 0: intro

function IntroStep() {
  const { next } = useNav();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="animate-welcome-pop">
        <BrandMark size={80} animated />
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[44px]">Armemos tu semana</h1>
        <p className="mx-auto max-w-[34ch] text-[17px] leading-snug text-ink-muted">
          En unos minutos vas a ver en qué se te van las horas. Primero tu sueño, después lo que hacés en una semana normal, categoría por categoría.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-left text-[14px]">
        {["Sueño", "Tu semana, por partes", "Así es tu vida hoy", "Cómo mejorarla"].map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="grid size-7 place-items-center rounded-full bg-ink text-[12px] font-semibold text-surface">{i + 1}</span>
            {t}
          </li>
        ))}
      </ul>
      <p className="max-w-[40ch] text-[13px] leading-snug text-ink-faint">No es una agenda de reuniones: es tu semana tipo, en bloques que se repiten.</p>
      <button type="button" onClick={next} className="pressable inline-flex h-12 items-center gap-2 rounded-full bg-ink px-8 text-[15px] font-semibold text-surface hover:bg-ink/90">
        Empezar
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Paso 1: sueño

/** Horas para acostarse (de 20:00 a 03:00 del día siguiente) y para levantarse (de 04:00 a 12:00). */
const BEDS = Array.from({ length: 15 }, (_, i) => 20 * 60 + i * 30);
const WAKES = Array.from({ length: 17 }, (_, i) => 4 * 60 + i * 30);

function SleepStep() {
  const { next, back } = useNav();
  const sleep = useSteps((s) => s.sleep);
  const setSleep = useSteps((s) => s.setSleep);
  const st = sleepStats(sleep);
  const row = (key: "weekday" | "weekend", title: string, hint: string) => (
    <section className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="text-[12.5px] text-ink-muted">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <Moon aria-hidden className="size-3.5" /> Me acuesto
          </span>
          <Select label="Me acuesto" value={String(sleep[key].bed)} onChange={(v) => setSleep({ ...sleep, [key]: { ...sleep[key], bed: Number(v) } })} options={BEDS.map((m) => ({ value: String(m), label: formatTime(m % 1440) }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <Sun aria-hidden className="size-3.5" /> Me levanto
          </span>
          <Select label="Me levanto" value={String(sleep[key].wake)} onChange={(v) => setSleep({ ...sleep, [key]: { ...sleep[key], wake: Number(v) } })} options={WAKES.map((m) => ({ value: String(m), label: formatTime(m) }))} />
        </label>
      </div>
    </section>
  );
  return (
    <>
      <StepTitle kicker="Paso 1 · Sueño" title="¿Cómo dormís?">
        El sueño es la parte más grande de tu semana. Contanos tu horario de siempre, no el ideal.
      </StepTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {row("weekday", "De lunes a viernes", "Las noches de domingo a jueves.")}
        {row("weekend", "El fin de semana", "Las noches de viernes y sábado.")}
      </div>
      <p className={cn("mt-4 text-[14px]", st.status === "ok" ? "text-success" : "text-ink")}>
        Dormís {hoursLabel(st.perNight)} por noche en promedio
        {st.status === "poco" ? ": menos de lo recomendado (7 a 9 h)." : st.status === "mucho" ? ": más de lo habitual." : ", dentro de lo recomendado."}
      </p>
      <Footer onBack={back} onNext={next} />
    </>
  );
}

// ---------------------------------------------------------------- Pasos 2 a 6: la semana, por categoría

const summary = (b: RoutineBlock) => `${daysLabel(b.days)} · ${formatTime(b.start)} a ${formatTime(b.start + b.minutes)}`;
export function daysLabel(days: number[]) {
  const d = WEEK_ORDER.filter((x) => days.includes(x));
  if (d.length === 7) return "Todos los días";
  if (d.length === 5 && d.every((x) => x >= 1 && x <= 5)) return "Lunes a viernes";
  if (d.length === 2 && d.includes(6) && d.includes(0)) return "Fin de semana";
  if (d.length === 1) return DAY_NAME[d[0]].replace(/^./, (c) => c.toUpperCase());
  return d.map((x) => DAY_NAME[x].slice(0, 3)).join(", ");
}

function CategoryStep({ cat }: { cat: Cat }) {
  const { next, back } = useNav();
  const info = CATS[cat];
  const routine = useSteps((s) => s.routine);
  const addBlock = useSteps((s) => s.addBlock);
  const removeBlock = useSteps((s) => s.removeBlock);
  const mine = routine.filter((b) => b.quadrant === cat);
  const [name, setName] = useState(mine.length ? "" : info.names[0]);
  const [days, setDays] = useState<number[]>(info.days);
  const [from, setFrom] = useState(info.start);
  const [minutes, setMinutes] = useState(info.minutes);
  const n = CAT_STEPS.indexOf(cat) + 2;

  const add = () => {
    if (!name.trim() || !days.length) return;
    addBlock({ quadrant: cat, name: name.trim(), days, start: from, minutes });
    play("pop");
    setName("");
  };

  return (
    <>
      <StepTitle kicker={`Paso ${n} · ${info.label}`} title={info.question}>
        {info.hint}
      </StepTitle>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="flex flex-col gap-3">
          <section style={partStyle(cat)} className="card flex flex-col gap-4 p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-ink-muted">¿Qué es?</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={info.names[0]}
                enterKeyHint="done"
                onKeyDown={(e) => e.key === "Enter" && add()}
                className="h-11 rounded-md border border-line bg-surface px-3 text-[15px] focus:border-ink focus:outline-none"
              />
              <span className="flex flex-wrap gap-1">
                {info.names
                  .filter((x) => x !== name)
                  .map((x) => (
                    <button key={x} type="button" onClick={() => setName(x)} className="pressable rounded-full bg-[var(--q-soft)] px-2.5 py-1 text-[12px] font-medium text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]">
                      {x}
                    </button>
                  ))}
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[12.5px] text-ink-muted">
                ¿Qué días?
                <span className="flex gap-1">
                  {[
                    { l: "L a V", d: [1, 2, 3, 4, 5] },
                    { l: "Finde", d: [6, 0] },
                    { l: "Todos", d: [1, 2, 3, 4, 5, 6, 0] },
                  ].map((p) => (
                    <button key={p.l} type="button" onClick={() => setDays(p.d)} className="pressable rounded-full bg-surface-sunken px-2 py-0.5 text-[11.5px] font-medium hover:text-ink">
                      {p.l}
                    </button>
                  ))}
                </span>
              </span>
              <div className="grid grid-cols-7 gap-1">
                {WEEK_ORDER.map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_NAME[d]}
                      onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                      className={cn("pressable h-10 rounded-md text-[13px] font-semibold", on ? "bg-[var(--q)] text-white" : "bg-surface-sunken text-ink-muted")}
                    >
                      {DAY_LETTER[d]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] text-ink-muted">Desde</span>
                <Select
                  label="Desde"
                  value={String(from)}
                  onChange={(v) => {
                    const f = Number(v);
                    setFrom(f);
                    setMinutes((m) => Math.min(Math.max(30, m), 24 * 60 - f));
                  }}
                  options={TIMES.slice(0, -1).map((m) => ({ value: String(m), label: formatTime(m) }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] text-ink-muted">Hasta · {formatMinutes(minutes)}</span>
                <Select label="Hasta" value={String(from + minutes)} onChange={(v) => setMinutes(Number(v) - from)} options={TIMES.filter((m) => m > from).map((m) => ({ value: String(m), label: formatTime(m) }))} />
              </label>
            </div>

            <button
              type="button"
              onClick={add}
              disabled={!name.trim() || !days.length}
              className="pressable inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--q)] px-4 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              <Plus aria-hidden className="size-4" />
              Agregar a mi semana
            </button>
          </section>

          {mine.length > 0 && (
            <ul style={partStyle(cat)} className="flex flex-col gap-1.5">
              {mine.map((b) => (
                <li key={b.id} className="animate-fade-up flex items-center gap-2.5 rounded-xl bg-[var(--q-soft)] py-2 pr-1.5 pl-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q)] text-white">
                    <QuadrantIcon id={cat} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[14px] font-semibold">{b.name}</span>
                    <span className="block text-[12px] text-ink-muted tabular-nums">{summary(b)}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Sacar ${b.name}`}
                    onClick={() => {
                      play("delete");
                      removeBlock(b.id);
                    }}
                    className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <WeekPreview routine={routine} />
      </div>
      <Footer onBack={back} onNext={next} nextLabel={mine.length ? "Seguir" : cat === "trabajo" ? "No trabajo, seguir" : "No hago nada de esto"} />
    </>
  );
}

// ---------------------------------------------------------------- Paso 7: los huecos

function GapsStep() {
  const { next, back } = useNav();
  const routine = useSteps((s) => s.routine);
  const sleep = useSteps((s) => s.sleep);
  const leftFree = useSteps((s) => s.leftFree);
  const markFree = useSteps((s) => s.markFree);
  const addBlock = useSteps((s) => s.addBlock);
  const gaps = findGaps(routine, sleep).filter((g) => !leftFree.includes(g.key));
  const gap = gaps[0];
  const [cat, setCat] = useState<Cat | null>(null);
  const [name, setName] = useState("");

  const assign = () => {
    if (!gap || !cat) return;
    addBlock({ quadrant: cat, name: name.trim() || DEFAULT_NAME[cat], days: gap.days, start: gap.start, minutes: gap.end - gap.start });
    play("pop");
    setCat(null);
    setName("");
  };

  return (
    <>
      <StepTitle kicker="Paso 7 · Los huecos" title={gap ? "¿Qué hacés en estos ratos?" : "¡Tu semana está completa!"}>
        {gap
          ? "Encontramos tiempo sin asignar. Si hacés algo ahí, sumalo; si no, dejalo libre: Libre también es una parte de tu vida."
          : "Revisaste todos los huecos. Lo que dejaste sin asignar cuenta como tiempo libre."}
      </StepTitle>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        {gap ? (
          <section key={gap.key} className="card animate-fade-up flex flex-col gap-4 p-4">
            <div>
              <p className="text-[12px] font-medium text-ink-muted">
                Quedan {gaps.length} {gaps.length === 1 ? "hueco" : "huecos"}
              </p>
              <p className="mt-1 text-[20px] leading-tight font-semibold">
                {daysLabel(gap.days)}, de {formatTime(gap.start)} a {formatTime(gap.end)}
              </p>
              <p className="text-[13px] text-ink-muted">{formatMinutes(gap.end - gap.start)} sin nada asignado</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAT_STEPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCat(c);
                    setName(c === "libre" ? "Descanso" : "");
                  }}
                  style={partStyle(c)}
                  className={cn("pressable inline-flex h-9 items-center gap-1.5 rounded-full border pr-3 pl-1 text-[13px] font-medium", cat === c ? "border-[var(--q)] bg-[var(--q-soft)]" : "border-line")}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                    <QuadrantIcon id={c} className="size-3.5" />
                  </span>
                  {c === "libre" ? "Comida / viaje / descanso" : CATS[c].label}
                </button>
              ))}
            </div>
            {cat && (
              <div className="animate-fade-up flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={DEFAULT_NAME[cat]}
                  autoFocus
                  enterKeyHint="done"
                  onKeyDown={(e) => e.key === "Enter" && assign()}
                  className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-[15px] focus:border-ink focus:outline-none"
                />
                <button type="button" onClick={assign} className="pressable inline-flex h-11 items-center gap-1 rounded-full bg-ink px-4 text-[14px] font-semibold text-surface">
                  <Check aria-hidden className="size-4" />
                  Sumar
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                markFree(gap.key);
                setCat(null);
                play("click");
              }}
              className="pressable h-11 rounded-full bg-surface-sunken px-4 text-[14px] font-medium text-ink-muted hover:text-ink"
            >
              Lo dejo libre
            </button>
          </section>
        ) : (
          <section className="card flex flex-col items-center gap-2 p-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-success text-white">
              <Check aria-hidden className="size-6" />
            </span>
            <p className="text-[15px] font-semibold">Listo para ver tu resultado</p>
          </section>
        )}
        <WeekPreview routine={routine} ghost={gap ? [{ id: "gap", quadrant: "libre", name: "", days: gap.days, start: gap.start, minutes: gap.end - gap.start }] : undefined} />
      </div>
      <Footer onBack={back} onNext={next} nextLabel={gap ? "Saltar y cerrar mi semana" : "Cerrar mi semana"} />
    </>
  );
}
