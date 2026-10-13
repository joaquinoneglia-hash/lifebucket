"use client";

import { ArrowRight, Bell, Briefcase, Check, Moon, Plus, Rocket, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { play, playIntro } from "@/lib/sfx";
import { BrandMark } from "./BrandMark";
import { toKey } from "@/lib/dates";
import { QUADRANT_BY_ID, QUADRANT_HINT, type QuadrantId } from "@/lib/quadrants";
import { partStyle } from "@/lib/mode";
import { QuadrantIcon } from "./QuadrantIcon";
import { goalsFor, usePlanner, type PlannerState } from "@/lib/store";
import { isZenPlaying, onZenChange, startZen, stopZen } from "@/lib/zen";
import type { ModuleId } from "./Modules";

/**
 * El arranque guiado. Primero un mensaje de bienvenida; después, paso a paso, cada parte del dashboard se
 * destaca (el resto queda en penumbra) y se completa ahí mismo: la rutina (trabajo y sueño, y después el
 * tiempo libre), los no negociables (y los que lograste hoy), las metas importantes y el diario. Al
 * terminar, cuándo querés que la app te pregunte por tu día, y la bienvenida a tu dashboard de vida.
 * Cada paso, al completarse, "vuela" hasta su lugar.
 */
type Phone = "semana" | "objetivos" | "logros" | "tablero";
type Step = {
  id: string;
  target?: ModuleId;
  phone?: Phone;
  kicker: string;
  title: string;
  body: string;
  note?: string;
  action?: "sleep" | "work" | "business" | "mine";
  /** Qué tocar en el panel destacado, paso a paso (la guía; se completa en el tablero). */
  how?: string[];
  /** Dónde tocar o escribir (se resalta con una flechita) y qué dice la flechita. */
  spot?: string;
  spotLabel?: string;
  /** Texto en partes cortas (en vez de un párrafo largo). */
  lines?: string[];
};
const STEPS: Step[] = [
  {
    id: "welcome",
    kicker: "LifeBucket",
    title: "¿Sentís que se te va la vida y todo es trabajo y dormir?",
    body: "",
    lines: [
      "¿Te gustaría ver cómo va tu vida…",
      "…y cómo va a ser si seguís por el camino que vas?",
      "Creé LifeBucket para mí y para vos.",
      "Sin volvernos obsesivos: día a día y sin estresarnos, saber qué estamos haciendo para ser más felices.",
    ],
  },
  {
    id: "intro",
    kicker: "Empecemos",
    title: "Vamos a configurar tu rutina, muy rápido",
    body: "",
    lines: ["Primero, cuándo dormís y cuándo trabajás.", "Así vamos a ver qué espacio te queda libre para vos.", "Primero la base (sueño, trabajo y emprendimiento) y después lo más lindo: lo que hacés para vos."],
  },
  {
    id: "sueno",
    target: "semana",
    phone: "semana",
    kicker: "Paso 1 de 4 · Tu rutina · 1 de 4",
    title: "¿A qué hora dormís?",
    body: "Poné a qué hora te acostás y te levantás. Se va a ver en el calendario.",
    action: "sleep",
  },
  {
    id: "trabajo",
    target: "semana",
    phone: "semana",
    kicker: "Paso 1 de 4 · Tu rutina · 2 de 4",
    title: "¿Cuándo trabajás?",
    body: "Elegí los días y el horario de tu trabajo y guardalo. Si tenés más de un horario, sumá otro.",
    note: "Este calendario no es para reuniones ni juntadas: es solo para lo que se repite semana a semana.",
    action: "work",
  },
  {
    id: "emprendimiento",
    target: "semana",
    phone: "semana",
    kicker: "Paso 1 de 4 · Tu rutina · 3 de 4",
    title: "¿Tenés un emprendimiento?",
    body: "Si le dedicás horas a un proyecto propio, configuralo con su horario.",
    action: "business",
  },
  {
    id: "paravos",
    target: "semana",
    phone: "semana",
    kicker: "Paso 1 de 4 · Tu rutina · 4 de 4",
    title: "Y ahora, lo importante…",
    body: "Configurá lo que hacés para vos todas las semanas y que no es trabajo ni dormir. Tocá una categoría y ajustá el ejemplo a tu semana. (Los encuentros con los tuyos los vas a anotar en tu diario.)",
    action: "mine",
  },
  {
    id: "noneg",
    target: "diarios",
    phone: "objetivos",
    kicker: "Paso 2 de 4 · No negociables",
    title: "¿Cuáles son tus no negociables diarios?",
    body: "Te recomendamos no más de 5: pueden ser cosas muy simples o hábitos que te cuestan.",
    spot: 'input[aria-label^="No negociable"]:placeholder-shown',
    spotLabel: "Escribí acá y tocá Enter",
    note: "No te van a cambiar la vida en un día, pero el hábito hace al maestro.",
  },
  {
    id: "hoy",
    target: "diarios",
    phone: "objetivos",
    kicker: "Paso 2 de 4 · No negociables",
    title: "¿Cuáles lograste hoy?",
    body: "Así arrancás tu racha desde el primer día.",
    spot: "[data-today]",
    spotLabel: "Tildá los que cumpliste hoy",
  },
  {
    id: "metas",
    target: "metas",
    phone: "logros",
    kicker: "Paso 3 de 4 · Metas importantes",
    title: "¿Cuáles son tus metas más importantes del año?",
    body: "Tienen que ser cosas que de verdad te cambien: volver a entrenar, hablar de una vez por todas con papá, hacer tu primer viaje sola.",
    spot: 'input[aria-label^="Nueva meta para"], button[aria-label^="Sumar una meta a"]',
    spotLabel: "Tocá acá para sumar una meta",
    note: "Te recomendamos 2 o 3 por mes. Ir al súper no es una meta 😉",
  },
  {
    id: "diario",
    target: "semana",
    phone: "objetivos",
    kicker: "Paso 4 de 4 · Tu diario",
    title: "Tu diario personal",
    body: "Lo que hiciste hoy fuera de tu rutina. Lo que suma a tu balde se reconoce solo; lo demás queda como nota.",
    spot: "#logro-text",
    spotLabel: "Escribí acá qué hiciste hoy",
    note: "Por ejemplo: «salí a caminar una hora y llamé a mi mamá».",
  },
  { id: "aviso", kicker: "Casi listo", title: "¿Cuándo querés que te pregunte por tu día?", body: "Te voy a recibir para que completes tu diario, tildes tus no negociables y mires tus metas del mes." },
  { id: "final", target: "bucket", phone: "tablero", kicker: "¡Listo!", title: "Bienvenido a tu dashboard de vida", body: "Así va quedando tu mes en tu balde. Cada día que anotes, se va a ir llenando con lo que te hace bien." },
];

/** Lo que hacés para vos: un ejemplo por categoría para empezar (se ajusta antes de sumarlo). */
const MINE_CATS: QuadrantId[] = ["cuerpo", "interior", "alma", "mente"];
const MINE_EXAMPLE: Record<string, { name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number }> = {
  cuerpo: { name: "Gimnasio", quadrant: "cuerpo", days: [2, 4], start: 1140, minutes: 60 },
  interior: { name: "Meditar", quadrant: "interior", days: [1, 3, 5], start: 420, minutes: 30 },
  alma: { name: "Hobby", quadrant: "alma", days: [6], start: 600, minutes: 120 },
  mente: { name: "Curso", quadrant: "mente", days: [3], start: 1140, minutes: 60 },
  vinculos: { name: "Salida con amigos", quadrant: "vinculos", days: [5], start: 1260, minutes: 120 },
};

const WHEN: { id: NonNullable<PlannerState["reminder"]>["when"]; label: string; hour: number }[] = [
  { id: "abrir", label: "Cada vez que abro la app", hour: 0 },
  { id: "manana", label: "A la mañana", hour: 9 },
  { id: "mediodia", label: "Al mediodía", hour: 13 },
  { id: "noche", label: "A la noche", hour: 21 },
];

export function Setup({
  phone,
  onTab,
  onSleep,
  onAddBlock,
  onDone,
}: {
  phone: boolean;
  onTab: (t: Phone) => void;
  onSleep: () => void;
  onAddBlock: (d: { name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number; lock?: boolean }) => void;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const iRef = useRef(0);
  iRef.current = i;
  const step = STEPS[i];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [zen, setZen] = useState(isZenPlaying());
  useEffect(() => onZenChange(setZen), []);
  const setReminder = usePlanner((s) => s.setReminder);
  const setSetupDone = usePlanner((s) => s.setSetupDone);

  // Cada paso se completa de verdad antes de seguir: lo que falta se dice al lado del botón.
  const routine = usePlanner((s) => s.routine);
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const checks = usePlanner((s) => s.dailyChecks);
  const tasks = usePlanner((s) => s.tasks);
  const logros = usePlanner((s) => s.logros);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const [noneToday, setNoneToday] = useState(false);
  const [noBusiness, setNoBusiness] = useState(false);
  const [noMine, setNoMine] = useState(false);
  const mineBlocks = routine.filter((b) => (MINE_CATS as string[]).includes(b.quadrant));
  const hasWork = routine.some((b) => b.quadrant === "trabajo" && !/emprend/i.test(b.name));
  const hasBusiness = routine.some((b) => /emprend/i.test(b.name));
  const todayKey = toKey(new Date());
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, todayKey.slice(0, 7));
  const goalsRef = useRef(0);
  goalsRef.current = goals.length;
  const missing: string | null = (() => {
    switch (step.id) {
      case "sueno":
        return sleepSet ? null : "Configurá a qué hora dormís.";
      case "trabajo":
        return hasWork ? null : "Sumá al menos un horario de trabajo.";
      case "paravos":
        return mineBlocks.length || noMine ? null : "Sumá al menos una cosa que hagas para vos (o elegí «Todavía nada»).";
      case "emprendimiento":
        return hasBusiness || noBusiness ? null : "Configuralo, o elegí «Más adelante» o «No emprendo».";
      case "noneg":
        return goals.length ? null : "Escribí al menos un no negociable en el panel.";
      case "hoy":
        return (checks[todayKey] ?? []).length || noneToday ? null : "Tildá en la grilla los que cumpliste hoy (o elegí «Hoy ninguno»).";
      case "metas":
        return tasks.some((t) => t.month >= todayKey.slice(0, 7) && !t.done) ? null : "Sumá al menos una meta en el panel.";
      case "diario":
        return logros.some((l) => l.date === todayKey) ? null : "Escribí algo en tu diario y guardalo.";
      default:
        return null;
    }
  })();
  const [when, setWhen] = useState<(typeof WHEN)[number]["id"]>("noche");
  const [hour, setHour] = useState(21);
  const bubble = useRef<HTMLDivElement>(null);

  // La bienvenida suena con la intro (si el navegador todavía no deja, en el primer toque) y después,
  // al empezar, queda la música zen de fondo.
  const introPlayed = useRef(false);
  useEffect(() => {
    if (step.id !== "welcome") return;
    let cancelled = false;
    const tryPlay = async () => {
      if (!introPlayed.current) introPlayed.current = await playIntro();
    };
    const onFirst = () => {
      if (!cancelled) void tryPlay();
    };
    void tryPlay().then(() => {
      if (!introPlayed.current && !cancelled) {
        window.addEventListener("pointerdown", onFirst, { once: true });
        window.addEventListener("keydown", onFirst, { once: true });
      }
    });
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, [step.id]);

  // En el celular, cada paso va a su pestaña.
  useEffect(() => {
    if (phone && step.phone) onTab(step.phone);
  }, [i, phone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dónde está lo que se destaca (se sigue si cambia de tamaño).
  useLayoutEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const find = () => {
      const el = phone ? document.querySelector("main#contenido") : document.querySelector(`[data-module="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    find();
    const t = window.setInterval(find, 400);
    window.addEventListener("resize", find);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", find);
    };
  }, [i, phone, step.target]);

  const autoOpened = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (autoOpened.current.has(step.id)) return;
    let t: number | undefined;
    if (step.id === "sueno" && !sleepSet) t = window.setTimeout(onSleep, 500);
    if (step.id === "trabajo" && !hasWork) t = window.setTimeout(() => onAddBlock({ name: "Trabajo", quadrant: "trabajo", days: [1, 2, 3, 4, 5], start: 540, minutes: 480, lock: true }), 500);
    if (step.id === "noneg") t = window.setTimeout(() => document.querySelector<HTMLInputElement>('input[aria-label^="No negociable"]:placeholder-shown')?.focus(), 600);
    autoOpened.current.add(step.id);
    return () => window.clearTimeout(t);
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // El resaltado: dónde está el lugar exacto para tocar o escribir (se sigue si se mueve).
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const spotOff = step.id === "noneg" && goals.length > 0;
  useEffect(() => {
    if (!step.spot || spotOff) {
      setSpot(null);
      return;
    }
    const find = () => {
      const el = document.querySelector(step.spot!);
      const rr = el?.getBoundingClientRect();
      setSpot(rr && rr.width > 0 ? rr : null);
    };
    find();
    const t = window.setInterval(find, 300);
    return () => window.clearInterval(t);
  }, [step.spot, spotOff]);

  // Al completar sueño, trabajo, emprendimiento o el diario, la guía sigue sola; los no negociables, al tocar
  // «Listo» en el panel.
  const AUTO = ["sueno", "trabajo", "emprendimiento", "diario"];
  const advanced = useRef<string | null>(null);
  useEffect(() => {
    if (!AUTO.includes(step.id) || missing || advanced.current === step.id) return;
    advanced.current = step.id;
    const t = window.setTimeout(() => nextRef.current(), 900);
    return () => window.clearTimeout(t);
  }, [step.id, missing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const done = () => {
      if (STEPS[iRef.current]?.id === "noneg" && goalsRef.current > 0) nextRef.current();
    };
    window.addEventListener("lb:noneg-listo", done);
    return () => window.removeEventListener("lb:noneg-listo", done);
  }, []);

  const next = () => {
    if (step.id === "noneg") {
      // Lo que quedó escrito se guarda y el panel pasa a la grilla.
      (document.activeElement as HTMLElement | null)?.blur();
      window.setTimeout(() => window.dispatchEvent(new Event("lb:noneg-done")), 0);
    }
    if (step.id === "aviso") setReminder({ when, hour: when === "abrir" ? 0 : hour });
    if (step.id === "final") {
      setSetupDone(true);
      cheer("welcome");
      onDone();
      return;
    }
    if (step.id !== "welcome") play("complete");
    else if (!isZenPlaying()) void startZen().then(() => setZen(isZenPlaying()));
    // El paso "vuela" hasta su lugar y aparece el siguiente.
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      setI((n) => n + 1);
    }, step.target ? 420 : 200);
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  const pad = 8;
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const center = !step.target || !hole;
  // La burbuja: al costado de lo destacado (donde haya lugar) o, en el celular, arriba.
  const place = (): React.CSSProperties => {
    if (center || !hole) return {};
    if (phone) return { top: 12, left: 12, right: 12 };
    const w = 336;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = bubble.current?.offsetHeight ?? 260;
    const top = Math.min(Math.max(16, hole.top + 24), vh - h - 16);
    if (hole.left + hole.width + w + 24 < vw) return { top, left: hole.left + hole.width + 16, width: w };
    if (hole.left - w - 24 > 0) return { top, left: hole.left - w - 16, width: w };
    // Si no entra al costado: arriba o abajo, centrada sobre lo destacado.
    const left = Math.min(Math.max(16, hole.left + hole.width / 2 - w / 2), vw - w - 16);
    return hole.top > h + 40 ? { top: hole.top - h - 16, left, width: w } : { top: Math.min(hole.top + hole.height + 16, vh - h - 16), left, width: w };
  };
  // Al completarse, la burbuja se encoge hacia el centro de lo destacado.
  const fly = (): React.CSSProperties => {
    if (!leaving || !hole || !bubble.current) return {};
    const b = bubble.current.getBoundingClientRect();
    const dx = hole.left + hole.width / 2 - (b.left + b.width / 2);
    const dy = hole.top + hole.height / 2 - (b.top + b.height / 2);
    return { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0 };
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      {/* La penumbra: cuatro paños alrededor de lo destacado (lo destacado se puede usar). */}
      {center ? (
        <div className="pointer-events-auto absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      ) : (
        <>
          <div className="pointer-events-auto absolute inset-x-0 top-0 bg-ink/45" style={{ height: Math.max(0, hole.top) }} />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-ink/45" style={{ top: hole.top + hole.height }} />
          <div className="pointer-events-auto absolute left-0 bg-ink/45" style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left) }} />
          <div className="pointer-events-auto absolute right-0 bg-ink/45" style={{ top: hole.top, height: hole.height, left: hole.left + hole.width }} />
          <div aria-hidden className="pointer-events-none absolute rounded-[22px] ring-2 ring-surface/90 transition-all duration-300" style={hole} />
        </>
      )}

      {spot && step.spotLabel && (
        <div aria-hidden className="pointer-events-none fixed z-[5]" style={{ top: spot.top - 6, left: spot.left - 6, width: spot.width + 12, height: spot.height + 12 }}>
          <span className="absolute inset-0 animate-pulse rounded-xl ring-[3px] ring-[#d99a00]" />
          <span
            className={cn("absolute left-1/2 flex -translate-x-1/2 flex-col items-center whitespace-nowrap", spot.top > 90 ? "bottom-full mb-1" : "top-full mt-1 flex-col-reverse")}
          >
            <span className="rounded-full bg-[#d99a00] px-3 py-1 text-[12.5px] font-semibold text-white shadow-[var(--shadow-popover)]">{step.spotLabel}</span>
            <span className="animate-bounce text-[22px] leading-none text-[#d99a00]">{spot.top > 90 ? "↓" : "↑"}</span>
          </span>
        </div>
      )}
      <div className={cn(center ? "absolute inset-0 grid place-items-center overflow-y-auto p-4" : "contents")}>
      <div
        ref={bubble}
        key={step.id}
        role="dialog"
        aria-labelledby="setup-title"
        style={{ ...place(), ...fly() }}
        className={cn(
          "pointer-events-auto animate-fade-up z-10 flex max-h-[calc(100dvh-24px)] flex-col gap-3 overflow-y-auto rounded-3xl bg-surface p-5 shadow-[var(--shadow-popover)] transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          center ? "relative w-full max-w-[520px] p-7 sm:p-8" : "absolute",
        )}
      >
        {step.id === "welcome" && (
          <span className="animate-fade-up mb-1 flex items-center gap-2">
            <BrandMark size={34} />
            <span className="text-[15px] font-semibold tracking-[0.18em]">LIFEBUCKET</span>
          </span>
        )}
        {step.id !== "welcome" && (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">
            <Sparkles aria-hidden className="size-3.5" />
            {step.kicker}
          </p>
        )}
        <h2 id="setup-title" className={cn("leading-tight font-semibold tracking-tight", center ? "text-[26px]" : "text-[19px]")}>
          {step.title}
        </h2>
        {step.lines ? (
          <div className="flex flex-col gap-2.5">
            {step.lines.map((l, k) => (
              <p key={k} style={{ animationDelay: `${200 + k * 450}ms` }} className={cn("animate-fade-up leading-snug text-ink/85", center ? "text-[17px]" : "text-[14px]", k === step.lines!.length - 1 && step.id === "welcome" && "font-medium text-ink")}>
                {l}
              </p>
            ))}
          </div>
        ) : (
          <p className={cn("leading-relaxed text-ink/80", center ? "text-[15.5px]" : "text-[13.5px]")}>{step.body}</p>
        )}
        {step.note && <p className="rounded-xl bg-surface-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-muted">{step.note}</p>}

        {step.action === "mine" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-1.5">
              {MINE_CATS.map((c) => {
                const n = mineBlocks.filter((b) => b.quadrant === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onAddBlock({ ...MINE_EXAMPLE[c], lock: true })}
                    style={partStyle(c)}
                    className={cn("pressable flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[13px] font-semibold", n ? "border-[var(--q)] bg-[var(--q-soft)]" : "border-line hover:bg-[var(--q-soft)]")}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q)] text-white">
                      <QuadrantIcon id={c} className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c === "alma" ? "Hobbies" : QUADRANT_BY_ID[c].name}</span>
                      <span className="block text-[11px] leading-snug font-normal text-ink-muted">{QUADRANT_HINT[c]}</span>
                    </span>
                    {n > 0 ? <Check aria-hidden strokeWidth={3} className="size-4 text-[var(--q)]" /> : <Plus aria-hidden className="size-4 text-ink-faint" />}
                  </button>
                );
              })}
              {!mineBlocks.length && (
                <button
                  type="button"
                  aria-pressed={noMine}
                  onClick={() => setNoMine(!noMine)}
                  className={cn("pressable h-11 rounded-2xl border px-3 text-[12.5px] font-medium", noMine ? "border-ink bg-ink text-surface" : "border-line text-ink-muted hover:bg-surface-sunken")}
                >
                  {noMine ? "✓ Todavía nada" : "Todavía nada"}
                </button>
              )}
            </div>
          </div>
        )}
        {step.action && step.action !== "mine" && (
          <div className="flex flex-col gap-2">
            {(() => {
              const cfg =
                step.action === "sleep"
                  ? { icon: Moon, label: sleepSet ? "Cambiar mi horario de sueño" : "Abrir el horario de sueño", done: sleepSet, onClick: onSleep }
                  : step.action === "work"
                    ? { icon: Briefcase, label: hasWork ? "Sumar otro horario de trabajo" : "Abrir mi horario de trabajo", done: hasWork, onClick: () => onAddBlock({ name: "Trabajo", quadrant: "trabajo", days: [1, 2, 3, 4, 5], start: 540, minutes: 480, lock: true }) }
                    : { icon: Rocket, label: hasBusiness ? "Sumar otro horario" : "Configurar mi emprendimiento", done: hasBusiness, onClick: () => onAddBlock({ name: "Emprendimiento", quadrant: "trabajo", days: [1, 2, 3, 4, 5], start: 1140, minutes: 120, lock: true }) };
              return (
                <button
                  type="button"
                  onClick={cfg.onClick}
                  className={cn(
                    "pressable flex h-12 items-center gap-3 rounded-2xl px-4 text-left text-[14px] font-semibold",
                    cfg.done ? "border border-[color-mix(in_oklab,var(--color-success)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_8%,transparent)]" : "bg-ink text-surface hover:bg-ink/90",
                  )}
                >
                  <cfg.icon aria-hidden className="size-5" />
                  <span className="flex-1">{cfg.label}</span>
                  {cfg.done && <Check aria-hidden strokeWidth={3} className="size-4 text-success" />}
                </button>
              );
            })()}
            {step.action === "business" && !hasBusiness && (
              <div className="grid grid-cols-2 gap-1.5">
                {["Más adelante", "No emprendo"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setNoBusiness(true);
                      window.setTimeout(next, 150);
                    }}
                    className="pressable h-11 rounded-2xl border border-line px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step.how && (
          <ol className="flex flex-col gap-1.5">
            {step.how.map((h, k) => (
              <li key={k} className="flex items-start gap-2 text-[13px] leading-snug">
                <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-surface">{k + 1}</span>
                {h}
              </li>
            ))}
          </ol>
        )}
        {step.id === "aviso" && (
          <div className="flex flex-col gap-2">
            <div role="radiogroup" aria-label="Cuándo" className="grid grid-cols-2 gap-1.5">
              {WHEN.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={when === w.id}
                  onClick={() => {
                    setWhen(w.id);
                    if (w.hour) setHour(w.hour);
                  }}
                  className={cn("pressable rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium", when === w.id ? "border-ink bg-ink text-surface" : "border-line hover:bg-surface-sunken")}
                >
                  {w.label}
                </button>
              ))}
            </div>
            {when !== "abrir" && (
              <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                <Bell aria-hidden className="size-4" />A partir de las
                <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink tabular-nums focus:border-ink focus:outline-none">
                  {Array.from({ length: 18 }, (_, k) => k + 6).map((hh) => (
                    <option key={hh} value={hh}>
                      {String(hh).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {missing && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-[color-mix(in_oklab,#d99a00_12%,transparent)] px-3 py-2 text-[12.5px] leading-snug text-[#8a6200]">
            <span aria-hidden>👉</span>
            {missing}
          </p>
        )}
        {!missing && step.target && step.id !== "final" && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)] px-3 py-2 text-[12.5px] leading-snug text-[color-mix(in_oklab,var(--color-success)_75%,var(--color-ink))]">
            <span aria-hidden>✓</span>
            ¡Bien! Podés seguir sumando o pasar al siguiente paso.
          </p>
        )}
        {step.id === "hoy" && !(checks[todayKey] ?? []).length && (
          <button type="button" onClick={() => setNoneToday(!noneToday)} aria-pressed={noneToday} className={cn("pressable self-start rounded-full border px-3 py-1.5 text-[12.5px] font-medium", noneToday ? "border-ink bg-ink text-surface" : "border-line hover:bg-surface-sunken")}>
            Hoy ninguno, arranco mañana
          </button>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          {step.id === "welcome" ? (
            <button
              type="button"
              onClick={() => {
                if (zen) stopZen();
                else void startZen();
                setZen(!zen);
              }}
              data-zen-toggle
              aria-pressed={zen}
              aria-label={zen ? "Apagar la música" : "Prender la música"}
              title={zen ? "Apagar la música" : "Prender la música"}
              className="pressable grid size-10 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {zen ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
            </button>
          ) : (
            <span className="flex gap-1" aria-hidden>
              {STEPS.slice(1).map((s, k) => (
                <span key={s.id} className={cn("h-1.5 rounded-full transition-all duration-300", k + 1 === i ? "w-4 bg-ink" : k + 1 < i ? "w-1.5 bg-ink/50" : "w-1.5 bg-ink/15")} />
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!!missing}
            title={missing ?? undefined}
            className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] font-semibold text-surface hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {step.id === "welcome" ? "Empezar" : step.id === "intro" ? "Vamos" : step.id === "final" ? "Ver mi dashboard" : "Listo, sigamos"}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

