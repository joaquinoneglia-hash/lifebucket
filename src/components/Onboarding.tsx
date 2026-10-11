"use client";

import { ArrowLeft, ArrowRight, Check, Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { AVERAGE_WEEK } from "@/lib/benchmarks";
import { cn } from "@/lib/format";
import { useMediaQuery, useViewportHeight } from "@/lib/hooks";
import { QUADRANTS, quadrantRecord, quadrantStyle, type QuadrantRecord } from "@/lib/quadrants";
import {
  applyRoutine,
  applySpecs,
  awakeWeek,
  buildRoutine,
  routineMinutes,
  routineSummary,
  sharesOf,
  specsOf,
  type ActivitySpec,
  type RoutineBlock,
} from "@/lib/routine";
import { jobMinutes } from "@/lib/setup";
import { reviewWeek, ruleReview, weekContext } from "@/lib/setup-ai";
import { DEFAULT_SLEEP, type SleepSettings } from "@/lib/sleep";
import { usePlanner, type Job } from "@/lib/store";
import { BrandMark } from "./BrandMark";
import { Insight } from "./Insight";
import { QuadrantIcon } from "./QuadrantIcon";
import { ActivityAdder, LIFE } from "./setup/ActivityAdder";
import { BandPainter } from "./setup/BandPainter";
import { BucketMeter, type BucketFill } from "./setup/BucketMeter";
import { GoalSetter, type Goals } from "./setup/GoalSetter";
import { VoiceGuide } from "./setup/VoiceGuide";
import { WeekCompare } from "./setup/WeekCompare";
import { WeekTemplateGrid } from "./setup/WeekTemplateGrid";

type Step = "hours" | "activities" | "summary" | "goal" | "ideal";

/** Dos partes bien separadas: cómo es hoy tu semana y adónde querés llegar. */
const PARTS: { title: string; steps: { id: Step; label: string }[] }[] = [
  {
    title: "Tu semana hoy",
    steps: [
      { id: "hours", label: "Horarios" },
      { id: "activities", label: "Actividades" },
      { id: "summary", label: "Resumen" },
    ],
  },
  {
    title: "Tu objetivo",
    steps: [
      { id: "goal", label: "Meta" },
      { id: "ideal", label: "Semana ideal" },
    ],
  },
];
const ORDER: Step[] = PARTS.flatMap((p) => p.steps.map((s) => s.id));

const DEFAULT_JOBS: Job[] = [{ name: "", kind: "trabajo", days: [1, 2, 3, 4, 5], start: 9 * 60, end: 18 * 60 }];

const AVERAGE_MINUTES: QuadrantRecord<number> = (() => {
  const out = quadrantRecord(0);
  for (const q of QUADRANTS) out[q.id] = AVERAGE_WEEK[q.id] * 60;
  return out;
})();

const lifeOf = (m: QuadrantRecord<number>): Goals => ({ cuerpo: m.cuerpo, mente: m.mente, alma: m.alma + m.vinculos });
const h = (m: number) => `${(Math.round((m / 60) * 2) / 2).toLocaleString("es-AR")} h`;

/**
 * El arranque: a la derecha, tu semana en un calendario que se va llenando; a la izquierda, los
 * pasos. Primero cómo es hoy (horarios, actividades, resumen contra una persona típica) y después
 * tu objetivo (la meta y la semana ideal para llegar). La ideal pasa a ser tu rutina.
 */
export function Onboarding() {
  const completeOnboarding = usePlanner((s) => s.completeOnboarding);
  const setSleepStore = usePlanner((s) => s.setSleep);
  const setWork = usePlanner((s) => s.setWork);
  const setBaselineStore = usePlanner((s) => s.setBaseline);

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("hours");
  const [reached, setReached] = useState(0);
  const go = (s: Step) => {
    setStep(s);
    setReached((r) => Math.max(r, ORDER.indexOf(s)));
  };

  const [name, setName] = useState("");
  const [sleep, setSleep] = useState<SleepSettings>(DEFAULT_SLEEP);
  const [jobs, setJobs] = useState<Job[]>(DEFAULT_JOBS);
  const [specs, setSpecs] = useState<ActivitySpec[]>([]);
  const [voice, setVoice] = useState(false);
  const [goals, setGoals] = useState<Goals>({ cuerpo: 0, mente: 0, alma: 0 });
  const [ideal, setIdeal] = useState<RoutineBlock[]>([]);

  const validJobs = jobs.filter((j) => j.days.length && j.end > j.start);
  const today = buildRoutine(validJobs, specs, sleep);
  const todayMin = routineMinutes(today, sleep);
  const idealMin = routineMinutes(ideal, sleep);
  const partTwo = step === "goal" || step === "ideal";
  const awake = awakeWeek(sleep);
  const workMin = jobMinutes(validJobs);

  // El balde de arriba: lo de hoy en la primera parte, la meta o la ideal en la segunda.
  const shownLife = step === "goal" ? goals : lifeOf(step === "ideal" ? idealMin : todayMin);
  const fill: BucketFill = { dormir: 168 * 60 - awake, trabajo: workMin, ...shownLife };

  // El comentario del resumen: por reglas al instante; con IA si hay clave (una vez por visita).
  const [aiComment, setAiComment] = useState<string | null>(null);
  useEffect(() => {
    if (step !== "summary") return;
    let alive = true;
    setAiComment(null);
    const m = routineMinutes(today, sleep);
    reviewWeek(m, weekContext(m, routineSummary(today))).then((r) => alive && r.source === "ai" && setAiComment(r.comment));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toGoal = () => {
    // La segunda parte arranca desde tu semana de hoy.
    setGoals(lifeOf(todayMin));
    setIdeal(today);
    go("goal");
  };

  const finish = () => {
    setSleepStore(sleep);
    setWork(validJobs);
    completeOnboarding(name, [
      { quadrant: "libre", name: "Descanso" },
      { quadrant: "libre", name: "Traslados" },
      { quadrant: "libre", name: "Casa" },
    ]);
    setBaselineStore(today);
    // Tu meta es el objetivo; la semana ideal, la rutina para llegar.
    const target = quadrantRecord(0);
    target.cuerpo = goals.cuerpo;
    target.mente = goals.mente;
    target.alma = goals.alma;
    target.trabajo = workMin;
    target.libre = Math.max(0, awake - workMin - goals.cuerpo - goals.mente - goals.alma);
    applyRoutine(ideal, sleep, sharesOf(target));
    try {
      sessionStorage.setItem("lb:fresh", "1");
    } catch {}
  };

  const viewport = useViewportHeight();
  const wide = useMediaQuery("(min-width: 1024px)");
  const gridHeight = wide ? Math.max(420, Math.min(720, viewport - 170)) : 300;

  if (!started) return <Intro onStart={() => setStarted(true)} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1360px] flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="text-[15px] font-semibold tracking-tight">LifeBucket</span>
        </div>
        <Progress step={step} reached={reached} onGo={(s) => (s === "goal" && reached < ORDER.indexOf("goal") ? toGoal() : go(s))} />
        <BucketMeter fill={fill} compact />
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
        {/* La semana, siempre a la vista (arriba en el celular). */}
        <section
          aria-label={partTwo ? "Tu semana ideal" : "Tu semana hoy"}
          className="card order-first flex flex-col gap-2 p-4 lg:sticky lg:top-4 lg:order-last lg:self-start lg:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="type-title">{partTwo ? "Tu semana ideal" : "Tu semana hoy"}</h2>
            <span className="text-[12px] text-ink-muted">
              {partTwo ? "Punteado: tu semana de hoy. Tocá para cambiar." : "Se va armando con lo que contás."}
            </span>
          </div>
          {partTwo ? (
            <WeekTemplateGrid template={ideal} ghost={today} sleep={sleep} onChange={setIdeal} height={gridHeight} />
          ) : (
            <WeekTemplateGrid template={today} sleep={sleep} height={gridHeight} />
          )}
        </section>

        <section key={step} className="card animate-fade-up flex flex-col gap-5 p-5 sm:p-6">
          {step === "hours" && (
            <>
              <StepHead
                part="Parte 1 · Tu semana hoy"
                title="¿Cuándo dormís y cuándo trabajás?"
                text="Elegí qué pintás y arrastrá sobre las horas. Así como es hoy, no como te gustaría."
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="¿Cómo te llamás?"
                  aria-label="Tu nombre"
                  autoComplete="given-name"
                  className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVoice(true)}
                  className="pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                >
                  <Mic aria-hidden className="size-4" />
                  Contámelo hablando
                </button>
              </div>
              <BandPainter
                sleep={sleep}
                jobs={jobs}
                onChange={(v) => {
                  setSleep(v.sleep);
                  setJobs(v.jobs);
                }}
              />
              <Footer next={{ label: "Siguiente", onClick: () => go("activities") }} />
            </>
          )}

          {step === "activities" && (
            <>
              <StepHead
                part="Parte 1 · Tu semana hoy"
                title="¿Qué más hacés en la semana?"
                text="Escribilo como te salga. Le ponemos la categoría (cuerpo, mente o alma) y lo ubicamos en tu semana."
              />
              <ActivityAdder items={specs} onChange={setSpecs} sleep={sleep} />
              <Footer
                back={{ label: "Horarios", onClick: () => go("hours") }}
                next={{ label: specs.length ? "Listo, no me falta nada" : "No hago nada más", onClick: () => go("summary") }}
              />
            </>
          )}

          {step === "summary" && (
            <>
              <StepHead
                part="Parte 1 · Tu semana hoy"
                title={`Así es tu semana hoy${name ? `, ${name}` : ""}`}
                text="Tu balde y cómo se compara con el de una persona típica."
              />
              <BucketMeter fill={fill} />
              <Insight>{aiComment ?? ruleReview(todayMin)}</Insight>
              <div className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold">Vos contra una persona típica</h3>
                <WeekCompare mine={todayMin} other={AVERAGE_MINUTES} otherLabel="Persona típica" />
                <p className="text-[10.5px] text-ink-faint">Referencia: encuestas de uso del tiempo (BLS, ATUS 2025), OMS e INDEC (ENFR 2018).</p>
              </div>
              <Footer back={{ label: "Agregar algo más", onClick: () => go("activities") }} next={{ label: "Sí, esta es mi semana", onClick: toGoal }} />
            </>
          )}

          {step === "goal" && (
            <>
              <StepHead
                part="Parte 2 · Tu objetivo"
                title="¿Cuál es tu objetivo?"
                text="Cuántas horas por semana querés para cada parte. Después las ubicamos en tu semana."
              />
              <GoalSetter today={lifeOf(todayMin)} goals={goals} onChange={setGoals} awakeMinutes={awake} workMinutes={workMin} />
              <Insight>
                {goals.cuerpo < 150
                  ? "La OMS recomienda al menos 2 h 30 por semana de actividad física. ¿Te animás a acercarte?"
                  : "Un objetivo alcanzable vale más que uno perfecto: siempre lo podés subir después."}
              </Insight>
              <Footer back={{ label: "Resumen", onClick: () => go("summary") }} next={{ label: "Armar mi semana ideal", onClick: () => go("ideal") }} />
            </>
          )}

          {step === "ideal" && (
            <>
              <StepHead
                part="Parte 2 · Tu objetivo"
                title="Tu semana ideal"
                text="Sumá actividades hasta llegar a tu meta. También podés tocar el calendario para mover o sacar."
              />
              <GoalProgress goals={goals} have={lifeOf(idealMin)} />
              <ActivityAdder
                items={specsOf(ideal).map((s) => ({ ...s, quadrant: s.quadrant === "vinculos" ? "alma" : s.quadrant }))}
                onChange={(next) => setIdeal((cur) => applySpecs(cur, specsOf(cur), next, sleep))}
                sleep={sleep}
                placeholder="Ej: yoga 2 veces a la tarde"
              />
              <Footer back={{ label: "Meta", onClick: () => go("goal") }} next={{ label: "Empezar con esta semana", onClick: finish }} />
            </>
          )}
        </section>
      </div>

      {voice && (
        <VoiceGuide
          state={{ name, sleep, jobs, specs }}
          onName={setName}
          onSleep={setSleep}
          onJobs={setJobs}
          onSpecs={(s) => setSpecs(s.map((x) => ({ ...x, quadrant: x.quadrant === "vinculos" ? "alma" : x.quadrant })))}
          onClose={() => setVoice(false)}
          onDone={() => {
            setVoice(false);
            go("summary");
          }}
        />
      )}
    </div>
  );
}

/** Los pasos en dos partes, con el nombre de cada parte arriba. Se puede volver a uno ya visto. */
function Progress({ step, reached, onGo }: { step: Step; reached: number; onGo: (s: Step) => void }) {
  const part = PARTS.findIndex((p) => p.steps.some((s) => s.id === step));
  const label = PARTS[part].steps.find((s) => s.id === step)!.label;
  return (
    <>
      {/* En el celular, solo dónde estás. */}
      <p className="text-[12px] text-ink-muted md:hidden">
        <span className="font-semibold text-ink">
          {part + 1}. {PARTS[part].title}
        </span>{" "}
        · {label} ({ORDER.indexOf(step) + 1}/{ORDER.length})
      </p>
      <ProgressFull step={step} reached={reached} onGo={onGo} />
    </>
  );
}

function ProgressFull({ step, reached, onGo }: { step: Step; reached: number; onGo: (s: Step) => void }) {
  return (
    <nav aria-label="Pasos" className="hidden items-end gap-4 md:flex">
      {PARTS.map((part, pi) => (
        <div key={part.title} className={cn("flex flex-col gap-1", pi > 0 && "border-l border-line pl-4")}>
          <span className="text-[10.5px] font-semibold tracking-wide text-ink-muted uppercase">
            {pi + 1}. {part.title}
          </span>
          <ol className="flex gap-1">
            {part.steps.map((s) => {
              const i = ORDER.indexOf(s.id);
              const current = s.id === step;
              const can = i <= reached && !current;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!can}
                    aria-current={current ? "step" : undefined}
                    onClick={() => onGo(s.id)}
                    className={cn(
                      "flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                      current ? "bg-ink text-surface" : can ? "bg-surface/70 text-ink-muted hover:text-ink" : "text-ink-faint",
                    )}
                  >
                    {i < reached && !current && <Check aria-hidden className="size-3" />}
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}

function StepHead({ part, title, text }: { part: string; title: string; text: string }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold tracking-wide text-ink-muted uppercase">{part}</p>
      <h1 className="type-display mt-1">{title}</h1>
      <p className="type-body mt-1 text-ink-muted">{text}</p>
    </div>
  );
}

function Footer({ back, next }: { back?: { label: string; onClick: () => void }; next: { label: string; onClick: () => void } }) {
  return (
    <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="pressable inline-flex h-11 items-center gap-1.5 rounded-md px-3 font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={next.onClick}
        className="pressable inline-flex h-11 items-center gap-1.5 rounded-md bg-ink pr-4 pl-5 font-medium text-surface hover:bg-ink/90"
      >
        {next.label}
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </footer>
  );
}

/** Cuánto te falta para tu meta en cada parte, con la semana ideal que vas armando. */
function GoalProgress({ goals, have }: { goals: Goals; have: Goals }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {LIFE.map((id) => {
        const q = id as keyof Goals;
        const goal = goals[q];
        const done = goal === 0 || have[q] >= goal;
        return (
          <li key={id} style={quadrantStyle(id)} className="flex flex-col gap-1.5 rounded-xl bg-[var(--q-soft)] p-2.5">
            <span className="flex items-center gap-1 text-[12px] font-semibold">
              <QuadrantIcon id={id} className="size-3.5 text-[var(--q)]" />
              {id === "cuerpo" ? "Cuerpo" : id === "mente" ? "Mente" : "Alma"}
            </span>
            <span className="text-[12px] tabular-nums">
              <span className="font-semibold">{h(have[q])}</span> <span className="text-ink-muted">/ {h(goal)}</span>
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface/80">
              <div className="bar-fill h-full rounded-full bg-[var(--q)]" style={{ width: `${goal ? Math.min(100, (have[q] / goal) * 100) : 100}%` }} />
            </div>
            <span className={cn("text-[11px]", done ? "font-semibold text-success" : "text-ink-muted")}>{done ? "¡Llegaste!" : `Faltan ${h(goal - have[q])}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** La portada: el balde grande en el centro y un solo botón. */
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="animate-intro-logo flex flex-col items-center gap-6">
        <BrandMark size={140} animated />
        <div className="flex flex-col gap-2">
          <h1 className="text-[40px] leading-none font-semibold tracking-[-0.03em] sm:text-[52px]">LifeBucket</h1>
          <p className="max-w-[34ch] text-[15px] text-ink-muted">
            Tu vida es un balde de 168 horas por semana. ¿Sabés con qué lo estás llenando?
          </p>
        </div>
      </div>
      <button
        type="button"
        data-autofocus
        onClick={onStart}
        className="pressable animate-fade-up inline-flex h-12 items-center gap-2 rounded-full bg-ink pr-5 pl-6 text-[15px] font-medium text-surface shadow-[var(--shadow-lifted)] [animation-delay:450ms] hover:bg-ink/90"
      >
        Empezar a armar tu vida
        <ArrowRight aria-hidden className="size-4" />
      </button>
      <p className="animate-fade-up -mt-6 text-[12px] text-ink-faint [animation-delay:900ms]">Spoiler: casi nunca es donde creés.</p>
    </main>
  );
}
