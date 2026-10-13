"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { play, playIntro } from "@/lib/sfx";
import { BrandMark } from "./BrandMark";
import { toKey } from "@/lib/dates";
import { type QuadrantId } from "@/lib/quadrants";
import { carve, emptyMinutes, firstFreeSlot, type RoutineBlock } from "@/lib/routine";
import { COUNTRIES } from "@/lib/reminders";
import { goalsFor, newId, usePlanner } from "@/lib/store";

/**
 * La guía de configuración. Bienvenida e intro en una tarjeta al centro; después, en cada módulo, sin ventanas:
 * el panel del paso queda destacado (el resto, oscuro) y la guía son tarjetitas con flechita pegadas a cada
 * elemento, con sus botones cuando hay que elegir algo. Bloque 1: sueño, trabajo, emprendimiento, espacios
 * libres (con la demostración del almuerzo) y la barra de texto. Bloque 2: no negociables (escribirlos, tildar
 * los de hoy, editar y ver los resultados). Bloque 3: metas anuales. Bloque 4: recordatorios. Al final, el
 * balde de tu vida (para vos, la base, los espacios sin completar y los objetivos), un festejo y los atajos.
 */
type Phone = "semana" | "objetivos" | "logros" | "tablero";
type Step = { id: string; target?: string; phone?: Phone; center?: boolean };

const STEPS: Step[] = [
  { id: "welcome", center: true },
  { id: "rutina", center: true },
  { id: "sueno", target: "semana", phone: "semana" },
  { id: "trabajo", target: "semana", phone: "semana" },
  { id: "emprendimiento", target: "semana", phone: "semana" },
  { id: "libres", target: "semana", phone: "semana" },
  { id: "texto", target: "semana", phone: "semana" },
  { id: "noneg", target: "diarios", phone: "objetivos" },
  { id: "hoy", target: "diarios", phone: "objetivos" },
  { id: "noneg-ver", target: "diarios", phone: "objetivos" },
  { id: "metas", target: "metas", phone: "logros" },
  { id: "recordatorios", target: "list:pendientes", phone: "objetivos" },
  { id: "balde-intro", center: true },
  { id: "balde-vos", target: "bucket", phone: "tablero" },
  { id: "balde-base", target: "bucket", phone: "tablero" },
  { id: "balde-libres", target: "bucket", phone: "tablero" },
  { id: "balde-ajustar", target: "bucket", phone: "tablero" },
  { id: "fin", center: true },
  { id: "atajos" },
];

const EXAMPLE_TEXT = "mañana salgo a caminar de 18 a 21 hs";
const REMINDER_TEXT = "cumple de mamá el 3 de mayo";
const NO_CHECKS: string[] = [];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Lo que se abre en el editor en cada paso: con la pregunta del paso como título. */
const WORK = { name: "", quadrant: "trabajo" as QuadrantId, days: [1, 2, 3, 4, 5], start: 540, minutes: 480, lock: true, kicker: "Bloque 1 · Rutina", title: "¿Cómo se llama tu trabajo principal?", placeholder: "Ej.: Brandtag, el banco, freelance…" };
const BUSINESS = { name: "", quadrant: "trabajo" as QuadrantId, days: [1, 2, 3, 4, 5], start: 17 * 60, minutes: 120, lock: true, kicker: "Bloque 1 · Rutina", title: "¿Cómo se llama tu emprendimiento?", placeholder: "El nombre de tu emprendimiento" };
const ATAJOS: { sel: string; text: string }[] = [
  { sel: '[data-tour="mis-listas"]', text: "Mis listas: súper, notas, ¿dónde está?, recordatorios y los paneles que ocultaste" },
  { sel: '[data-module="semana"] header', text: "Cada panel se arrastra desde su título para moverlo" },
  { sel: 'button[aria-label^="Ocultar"]', text: "El ojito oculta un panel (vuelve desde «Mis listas»)" },
  { sel: 'button[aria-label="Deshacer el último cambio"]', text: "Deshacer el último cambio" },
  { sel: 'button[aria-label^="Colores"]', text: "Colores: prendido, a color; apagado, blanco y negro" },
  { sel: 'button[aria-label$="los sonidos"]', text: "Prender o apagar los sonidos" },
];

type Rect = { top: number; left: number; width: number; height: number };
type Action = { label: string; onClick: () => void; kind?: "primary" | "ghost" | "danger" };
/** float: una tarjeta arriba, al centro, sin señalar nada. side: de qué lado va la tarjeta (si no, se elige sola). */
type Mark = { sel?: string; rect?: Rect; text: ReactNode; dark?: boolean; actions?: Action[]; extra?: ReactNode; float?: boolean; side?: "left" | "right" | "below" | "above" };

/** Las columnas del calendario y dónde cae cada hora en pantalla. */
function grid() {
  const cols = [...document.querySelectorAll<HTMLElement>("[data-module=semana] [data-day-col]")];
  if (cols.length < 7) return null;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const col = (d: number) => cols[order.indexOf(d)].getBoundingClientRect();
  const y = (m: number) => {
    const r = cols[0].getBoundingClientRect();
    return r.top + ((m - 5 * 60) / (24 * 60 - 5 * 60)) * r.height;
  };
  return { col, y };
}

/** Escribir en un campo como si fuera una persona (para que React se entere). */
function typeInto(el: HTMLInputElement | HTMLTextAreaElement | null, text: string) {
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

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
  onAddBlock: (d: { name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number; lock?: boolean; title?: string; placeholder?: string; kicker?: string; subtitle?: string }) => void;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const stepRef = useRef(step.id);
  stepRef.current = step.id;
  const setSetupDone = usePlanner((s) => s.setSetupDone);
  const routine = usePlanner((s) => s.routine);
  const sleep = usePlanner((s) => s.sleep);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const tasks = usePlanner((s) => s.tasks);
  const logros = usePlanner((s) => s.logros);
  const pending = usePlanner((s) => s.lists.find((l) => l.type === "pendientes"));
  const todayKey = toKey(new Date());
  const todayChecks = usePlanner((s) => s.dailyChecks[todayKey]) ?? NO_CHECKS;
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, todayKey.slice(0, 7));
  const work = routine.filter((b) => b.quadrant === "trabajo");
  const openGoals = tasks.filter((t) => t.month >= todayKey.slice(0, 7) && !t.done).length;
  const empty = sleepSet ? emptyMinutes(routine, sleep) : 0;

  // Se vuelve a dibujar seguido: las tarjetitas siguen a los elementos si se mueven.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);
  const modalOpen = typeof document !== "undefined" && !!document.querySelector("dialog[open]");

  const finish = () => {
    setSetupDone(true);
    // Todo (no negociables, porcentajes, rutina) cuenta desde hoy, el día que configuraste la app.
    usePlanner.getState().setStartedAt(toKey(new Date()));
    cheer("welcome");
    onDone();
  };
  const next = () => {
    if (step.id === "fin" || step.id === "atajos") return finish();
    if (step.id !== "welcome") play("complete");
    setI((n) => Math.min(STEPS.length - 1, n + 1));
  };
  const nextRef = useRef(next);
  nextRef.current = next;
  /** Pasa al siguiente con una pausa (para que se vea lo que pasó). */
  const later = (ms = 1300) => window.setTimeout(() => nextRef.current(), ms);

  // La bienvenida suena con la intro (si el navegador todavía no deja, en el primer toque).
  const introPlayed = useRef(false);
  useEffect(() => {
    if (step.id !== "welcome") return;
    const tryPlay = async () => {
      if (!introPlayed.current) introPlayed.current = await playIntro();
    };
    void tryPlay();
    window.addEventListener("pointerdown", tryPlay, { once: true });
    return () => window.removeEventListener("pointerdown", tryPlay);
  }, [step.id]);

  // En el celular, cada paso va a su pestaña.
  useEffect(() => {
    if (phone && step.phone) onTab(step.phone);
  }, [i, phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = step.target === "list:pendientes" ? `list:${pending?.id ?? "pendientes"}` : step.target;
  // El panel de cada paso, siempre abierto (y más grande si hace falta).
  useEffect(() => {
    const grow = step.id === "noneg" || step.id === "hoy" ? 2.4 : step.id === "recordatorios" ? 3 : undefined;
    if (target) window.dispatchEvent(new CustomEvent("lb:module-expand", { detail: { id: target, grow } }));
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const find = () => setRect((phone ? document.querySelector("main#contenido") : document.querySelector(`[data-module="${target}"]`))?.getBoundingClientRect() ?? null);
    find();
    const t = window.setInterval(find, 300);
    return () => window.clearInterval(t);
  }, [i, phone, target]);

  // ——— Bloque 1: sueño, trabajo y emprendimiento (se abren solos y siguen solos). ———
  useEffect(() => {
    let t: number | undefined;
    if (step.id === "sueno" && !sleepSet) t = window.setTimeout(onSleep, 150);
    if (step.id === "trabajo" && !work.length) t = window.setTimeout(() => onAddBlock(WORK), 150);
    return () => window.clearTimeout(t);
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step.id === "sueno" && sleepSet && !modalOpen) {
      const t = later(500);
      return () => window.clearTimeout(t);
    }
  }, [step.id, sleepSet, modalOpen]);  
  useEffect(() => {
    if (step.id === "trabajo" && work.length && !modalOpen) {
      const t = later(500);
      return () => window.clearTimeout(t);
    }
  }, [step.id, work.length, modalOpen]);  
  const workAtBusiness = useRef<number | null>(null);
  if (step.id === "emprendimiento" && workAtBusiness.current === null) workAtBusiness.current = work.length;
  useEffect(() => {
    if (step.id === "emprendimiento" && workAtBusiness.current !== null && work.length > workAtBusiness.current && !modalOpen) {
      const t = later(500);
      return () => window.clearTimeout(t);
    }
  }, [step.id, work.length, modalOpen]);  

  // ——— Espacios libres: «Mostrame cómo» arrastra y suma el almuerzo; ¿te sirve?; después, completar. ———
  type Demo = { x: number; y: number; press: boolean; sel?: Rect };
  const [demo, setDemo] = useState<Demo | null>(null);
  const [libres, setLibres] = useState<"ofrecer" | "demo" | "preguntar" | "completar">("ofrecer");
  const beforeLunch = useRef<RoutineBlock[] | null>(null);
  const lunchRect = useRef<Rect | null>(null);
  const runLunch = () => {
    const g = grid();
    if (!g) return;
    setLibres("demo");
    const a = g.col(1);
    const z = g.col(5);
    const y1 = g.y(12 * 60);
    const y2 = g.y(13 * 60);
    lunchRect.current = { left: a.left, top: y1, width: z.right - a.left, height: y2 - y1 };
    setDemo({ x: a.left - 60, y: y1 - 80, press: false });
    const steps: [number, () => void][] = [
      [200, () => setDemo((d) => d && { ...d, x: a.left + 14, y: y1 + 4 })],
      [1300, () => setDemo((d) => d && { ...d, press: true, sel: { left: a.left + 3, top: y1, width: 6, height: 6 } })],
      [1600, () => setDemo((d) => d && { ...d, x: z.right - 14, y: y2 - 4, sel: { left: a.left + 3, top: y1, width: z.right - a.left - 6, height: y2 - y1 } })],
      [
        2900,
        () => {
          const st = usePlanner.getState();
          beforeLunch.current = st.routine;
          const lunch: RoutineBlock = { id: newId(), quadrant: "libre", name: "Almuerzo", days: [1, 2, 3, 4, 5], start: 12 * 60, minutes: 60 };
          st.setRoutine(carve(st.routine, lunch), st.routineSeries);
          play("bubble");
          setDemo(null);
          setLibres("preguntar");
        },
      ],
    ];
    for (const [ms, fn] of steps) window.setTimeout(fn, ms);
  };
  const removeLunch = () => {
    // Vuelve la rutina como estaba antes del almuerzo (el trabajo, entero de nuevo).
    const st = usePlanner.getState();
    if (beforeLunch.current) st.setRoutine(beforeLunch.current, st.routineSeries);
    play("delete");
    setLibres("completar");
  };
  const freeSlot = (() => {
    if (step.id !== "libres" || libres !== "completar" || typeof document === "undefined") return null;
    const slot = firstFreeSlot(routine, sleep);
    const g = grid();
    if (!slot || !g) return null;
    const c = g.col(slot.day);
    return { left: c.left + 3, top: g.y(slot.start), width: c.width - 6, height: g.y(slot.start + 60) - g.y(slot.start) };
  })();

  // ——— La barra de texto: ejemplo de 3 horas, ¿solo esta vez, rutina o borrarlo?, ¿algo más? ———
  const [texto, setTexto] = useState<"ofrecer" | "escribiendo" | "preguntar" | "dias" | "mas" | "agregando">("ofrecer");
  const exampleId = useRef<string | null>(null);
  const [routineDays, setRoutineDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const logrosAt = useRef(0);
  const runExample = () => {
    setTexto("escribiendo");
    const el = () => document.querySelector<HTMLTextAreaElement>("#logro-text");
    el()?.focus();
    let k = 0;
    const tick = () => {
      k++;
      typeInto(el(), EXAMPLE_TEXT.slice(0, k));
      if (k % 3 === 0) play("click");
      if (k < EXAMPLE_TEXT.length) window.setTimeout(tick, 70 + Math.random() * 50);
      else
        window.setTimeout(() => {
          const before = usePlanner.getState().logros.length;
          document.querySelector<HTMLButtonElement>('button[aria-label="Guardar en mi diario"]')?.click();
          window.setTimeout(() => {
            const ls = usePlanner.getState().logros;
            exampleId.current = ls.length > before ? ls[ls.length - 1].id : null;
            (document.activeElement as HTMLElement | null)?.blur();
            setTexto("preguntar");
          }, 200);
        }, 1800);
    };
    window.setTimeout(tick, 400);
  };
  // Mientras se eligen los días, se ve repetido en el calendario.
  useEffect(() => {
    const l = usePlanner.getState().logros.find((x) => x.id === exampleId.current);
    const items = texto === "dias" && l ? [{ text: l.text, category: l.category, minutes: l.minutes || 60, date: l.date, start: l.start, repeat: routineDays }] : [];
    window.dispatchEvent(new CustomEvent("lb:diary-preview", { detail: items }));
  }, [texto, routineDays]);
  const exampleToRoutine = () => {
    const st = usePlanner.getState();
    const l = st.logros.find((x) => x.id === exampleId.current);
    if (l && routineDays.length) {
      const block: RoutineBlock = { id: newId(), quadrant: (l.category ?? "cuerpo") as QuadrantId, name: l.text, days: routineDays, start: l.start ?? 18 * 60, minutes: l.minutes || 60 };
      st.setRoutine(carve(st.routine, block), st.routineSeries);
      st.removeLogro(l.id);
      play("complete");
    }
    setTexto("mas");
  };
  const deleteExample = () => {
    if (exampleId.current) usePlanner.getState().removeLogro(exampleId.current);
    play("delete");
    setTexto("mas");
  };
  useEffect(() => {
    if (step.id === "texto" && texto === "agregando" && logros.length > logrosAt.current) {
      const t = later(1200);
      return () => window.clearTimeout(t);
    }
  }, [step.id, texto, logros.length]);  

  // ——— No negociables: con 3 o más, «Listo» del panel sigue; los de hoy, al completarlos. ———
  useEffect(() => {
    const done = () => {
      const st = usePlanner.getState();
      if (stepRef.current === "noneg" && goalsFor({ dailyGoals: st.dailyGoals, goalMonths: st.goalMonths }, toKey(new Date()).slice(0, 7)).length >= 3) nextRef.current();
    };
    window.addEventListener("lb:noneg-listo", done);
    return () => window.removeEventListener("lb:noneg-listo", done);
  }, []);
  useEffect(() => {
    if (step.id !== "noneg") return;
    const t = window.setTimeout(() => document.querySelector<HTMLInputElement>('input[aria-label^="No negociable"]:placeholder-shown')?.focus(), 500);
    return () => window.clearTimeout(t);
  }, [step.id]);
  useEffect(() => {
    if (step.id === "hoy" && goals.length && goals.every((g) => todayChecks.includes(g.id))) {
      const t = later(1600);
      return () => window.clearTimeout(t);
    }
  }, [step.id, todayChecks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Ver los resultados: primero el lápiz y, un momento después, ampliar; al cerrar el ampliado, sigue.
  const [verPhase, setVerPhase] = useState<"lapiz" | "ampliar" | "abierto">("lapiz");
  useEffect(() => {
    if (step.id !== "noneg-ver") return;
    const t = window.setTimeout(() => setVerPhase("ampliar"), 2600);
    return () => window.clearTimeout(t);
  }, [step.id]);
  const historyOpen = typeof document !== "undefined" && !!document.querySelector("#goals-history-title");
  useEffect(() => {
    if (step.id !== "noneg-ver") return;
    if (historyOpen && verPhase !== "abierto") setVerPhase("abierto");
    if (!historyOpen && verPhase === "abierto") later(400);
  }, [step.id, historyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Metas: con dos, sigue. ———
  const goalsAt = useRef<number | null>(null);
  if (step.id === "metas" && goalsAt.current === null) goalsAt.current = openGoals;
  const addedGoals = step.id === "metas" ? openGoals - (goalsAt.current ?? openGoals) : 0;
  useEffect(() => {
    if (step.id === "metas" && addedGoals >= 2) {
      const t = later(1400);
      return () => window.clearTimeout(t);
    }
  }, [step.id, addedGoals]);  

  // ——— Recordatorios: «Hacé un ejemplo por mí»; cuando sumás uno vos, sigue. ———
  const [rem, setRem] = useState<"ofrecer" | "escribiendo" | "probar">("ofrecer");
  const remCount = pending?.items.length ?? 0;
  const remAt = useRef<number | null>(null);
  if (step.id === "recordatorios" && remAt.current === null) remAt.current = remCount;
  const runReminder = () => {
    setRem("escribiendo");
    const el = () => document.querySelector<HTMLInputElement>('input[aria-label="Nuevo recordatorio"]');
    let k = 0;
    const tick = () => {
      k++;
      typeInto(el(), REMINDER_TEXT.slice(0, k));
      if (k % 3 === 0) play("click");
      if (k < REMINDER_TEXT.length) window.setTimeout(tick, 75 + Math.random() * 45);
      else
        window.setTimeout(() => {
          el()?.form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
          window.setTimeout(() => {
            remAt.current = usePlanner.getState().lists.find((l) => l.type === "pendientes")?.items.length ?? 0;
            setRem("probar");
          }, 200);
        }, 3000);
    };
    window.setTimeout(tick, 300);
  };
  useEffect(() => {
    if (step.id === "recordatorios" && rem !== "escribiendo" && remAt.current !== null && remCount > remAt.current) {
      const t = later(1400);
      return () => window.clearTimeout(t);
    }
  }, [step.id, remCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— El balde: base a la vista; sin espacios por completar, ese paso se saltea; objetivos al abrirse y cerrarse. ———
  useEffect(() => {
    if (step.id === "balde-base") document.querySelector('[data-tour="balde-lista"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (step.id === "balde-libres") {
      const el = document.querySelector('[data-tour="balde-libres"]');
      if (!el) nextRef.current();
      else el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [step.id]);
  useEffect(() => {
    if (step.id !== "balde-ajustar" || document.querySelector('[data-tour="ajustar-vos"]')) return;
    document.querySelector<HTMLButtonElement>('[data-tour="balde-vos"] > button[aria-expanded="false"]')?.click();
    window.setTimeout(() => document.querySelector('[data-tour="ajustar-vos"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 100);
  }, [step.id]);
  const idealOpen = typeof document !== "undefined" && !!document.querySelector("#ideal-title");
  const idealWasOpen = useRef(false);
  useEffect(() => {
    if (step.id !== "balde-ajustar") return;
    if (idealOpen) idealWasOpen.current = true;
    else if (idealWasOpen.current) later(400);
  }, [step.id, idealOpen]);  
  // El final: un sonido de logro y unos destellos.
  useEffect(() => {
    if (step.id === "fin") play("fanfare");
  }, [step.id]);
  const [atajo, setAtajo] = useState(0);

  // ——— Qué tarjetitas se ven en cada paso. ———
  const marks: Mark[] = (() => {
    if (typeof document === "undefined") return [];
    const head = '[data-module="semana"] header';
    switch (step.id) {
      case "sueno":
        return modalOpen || sleepSet ? [] : [{ sel: head, text: "Configurá a qué hora te acostás y te levantás", actions: [{ label: "Abrir", onClick: onSleep, kind: "primary" }] }];
      case "trabajo":
        return modalOpen || work.length ? [] : [{ sel: head, text: "Cargá el horario de tu trabajo principal", actions: [{ label: "Cargar mi trabajo", onClick: () => onAddBlock(WORK), kind: "primary" }] }];
      case "emprendimiento":
        return modalOpen
          ? []
          : [
              {
                float: true,
                text: "¿Tenés un emprendimiento? Si tenés, cargalo como tu trabajo.",
                actions: [
                  { label: "Cargar mi emprendimiento", onClick: () => onAddBlock(BUSINESS), kind: "primary" },
                  { label: "Más adelante", onClick: next },
                  { label: "No emprendo", onClick: next, kind: "danger" },
                ],
              },
            ];
      case "libres":
        if (libres === "ofrecer") {
          const g = grid();
          // Desde el borde del calendario (las horas), así la tarjeta queda a la izquierda, a la altura del almuerzo.
          const cal = document.querySelector('[data-module="semana"]')?.getBoundingClientRect();
          const at = g && cal ? { left: cal.left + 8, top: g.y(12 * 60), width: g.col(5).right - cal.left - 8, height: g.y(13 * 60) - g.y(12 * 60) } : null;
          return [{ ...(at ? { rect: at, side: "left" as const } : { sel: head }), text: "Agregá tus espacios libres. Por ejemplo, el almuerzo de 12 a 13, en el medio de tu trabajo.", actions: [{ label: "Mostrame cómo", onClick: runLunch, kind: "primary" }, { label: "Saltear", onClick: next }] }];
        }
        if (libres === "preguntar" && lunchRect.current)
          return [
            {
              rect: lunchRect.current,
              text: "¿Te sirve el almuerzo de 12 a 13? Si es otro horario, arrastralo o estiralo.",
              actions: [
                { label: "Sí, dejalo", onClick: () => setLibres("completar"), kind: "primary" },
                { label: "No, borralo", onClick: removeLunch, kind: "danger" },
              ],
            },
          ];
        if (libres === "completar")
          return [
            {
              ...(freeSlot ? { rect: freeSlot } : { sel: head }),
              text: freeSlot ? "Completá tus espacios libres: arrastrá sobre un espacio en blanco como este y ponele nombre" : `Te quedan ${Math.round(empty / 60)} h sin completar en tu semana`,
              actions: [{ label: "Listo, sigamos", onClick: next, kind: "primary" }, { label: "Lo completo después", onClick: next }],
            },
          ];
        return [];
      case "texto":
        if (texto === "ofrecer")
          return [{ sel: "#logro-text", text: "Escribí acá lo que quieras agregar, sin arrastrar en el calendario: algo de tu rutina o algo que hiciste fuera de ella", actions: [{ label: "Mostrame un ejemplo", onClick: runExample, kind: "primary" }, { label: "Seguir", onClick: next }] }];
        if (texto === "escribiendo") return [{ sel: "#logro-text", text: "Lo escribo como lo contarías: lo entiende solo" }];
        if (texto === "preguntar" || texto === "dias") {
          const ev = exampleId.current ? `[data-extra="${exampleId.current}"]` : "#logro-text";
          return [
            {
              sel: ev,
              text: texto === "dias" ? "¿Qué días? En verde, los que van" : "Acá está: mañana de 18 a 21. ¿Es algo de una vez o parte de tu rutina?",
              extra:
                texto === "dias" ? (
                  <div className="mt-1.5 flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = routineDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          aria-label={`Rutina: ${DAY_NAMES[d]}`}
                          onClick={() => setRoutineDays(on ? routineDays.filter((x) => x !== d) : [...routineDays, d])}
                          className={cn("pressable grid size-7 place-items-center rounded-full text-[11.5px] font-semibold", on ? "bg-success text-white" : "bg-white/25 text-white")}
                        >
                          {"DLMMJVS"[d]}
                        </button>
                      );
                    })}
                  </div>
                ) : undefined,
              actions:
                texto === "dias"
                  ? [
                      { label: "Sumar a mi rutina", onClick: exampleToRoutine, kind: "primary" },
                      { label: "Volver", onClick: () => setTexto("preguntar") },
                    ]
                  : [
                      { label: "Solo esta vez", onClick: () => setTexto("mas"), kind: "primary" },
                      { label: "Hacerlo rutina", onClick: () => setTexto("dias") },
                      { label: "Borrar el ejemplo", onClick: deleteExample, kind: "danger" },
                    ],
            },
          ];
        }
        if (texto === "mas")
          return [
            {
              sel: "#logro-text",
              text: "¿Te olvidaste algo o querés agregar algo más a tu rutina?",
              actions: [
                {
                  label: "Sí, agregar",
                  onClick: () => {
                    logrosAt.current = usePlanner.getState().logros.length;
                    setTexto("agregando");
                    document.querySelector<HTMLTextAreaElement>("#logro-text")?.focus();
                  },
                  kind: "primary",
                },
                { label: "No", onClick: next },
                { label: "Lo hago después", onClick: next },
              ],
            },
          ];
        return [{ sel: "#logro-text", text: "Escribilo acá y tocá Enter", actions: [{ label: "Seguir", onClick: next }] }];
      case "noneg": {
        const open = !!document.querySelector('input[aria-label^="No negociable"]');
        if (!open) return [{ sel: 'button[aria-label="Editar los no negociables de este mes"]', text: "Modificá o agregá no negociables" }];
        if (goals.length >= 3) return [{ sel: '[data-tour="noneg-listo"]', text: "¡Bien! Ahora sumá un par más o tocá acá" }];
        return [{ sel: 'input[aria-label^="No negociable"]:focus, input[aria-label^="No negociable"]:placeholder-shown', text: "Escribí acá uno o más no negociables: los hábitos que te cuesta sostener (Enter para el siguiente)" }];
      }
      case "hoy":
        return [{ sel: "[data-today]", text: "Tocá cada casilla o arrastrá para completar los de hoy", actions: [{ label: "Hoy no hice ninguno", onClick: next }] }];
      case "noneg-ver":
        if (historyOpen) return [];
        return verPhase === "lapiz"
          ? [{ sel: 'button[aria-label="Editar los no negociables de este mes"]', text: "Con el lápiz editás tus no negociables cuando quieras" }]
          : [
              { sel: 'button[aria-label="Editar los no negociables de este mes"]', text: "Editar", dark: true },
              { sel: 'button[aria-label="Ver cómo te fue mes a mes"]', text: "Tocá para ampliar y ver todos tus resultados", actions: [{ label: "Saltear", onClick: next }] },
            ];
      case "metas": {
        const input = 'input[aria-label^="Nueva meta para"]';
        const sel = document.querySelector(input) ? input : 'button[aria-label^="Sumar una meta a"]';
        if (addedGoals === 1) return [{ sel, side: "above", text: "¡Bien! ¿Querés sumar una más?", actions: [{ label: "No, sigamos", onClick: next }] }];
        return [{ sel, side: "above", text: sel === input ? "Escribí una meta importante y tocá Enter para sumarla" : "Tocá para sumar una meta importante del año" }];
      }
      case "recordatorios":
        if (rem === "ofrecer")
          return [
            {
              sel: 'input[aria-label="Nuevo recordatorio"]',
              text: "Escribí algo chiquito que quieras acordarte (no una meta): «comprar pilas el viernes», «cumple de Juan el 3»",
              actions: [
                { label: "Hacé un ejemplo por mí", onClick: runReminder, kind: "primary" },
                { label: "Saltear", onClick: next },
              ],
            },
          ];
        if (rem === "escribiendo") return [{ sel: 'input[aria-label="Nuevo recordatorio"]', text: "Mirá: reconoce solo el tipo (cumpleaños), la fecha y que se repite cada año" }];
        return [{ sel: 'input[aria-label="Nuevo recordatorio"]', text: "¡Listo! Ahora probá agregar otro más", actions: [{ label: "Saltear", onClick: next }] }];
      case "balde-vos":
        return [{ sel: '[data-tour="balde-vos"]', text: "Este es tu «Tiempo para mí»: deporte, mente y espíritu, hobbies, aprender y los tuyos. Cada fila: tu objetivo, lo que llenaste y qué parte del balde ocupa.", actions: [{ label: "Siguiente ✓", onClick: next, kind: "primary" }] }];
      case "balde-base":
        return [{ sel: '[data-tour="balde-lista"]', text: "Y esta es la base de tu vida: sueño, trabajo y tareas cotidianas, cada una con su %, ordenadas de mayor a menor.", actions: [{ label: "Siguiente ✓", onClick: next, kind: "primary" }] }];
      case "balde-libres":
        return [
          {
            sel: '[data-tour="balde-libres"]',
            text: `Tenés ${Math.round(empty / 60)} h de espacios sin completar en tu semana: no cuentan en tu balde`,
            actions: [
              {
                label: "Lo completo ahora",
                onClick: () => {
                  document.querySelector<HTMLElement>('[data-tour="balde-libres"]')?.click();
                  next();
                },
                kind: "primary",
              },
              { label: "Lo completo después", onClick: next },
            ],
          },
        ];
      case "balde-ajustar":
        if (idealOpen)
          return [
            { sel: '[aria-labelledby="ideal-title"] li', text: "Con − y + cambiás las horas por semana de cada cosa: deporte, mente y espíritu, hobbies…" },
            { sel: '[aria-labelledby="ideal-title"] button[aria-label="Cerrar"]', text: "Cerrá para terminar", dark: true },
          ];
        return [{ sel: '[data-tour="ajustar-vos"]', text: "Tocá para ajustar tus objetivos de cada semana", actions: [{ label: "Saltear", onClick: next }] }];
      case "atajos": {
        const a = ATAJOS[atajo];
        if (!a) return [];
        const last = atajo === ATAJOS.length - 1;
        return [{ sel: a.sel, text: a.text, dark: true, actions: [{ label: last ? "Terminar" : "Siguiente", onClick: () => (last ? finish() : setAtajo(atajo + 1)), kind: "primary" }] }];
      }
      default:
        return [];
    }
  })();

  // ——— Dibujo. ———
  const pad = 8;
  const hole = rect && target ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const shade = "pointer-events-auto absolute bg-[color-mix(in_oklab,var(--color-ink)_72%,transparent)] backdrop-blur-[3px]";
  const resolve = (m: Mark): Rect | null => {
    if (m.rect) return m.rect;
    const r = m.sel ? document.querySelector(m.sel)?.getBoundingClientRect() : null;
    return r && r.width > 0 ? r : null;
  };
  const chip = (m: Mark, k: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = 280;
    if (m.float) return floatCard(m, k);
    const r = resolve(m);
    if (!r) return null;
    const side = m.side ?? (r.left + r.width + w + 24 < vw ? "right" : r.left - w - 24 > 0 ? "left" : "below");
    const cy = Math.min(Math.max(80, r.top + r.height / 2), vh - 100);
    const style: React.CSSProperties =
      side === "right"
        ? { top: cy, left: r.left + r.width + 14, transform: "translateY(-50%)" }
        : side === "left"
          ? { top: cy, right: vw - r.left + 14, transform: "translateY(-50%)" }
          : side === "above"
            ? { top: r.top - 12, left: Math.min(Math.max(12, r.left - 8), vw - w - 12), transform: "translateY(-100%)" }
            : { top: Math.min(r.top + r.height + 12, vh - 170), left: Math.min(Math.max(12, r.left), vw - w - 12) };
    return (
      <div key={k}>
        <span aria-hidden className={cn("fixed rounded-xl ring-[3px]", m.dark ? "ring-ink/80" : "animate-pulse ring-[#d99a00]")} style={{ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 }} />
        <div
          role="note"
          className={cn("fixed flex w-max max-w-[280px] flex-col gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] leading-snug font-semibold shadow-[var(--shadow-popover)]", m.dark ? "bg-ink text-surface" : "bg-[#d99a00] text-white", m.actions && "pointer-events-auto")}
          style={style}
        >
          {/* La flecha, del lado del elemento que señala. */}
          <span className="flex items-start gap-1.5">
            {side === "right" && <span className="text-[15px] leading-none">←</span>}
            {side === "above" && <span className="text-[15px] leading-none">↓</span>}
            <span>{m.text}</span>
            {side === "left" && <span className="ml-auto text-[15px] leading-none">→</span>}
          </span>
          {m.extra}
          {m.actions && (
            <span className="mt-0.5 flex flex-wrap gap-1.5">
              {m.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  className={cn(
                    "pressable h-8 rounded-full px-3 text-[12.5px] font-semibold",
                    a.kind === "primary" ? (m.dark ? "bg-surface text-ink" : "bg-white text-[#8a6200]") : a.kind === "danger" ? "bg-[#b42318] text-white" : "bg-white/20 text-white hover:bg-white/30",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Una tarjeta arriba, al centro de la pantalla (para preguntas que no señalan nada).
  const floatCard = (m: Mark, k: number) => (
    <div key={k} role="note" className="animate-fade-up pointer-events-auto fixed top-20 left-1/2 z-[2] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2.5 rounded-2xl bg-[#d99a00] px-4 py-3.5 text-[14.5px] leading-snug font-semibold text-white shadow-[var(--shadow-popover)]">
      <span>{m.text}</span>
      {m.actions && (
        <span className="flex flex-wrap gap-1.5">
          {m.actions.map((a) => (
            <button key={a.label} type="button" onClick={a.onClick} className={cn("pressable h-9 rounded-full px-3.5 text-[13px] font-semibold", a.kind === "primary" ? "bg-white text-[#8a6200]" : a.kind === "danger" ? "bg-[#b42318] text-white" : "bg-white/20 text-white hover:bg-white/30")}>
              {a.label}
            </button>
          ))}
        </span>
      )}
    </div>
  );
  const centerCard = (body: ReactNode, cta: string, onCta: () => void, secondary?: { label: string; onClick: () => void }) => (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <div role="dialog" aria-labelledby="setup-title" className="pointer-events-auto animate-fade-up relative flex w-full max-w-[560px] flex-col gap-3 rounded-3xl bg-surface p-7 shadow-[var(--shadow-popover)] sm:p-8">
        {body}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {secondary && (
            <button type="button" onClick={secondary.onClick} className="pressable h-11 rounded-full px-5 text-[14px] font-semibold text-ink-muted ring-1 ring-line hover:bg-surface-sunken hover:text-ink">
              {secondary.label}
            </button>
          )}
          <button type="button" onClick={onCta} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-6 text-[14px] font-semibold text-surface hover:bg-ink/90">
            {cta}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
  const kicker = (t: string) => (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">
      <Sparkles aria-hidden className="size-3.5" />
      {t}
    </p>
  );

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
        {step.id === "welcome" ? (
          <div className="pointer-events-auto absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#fdf6e3_0%,#f3eefc_45%,#e8eef9_100%)]" />
        ) : step.center ? (
          <div className={cn(shade, "inset-0")} />
        ) : hole ? (
          <>
            <div className={cn(shade, "inset-x-0 top-0")} style={{ height: Math.max(0, hole.top) }} />
            <div className={cn(shade, "inset-x-0 bottom-0")} style={{ top: hole.top + hole.height }} />
            <div className={cn(shade, "left-0")} style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left) }} />
            <div className={cn(shade, "right-0")} style={{ top: hole.top, height: hole.height, left: hole.left + hole.width }} />
            <div aria-hidden className="pointer-events-none absolute rounded-[22px] ring-[3px] ring-white shadow-[0_0_0_6px_rgba(255,255,255,0.18)]" style={hole} />
          </>
        ) : null}

        {demo && (
          <>
            {demo.sel && <div aria-hidden className="fixed rounded-[5px] border-2 border-dashed border-ink/60 bg-ink/10 transition-all duration-[1100ms] ease-out" style={demo.sel} />}
            <div aria-hidden className="fixed z-[2] transition-[left,top] duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]" style={{ left: demo.x, top: demo.y }}>
              <svg width="26" height="26" viewBox="0 0 24 24" className={cn("drop-shadow-md transition-transform duration-150", demo.press && "scale-90")}>
                <path d="M4 2l15 9-6.5 1.6L9.6 19z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
          </>
        )}

        {step.id === "welcome" &&
          centerCard(
            <>
              <span className="animate-fade-up mb-1 flex items-center gap-2">
                <BrandMark size={34} />
                <span className="text-[15px] font-semibold tracking-[0.18em]">LIFEBUCKET</span>
              </span>
              <h2 id="setup-title" className="text-[26px] leading-tight font-semibold tracking-tight">
                ¿Sentís que se te va la vida y todo es trabajo y dormir?
              </h2>
              {["¿Te gustaría ver cómo va tu vida…", "…y cómo va a ser si seguís por el camino que vas?", "Creé LifeBucket para mí y para vos.", "Sin volvernos obsesivos: día a día y sin estresarnos, saber qué estamos haciendo para ser más felices."].map((l, k) => (
                <p key={k} style={{ animationDelay: `${200 + k * 450}ms` }} className={cn("animate-fade-up text-[17px] leading-snug text-ink/85", k === 3 && "font-medium text-ink")}>
                  {l}
                </p>
              ))}
              <CountryPick />
            </>,
            "Empezar",
            next,
          )}
        {step.id === "rutina" &&
          centerCard(
            <>
              {kicker("Bloque 1 · Tu rutina semanal")}
              <h2 id="setup-title" className="text-[26px] leading-tight font-semibold tracking-tight">
                Primero, vamos a configurar tu rutina semanal
              </h2>
              <p className="text-[16px] leading-snug text-ink/85">Es importante que completes todos los espacios, incluyendo tus tiempos libres o lo que dedicás a tareas cotidianas.</p>
            </>,
            "Vamos",
            next,
          )}
        {step.id === "balde-intro" &&
          centerCard(
            <>
              {kicker("Tu LifeBucket")}
              <h2 id="setup-title" className="text-[26px] leading-tight font-semibold tracking-tight">
                Ahora vamos a ver cómo queda el balde de tu vida
              </h2>
              <p className="text-[16px] leading-snug text-ink/85">Cuánto de tu semana es la base (sueño, trabajo y tareas) y cuánto es para vos.</p>
            </>,
            "Ver el balde de mi vida",
            next,
          )}
        {step.id === "fin" && (
          <>
            {/* Unos destellos, minimalistas. */}
            <div aria-hidden className="absolute top-1/2 left-1/2">
              {Array.from({ length: 18 }, (_, k) => {
                const ang = (k / 18) * Math.PI * 2;
                const dist = 200 + (k % 3) * 40;
                return (
                  <span
                    key={k}
                    className="absolute size-2 animate-[spark_1.2s_ease-out_forwards] rounded-full"
                    style={{ "--dx": `${Math.cos(ang) * dist}px`, "--dy": `${Math.sin(ang) * dist}px`, background: ["#2e9e63", "#8a5cf0", "#e3a008", "#e5508a", "#2563eb"][k % 5], animationDelay: `${(k % 4) * 60}ms` } as React.CSSProperties}
                  />
                );
              })}
            </div>
            {centerCard(
              <>
                {kicker("¡Listo!")}
                <h2 id="setup-title" className="text-[28px] leading-tight font-semibold tracking-tight">
                  ¡Ya terminamos! 🎉
                </h2>
                <p className="text-[16px] leading-snug text-ink/85">Tu LifeBucket ya está armado. ¿Querés ver unos atajos que te van a servir?</p>
              </>,
              "Ver guía de atajos",
              () => setI(STEPS.findIndex((s) => s.id === "atajos")),
              { label: "Terminar y seguir completando", onClick: finish },
            )}
          </>
        )}
      </div>
      {/* Las tarjetitas van encima de todo (también de los editores que no son ventanas). */}
      <div className="pointer-events-none fixed inset-0 z-[200]">{marks.map(chip)}</div>
    </>
  );
}

/** En la bienvenida: ¿en qué país vivís? (para los feriados y fechas patrias). Arranca con el del navegador. */
function CountryPick() {
  const country = usePlanner((s) => s.country);
  const setCountry = usePlanner((s) => s.setCountry);
  useEffect(() => {
    const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
    if (region && COUNTRIES.some((c) => c.id === region)) usePlanner.getState().setCountry(region);
  }, []);
  return (
    <label style={{ animationDelay: "2200ms" }} className="animate-fade-up mt-2 flex items-center gap-2.5 text-[14.5px] text-ink/85">
      ¿En qué país vivís?
      <select value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 rounded-full border border-line bg-surface px-3 text-[14px] font-medium text-ink focus:border-ink focus:outline-none">
        {COUNTRIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.flag} {c.name}
          </option>
        ))}
      </select>
      <span className="text-[12px] text-ink-muted">Para tus feriados</span>
    </label>
  );
}
