"use client";

import { ArrowRight, Briefcase, Check, Eye, GripVertical, ListPlus, Moon, Music, Plus, Rocket, Sparkles, Undo2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { play, playIntro } from "@/lib/sfx";
import { BrandMark } from "./BrandMark";
import { toKey } from "@/lib/dates";
import { QUADRANT_BY_ID, type QuadrantId } from "@/lib/quadrants";
import { partStyle } from "@/lib/mode";
import { QuadrantIcon } from "./QuadrantIcon";
import { carve, emptyMinutes, type RoutineBlock } from "@/lib/routine";
import { goalsFor, newId, usePlanner } from "@/lib/store";
import { ACTIVE_PARTS, weekMinutes } from "@/lib/week-shares";
import { isZenPlaying, onZenChange, startZen, stopZen } from "@/lib/zen";

/**
 * La guía de configuración, paso a paso. Primero una bienvenida a pantalla completa (sin ver la app atrás);
 * después cada bloque del tablero se destaca solo (el resto queda oscuro y borroso) y se completa ahí mismo:
 * 1) la rutina semanal (sueño, trabajo, emprendimiento y el resto de la semana, con un ejemplo de almuerzo
 * que pisa el trabajo), y la barra para anotar lo que queda afuera; 2) los no negociables; 3) las metas
 * anuales; 4) los recordatorios. Al final, el balde con su análisis y un paseo por los botones de arriba.
 */
type Phone = "semana" | "objetivos" | "logros" | "tablero";
type Step = {
  id: string;
  /** El panel que se destaca (su data-module). */
  target?: string;
  phone?: Phone;
  kicker: string;
  title: string;
  body?: string;
  lines?: string[];
  note?: string;
  action?: "sleep" | "work" | "business";
  /** Dónde tocar o escribir (se resalta con una flechita) y qué dice la flechita. */
  spot?: string;
  spotLabel?: string;
  /** Se puede dejar para después. */
  skip?: string;
  /** Más detalle: qué se puede hacer en ese panel. */
  tips?: string[];
  /** Agrandar el panel durante el paso (peso en su columna). */
  grow?: number;
  /** Sin "Siguiente": el paso termina solo (o desde el panel). */
  noNext?: boolean;
  /** Otras flechitas, en cada elemento del panel, con qué es o qué se hace ahí. */
  marks?: { sel: string; text: string }[];
};

const STEPS: Step[] = [
  {
    id: "welcome",
    kicker: "LifeBucket",
    title: "¿Sentís que se te va la vida y todo es trabajo y dormir?",
    lines: [
      "¿Te gustaría ver cómo va tu vida…",
      "…y cómo va a ser si seguís por el camino que vas?",
      "Creé LifeBucket para mí y para vos.",
      "Sin volvernos obsesivos: día a día y sin estresarnos, saber qué estamos haciendo para ser más felices.",
    ],
  },
  {
    id: "rutina",
    kicker: "Bloque 1 · Tu rutina semanal",
    title: "Primero, vamos a configurar tu rutina semanal",
    lines: ["Es importante que completes todos los espacios, incluyendo tus tiempos libres o lo que dedicás a tareas cotidianas.", "Así vas a ver de verdad en qué se te va la semana."],
  },
  { id: "sueno", target: "semana", phone: "semana", kicker: "Bloque 1 · Rutina · 1 de 4", title: "¿En qué horario te acostás y te levantás?", action: "sleep", noNext: true },
  {
    id: "trabajo",
    target: "semana",
    phone: "semana",
    kicker: "Bloque 1 · Rutina · 2 de 4",
    title: "¿En qué horario tenés tu trabajo principal?",
    body: "Elegí los días y el horario, y ponele el nombre (por ejemplo, el de tu empresa).",
    note: "Si tenés más de un horario, sumá otro.",
    action: "work",
    noNext: true,
  },
  { id: "emprendimiento", target: "semana", phone: "semana", kicker: "Bloque 1 · Rutina · 3 de 4", title: "¿Tenés un emprendimiento?", body: "Si le dedicás horas a un proyecto propio, ponele su nombre y su horario, desde y hasta.", action: "business", noNext: true },
  {
    id: "resto",
    target: "semana",
    phone: "semana",
    kicker: "Bloque 1 · Rutina · 4 de 4",
    title: "Agregá tus espacios libres",
    body: "Todo lo que repetís y no es trabajar, dormir ni emprender. Mirá el ejemplo: arrastrando sumamos el ALMUERZO de 13 a 14, encima de tu trabajo. Se puede superponer: el trabajo se corta solo.",
    note: "Para sumar más, arrastrá sobre los espacios en blanco del calendario. Intentá completar todo; si no, lo dejás para después: cada semana te vamos a preguntar.",
    skip: "Saltear por ahora",
  },
  {
    id: "texto",
    target: "semana",
    phone: "semana",
    kicker: "Bloque 1 · Antes de seguir",
    title: "¿Te olvidaste algo o hiciste algo fuera de tu rutina? Escribilo acá",
    body: "Si te olvidás de algún evento de tu rutina, o querés sumar algo que hiciste fuera de ella, escribilo en este campo: se interpreta solo y queda marcado en tu calendario. Mirá, te muestro un ejemplo:",
    note: "Lo que sumes así cuenta en tus resultados de la semana y del mes.",
    spot: "#logro-text",
    spotLabel: "Se escribe como lo contarías: lo entiende solo",
  },
  {
    id: "noneg",
    target: "diarios",
    phone: "objetivos",
    kicker: "Bloque 2 · No negociables",
    title: "Escribí tus no negociables: los hábitos que te cuesta sostener (mínimo 3)",
    body: "Esos hábitos con los que luchás día a día, que te cuesta respetar. Sumá al menos 3 (podés llegar a 5).",
    spot: 'input[aria-label^="No negociable"]:focus, input[aria-label^="No negociable"]:placeholder-shown, button[aria-label="Editar los no negociables de este mes"]',
    spotLabel: "Escribí uno y tocá Enter (o Tab) para el siguiente",
    grow: 2.4,
    noNext: true,
    tips: [
      "Escribí uno y tocá Enter para pasar al siguiente.",
      "Cada mes podés cambiarlos con el lápiz: los meses anteriores quedan como estaban.",
      "El gráfico muestra cómo te fue: la semana día por día y el año mes a mes.",
    ],
  },
  {
    id: "hoy",
    target: "diarios",
    phone: "objetivos",
    kicker: "Bloque 2 · No negociables",
    title: "Tildá los que ya cumpliste hoy",
    body: "Tildalos en la grilla: así arrancás tu racha desde el primer día.",
    spot: "[data-today]",
    spotLabel: "Tocá cada casilla (o arrastrá)",
    skip: "Saltear: arranco mañana",
    grow: 2.4,
    tips: ["Podés arrastrar para tildar varios de una.", "Cada día se pinta según cuánto cumpliste: rojo, amarillo, verde.", "Abajo ves el total del mes."],
  },
  {
    id: "metas",
    target: "metas",
    phone: "logros",
    kicker: "Bloque 3 · Metas anuales importantes",
    title: "Sumá las metas importantes de tu año: 2 o 3 por mes (empezar a entrenar, mudarte…)",
    body: "Te recomendamos metas a largo plazo, 2 o 3 importantes por mes. Por ejemplo: «Quiero empezar a entrenar», «Quiero mudarme», «Quiero trabajar la relación con mi papá».",
    note: "¡Ojo! Estas metas te van a decir cuántas veces las postergaste: es un incentivo para no dejarlas pasar y trabajarlas.",
    spot: 'input[aria-label^="Nueva meta para"], button[aria-label^="Sumar una meta a"]',
    spotLabel: "Escribí una meta y tocá Enter",
    noNext: true,
    marks: [{ sel: 'button[aria-label="Ampliar metas"]', text: "En grande: el año y cuántas veces postergaste" }],
    tips: [
      "Tocá el cuadradito cuando la cumplas.",
      "Si no llegás, pasala al mes que viene con la flecha → o arrastrándola: queda registrado cuántas veces la postergaste.",
      "Con el calendario de arriba la ves en grande: todo el año y tus estadísticas.",
    ],
  },
  {
    id: "recordatorios",
    target: "list:pendientes",
    phone: "objetivos",
    kicker: "Bloque 4 · Recordatorios",
    title: "Recordatorios: cumpleaños, pagos, turnos, el súper… con aviso",
    body: "Cositas con aviso: cumpleaños, ir al súper, comprar un regalo, sacar a pasear al perro… No entran en tu rutina, pero pueden repetirse.",
    note: "¿Querés sumar algunos ahora? Escribilo como lo dirías: «cumple de mamá el 3 de mayo», «pagar el alquiler el 1 de cada mes».",
    spot: 'input[aria-label="Nuevo recordatorio"]',
    spotLabel: "Ahora probá agregar uno vos",
    marks: [{ sel: 'button[aria-label="Ampliar recordatorios"]', text: "Calendario, feriados y tipos" }],
    skip: "Saltear por ahora",
    grow: 3,
    tips: [
      "Reconoce solo la fecha y la hora («el viernes a las 18»), el tipo (cumpleaños, pagos, salud, trámites…) y si se repite.",
      "Antes de agregarlo podés cambiar todo: tipo, importancia, fecha, hora, cada cuánto se repite y cuándo avisarte.",
      "Con el calendario de arriba lo ves en grande, con feriados y fechas especiales, y ahí configurás los tipos.",
    ],
  },
  {
    id: "balde-que",
    target: "bucket",
    phone: "tablero",
    kicker: "Tu LifeBucket · 1 de 3",
    title: "Este es tu LifeBucket: así se reparte tu semana",
    marks: [
      { sel: '[data-tour="balde-base"]', text: "La base de tu vida: sueño, trabajo y tareas cotidianas" },
      { sel: '[data-tour="balde-vos"]', text: "Lo que es para vos: deporte, mente, hobbies, aprender y los tuyos" },
    ],
  },
  {
    id: "balde-ajustar",
    target: "bucket",
    phone: "tablero",
    kicker: "Tu LifeBucket · 2 de 3",
    title: "Tocá estos botones para editar",
    marks: [
      { sel: '[data-tour="ajustar-vos"]', text: "Tus horas objetivo de cada cosa para vos" },
      { sel: '[data-tour="ajustar-base"]', text: "Tu sueño, tu trabajo y tus tareas cotidianas" },
    ],
  },
  { id: "balde", target: "bucket", phone: "tablero", kicker: "Tu LifeBucket · 3 de 3", title: "Hermoso, tu LifeBucket ya está listo", skip: "Saltear", body: "Así se reparte tu semana entre la base (sueño, trabajo y tareas cotidianas) y el tiempo para vos.",
    tips: ["«Ajustar» en «Para vos» cambia las horas objetivo de cada cosa.", "«Ajustar» en «La base» abre tu sueño, tu trabajo y tus tareas cotidianas.", "Arriba elegís ver la semana o el mes entero."],
  },
  { id: "tour", kicker: "Para terminar", title: "Ya terminamos. Unos atajos que te van a servir" },
];

const EXAMPLE_TEXT = "mañana salgo a caminar de 19 a 20 hs";
const NO_CHECKS: string[] = [];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Un ejemplo por categoría para lo que falta en tu balde (se ajusta antes de sumarlo). */
const EXAMPLE: Record<string, { name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number }> = {
  cuerpo: { name: "Gimnasio", quadrant: "cuerpo", days: [2, 4], start: 1140, minutes: 60 },
  interior: { name: "Meditar", quadrant: "interior", days: [1, 3, 5], start: 420, minutes: 30 },
  alma: { name: "Hobby", quadrant: "alma", days: [6], start: 600, minutes: 120 },
  mente: { name: "Curso", quadrant: "mente", days: [3], start: 1140, minutes: 60 },
  vinculos: { name: "Salida con amigos", quadrant: "vinculos", days: [5], start: 1260, minutes: 120 },
};
/** Lo que se abre en el editor en cada paso: con la misma pregunta, para que se entienda qué cargar. */
const WORK = {
  name: "",
  quadrant: "trabajo" as QuadrantId,
  days: [1, 2, 3, 4, 5],
  start: 540,
  minutes: 480,
  lock: true,
  kicker: "Bloque 1 · Rutina · 2 de 4",
  title: "¿En qué horario tenés tu trabajo principal?",
  subtitle: "1. Ponele un nombre · 2. Elegí los días · 3. Elegí desde y hasta. Mientras lo armás, se dibuja en el calendario.",
  placeholder: "Nombre de tu trabajo (ej.: el de tu empresa)",
};
const BUSINESS = {
  name: "",
  quadrant: "trabajo" as QuadrantId,
  days: [1, 2, 3, 4, 5],
  start: 17 * 60,
  minutes: 120,
  lock: true,
  kicker: "Bloque 1 · Rutina · 3 de 4",
  title: "¿Cuándo le dedicás a tu emprendimiento?",
  subtitle: "Ponele su nombre, los días y el horario (desde y hasta).",
  placeholder: "¿Cómo se llama tu emprendimiento?",
};
const LABEL: Record<string, string> = { cuerpo: "Deporte", interior: "Mente y Espíritu", alma: "Hobbies", mente: "Intelecto y Cognitivo", vinculos: "Vínculos" };

const TOUR: { icon: typeof ListPlus; title: string; text: string }[] = [
  { icon: ListPlus, title: "Mis listas", text: "Arriba a la izquierda: súper, notas, ¿dónde está? y tus recordatorios. Cada una se muestra u oculta con el ojito." },
  { icon: GripVertical, title: "Paneles a tu manera", text: "Arrastrá cada panel desde su título para moverlo; estiralo desde el borde, comprimilo con ⌃ u ocultalo con el ojito." },
  { icon: Sparkles, title: "Colores", text: "El botón de los puntitos cambia la paleta de la app: pastel, intensa o neutra." },
  { icon: Music, title: "Música y sonidos", text: "Prendé o apagá la música zen y los sonidos cuando quieras." },
  { icon: Undo2, title: "Deshacer", text: "Si te equivocaste, la flechita vuelve atrás el último cambio." },
  { icon: Eye, title: "Recomendaciones", text: "La campanita junta avisos y consejos para que tu balde esté parejo." },
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
  onAddBlock: (d: { name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number; lock?: boolean; title?: string; placeholder?: string; kicker?: string; subtitle?: string }) => void;
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
  const setSetupDone = usePlanner((s) => s.setSetupDone);

  const routine = usePlanner((s) => s.routine);
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const tasks = usePlanner((s) => s.tasks);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const sleep = usePlanner((s) => s.sleep);
  const logros = usePlanner((s) => s.logros);
  const pendingId = usePlanner((s) => s.lists.find((l) => l.type === "pendientes")?.id ?? "pendientes");
  const [noBusiness, setNoBusiness] = useState(false);
  const work = routine.filter((b) => b.quadrant === "trabajo");
  // El emprendimiento: lo que se sume como trabajo después del trabajo principal.
  const workAtBusiness = useRef<number | null>(null);
  if (step.id === "emprendimiento" && workAtBusiness.current === null) workAtBusiness.current = work.length;
  const hasWork = work.length > 0;
  const hasBusiness = workAtBusiness.current !== null && work.length > workAtBusiness.current;
  const todayKey = toKey(new Date());
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, todayKey.slice(0, 7));
  const todayChecksRaw = usePlanner((s) => s.dailyChecks[todayKey]);
  const todayChecks = todayChecksRaw ?? NO_CHECKS;
  const openGoals = tasks.filter((t) => t.month >= todayKey.slice(0, 7) && !t.done).length;
  const goalsAtStep = useRef<number | null>(null);
  if (step.id === "metas" && goalsAtStep.current === null) goalsAtStep.current = openGoals;
  const goalsRef = useRef(0);
  goalsRef.current = goals.length;
  const empty = sleepSet ? emptyMinutes(routine, sleep) : 0;
  const missing: string | null = (() => {
    switch (step.id) {
      case "sueno":
        return sleepSet ? null : "Configurá a qué hora te acostás y te levantás.";
      case "trabajo":
        return hasWork ? null : "Sumá el horario de tu trabajo principal.";
      case "emprendimiento":
        return hasBusiness || noBusiness ? null : "Configuralo, o elegí «Más adelante» o «No emprendo».";
      case "noneg":
        return goals.length >= 3 ? null : `Sumá al menos 3 no negociables (${goals.length} de 3).`;
      case "metas":
        return tasks.some((t) => t.month >= todayKey.slice(0, 7) && !t.done) ? null : "Sumá al menos una meta en el panel.";
      default:
        return null;
    }
  })();
  const bubble = useRef<HTMLDivElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setEditorOpen(!!document.querySelector("[data-guided-editor], #sleep-dialog-title")), 250);
    return () => window.clearInterval(t);
  }, []);

  // La bienvenida suena con la intro (si el navegador todavía no deja, en el primer toque).
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

  const target = step.target === "list:pendientes" ? `list:${pendingId}` : step.target;
  // El panel de cada paso, siempre abierto (si estaba comprimido u oculto).
  useEffect(() => {
    if (target) window.dispatchEvent(new CustomEvent("lb:module-expand", { detail: { id: target, grow: step.grow } }));
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  // Dónde está lo que se destaca (se sigue si cambia de tamaño).
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const find = () => {
      const el = phone ? document.querySelector("main#contenido") : document.querySelector(`[data-module="${target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    find();
    const t = window.setInterval(find, 400);
    window.addEventListener("resize", find);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", find);
    };
  }, [i, phone, target]);

  // Lo que se abre solo al llegar a cada paso.
  const autoOpened = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (autoOpened.current.has(step.id)) return;
    autoOpened.current.add(step.id);
    let t: number | undefined;
    if (step.id === "sueno" && !sleepSet) t = window.setTimeout(onSleep, 500);
    if (step.id === "trabajo" && !hasWork) t = window.setTimeout(() => onAddBlock(WORK), 500);
    if (step.id === "resto" && !usePlanner.getState().routine.some((b) => /almuerzo/i.test(b.name))) t = window.setTimeout(runDemo, 1600);
    if (step.id === "noneg") t = window.setTimeout(() => document.querySelector<HTMLInputElement>('input[aria-label^="No negociable"]:placeholder-shown')?.focus(), 600);
    return () => window.clearTimeout(t);
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [demo, setDemo] = useState<{ x: number; y: number; press: boolean; sel?: { left: number; top: number; width: number; height: number }; hint?: { x: number; y: number } } | null>(null);
  // Después del ejemplo: ¿te sirve el almuerzo a esa hora, o lo borramos?
  const lunchAdded = useRef(false);
  const [lunchAsk, setLunchAsk] = useState<"no" | "ask" | "kept" | "removed">("no");
  const removeLunch = () => {
    const st = usePlanner.getState();
    st.setRoutine(st.routine.filter((b) => !(b.name === "Almuerzo" && b.start === 12 * 60)), st.routineSeries);
    play("delete");
    setDemo(null);
    setLunchAsk("removed");
  };
  const runDemo = () => {
    const cols = [...document.querySelectorAll<HTMLElement>("[data-module=semana] [data-day-col]")];
    if (cols.length < 5) return;
    const at = (col: HTMLElement, m: number) => {
      const r = col.getBoundingClientRect();
      return r.top + ((m - 5 * 60) / (24 * 60 - 5 * 60)) * r.height;
    };
    const mon = cols[0].getBoundingClientRect();
    const fri = cols[4].getBoundingClientRect();
    const y13 = at(cols[0], 12 * 60);
    const y14 = at(cols[0], 13 * 60);
    const b = bubble.current?.getBoundingClientRect();
    setDemo({ x: b ? b.right - 40 : mon.left - 60, y: b ? b.bottom - 40 : y13, press: false });
    const steps: [number, () => void][] = [
      [250, () => setDemo((d) => d && { ...d, x: mon.left + 14, y: y13 + 4 })],
      [1250, () => setDemo((d) => d && { ...d, press: true, sel: { left: mon.left + 3, top: y13, width: 6, height: 6 } })],
      [1500, () => setDemo((d) => d && { ...d, x: fri.right - 14, y: y14 - 4, sel: { left: mon.left + 3, top: y13, width: fri.right - mon.left - 6, height: y14 - y13 } })],
      [2700, () => {
        const lunch: RoutineBlock = { id: newId(), quadrant: "libre", name: "Almuerzo", days: [1, 2, 3, 4, 5], start: 12 * 60, minutes: 60 };
        lunchAdded.current = true;
        setLunchAsk("ask");
        usePlanner.getState().setRoutine(carve(usePlanner.getState().routine, lunch), usePlanner.getState().routineSeries);
        play("bubble");
        setDemo({ x: mon.left + 14, y: y13 + 4, press: false, hint: { x: (mon.left + fri.right) / 2, y: y14 + 6 } });
      }],
      [3400, () => setDemo((d) => d && { ...d, x: -100 })],
    ];
    for (const [ms, fn] of steps) window.setTimeout(fn, ms);
  };
  useEffect(() => {
    if (step.id !== "resto") setDemo(null);
  }, [step.id]);
  const routineAtHint = useRef<unknown>(null);
  useEffect(() => {
    if (!demo?.hint) return;
    if (routineAtHint.current === null) routineAtHint.current = routine;
    else if (routineAtHint.current !== routine) setDemo(null);
  }, [routine, demo?.hint]);
  useEffect(() => {
    if (!demo?.hint) return;
    const off = (e: PointerEvent) => (e.target as HTMLElement).closest("[data-module=semana]") && setDemo(null);
    window.addEventListener("pointerdown", off, true);
    return () => window.removeEventListener("pointerdown", off, true);
  }, [demo?.hint]);
  // El ejemplo, despacio: se escribe letra por letra, se "toca Enter" y queda en el calendario; después se
  // pregunta si va a la rutina y qué días.
  const [typed, setTyped] = useState<"no" | "typing" | "enter" | "saved" | "routine">("no");
  const exampleId = useRef<string | null>(null);
  const typeInto = (text: string) => {
    const el = document.querySelector<HTMLTextAreaElement>("#logro-text");
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    el.focus();
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  useEffect(() => {
    if (step.id !== "texto" || typed !== "no") return;
    setTyped("typing");
    let k = 0;
    const timers: number[] = [];
    const tick = () => {
      k++;
      typeInto(EXAMPLE_TEXT.slice(0, k));
      if (k % 3 === 0) play("click");
      if (k < EXAMPLE_TEXT.length) timers.push(window.setTimeout(tick, 70 + Math.random() * 50));
      else {
        // Una pausa para leer lo que se entendió, y "Enter".
        timers.push(window.setTimeout(() => setTyped("enter"), 1600));
        timers.push(
          window.setTimeout(() => {
            const before = usePlanner.getState().logros.length;
            document.querySelector<HTMLButtonElement>('button[aria-label="Guardar en mi diario"]')?.click();
            window.setTimeout(() => {
              const ls = usePlanner.getState().logros;
              exampleId.current = ls.length > before ? ls[ls.length - 1].id : null;
              (document.activeElement as HTMLElement | null)?.blur();
              setTyped("saved");
            }, 150);
          }, 3200),
        );
      }
    };
    timers.push(window.setTimeout(tick, 1000));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [remDemo, setRemDemo] = useState<"no" | "typing" | "shown" | "added">("no");
  // Después del ejemplo, cuando sumás uno vos, el paso termina solo.
  const remCount = usePlanner((s) => s.lists.find((l) => l.type === "pendientes")?.items.length ?? 0);
  const remBase = useRef<number | null>(null);
  useEffect(() => {
    if (step.id !== "recordatorios" || remDemo !== "added") return;
    if (remBase.current === null) {
      // Se toma la cuenta un momento después de que se agregó el ejemplo.
      const t0 = window.setTimeout(() => (remBase.current = usePlanner.getState().lists.find((l) => l.type === "pendientes")?.items.length ?? 0), 300);
      return () => window.clearTimeout(t0);
    }
    if (remCount <= remBase.current) return;
    const t = window.setTimeout(() => nextRef.current(), 1600);
    return () => window.clearTimeout(t);
  }, [step.id, remDemo, remCount]);
  useEffect(() => {
    if (step.id !== "recordatorios" || remDemo !== "no") return;
    setRemDemo("typing");
    const text = "cumple de mamá el 3 de mayo";
    const timers: number[] = [];
    const put = (v: string) => {
      const el = document.querySelector<HTMLInputElement>('input[aria-label="Nuevo recordatorio"]');
      if (!el) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    let k = 0;
    const tick = () => {
      k++;
      put(text.slice(0, k));
      if (k % 3 === 0) play("click");
      if (k < text.length) timers.push(window.setTimeout(tick, 75 + Math.random() * 45));
      else {
        timers.push(window.setTimeout(() => setRemDemo("shown"), 500));
        timers.push(
          window.setTimeout(() => {
            const form = document.querySelector<HTMLInputElement>('input[aria-label="Nuevo recordatorio"]')?.form;
            form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
            setRemDemo("added");
          }, 4500),
        );
      }
    };
    timers.push(window.setTimeout(tick, 1400));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [routineDays, setRoutineDays] = useState<number[] | null>(null);
  useEffect(() => {
    const l = usePlanner.getState().logros.find((x) => x.id === exampleId.current);
    const items = routineDays && l ? [{ text: l.text, category: l.category, minutes: l.minutes || 60, date: l.date, start: l.start, repeat: routineDays }] : [];
    window.dispatchEvent(new CustomEvent("lb:diary-preview", { detail: items }));
  }, [routineDays]);
  /** Pasar el ejemplo a la rutina: deja de ser algo de una vez y queda fijo esos días. */
  const exampleToRoutine = (days: number[]) => {
    const st = usePlanner.getState();
    const l = st.logros.find((x) => x.id === exampleId.current);
    if (l) {
      const block: RoutineBlock = { id: newId(), quadrant: (l.category ?? "cuerpo") as QuadrantId, name: l.text, days, start: l.start ?? 19 * 60, minutes: l.minutes || 60 };
      st.setRoutine(carve(st.routine, block), st.routineSeries);
      st.removeLogro(l.id);
      play("complete");
    }
    setRoutineDays(null);
    setTyped("routine");
  };

  // Qué se señala en cada momento del paso.
  const addedGoals = step.id === "metas" ? openGoals - (goalsAtStep.current ?? openGoals) : 0;
  const markDefs: { sel: string; text: string; main: boolean }[] = (() => {
    if (step.id === "noneg") {
      // Con la lista abierta: el campo que estás escribiendo (o el próximo vacío). Cerrada: el lápiz.
      const open = typeof document !== "undefined" && !!document.querySelector('input[aria-label^="No negociable"]');
      if (!open) return [{ sel: 'button[aria-label="Editar los no negociables de este mes"]', text: "Modificá o agregá no negociables", main: true }];
      if (goals.length >= 3) return [{ sel: '[data-tour="noneg-listo"]', text: goals.length < 5 ? "¡Bien! Sumá hasta 5 o tocá «Listo» para terminar" : "¡Listo! Tocá «Listo» para terminar", main: true }];
      return [{ sel: 'input[aria-label^="No negociable"]:focus, input[aria-label^="No negociable"]:placeholder-shown', text: "Escribí uno y tocá Enter (o Tab) para el siguiente", main: true }];
    }
    if (step.id === "metas" && addedGoals === 1) return [{ sel: step.spot!, text: "¡Bien! Sumá una más", main: true }];
    if (step.id === "recordatorios") {
      if (remDemo === "typing" || remDemo === "no") return [{ sel: 'input[aria-label="Nuevo recordatorio"]', text: "Mirá: lo escribo como lo diría", main: true }];
      if (remDemo === "shown")
        return [
          { sel: 'select[aria-label="Tipo"]', text: "Lo reconoció solo: Cumpleaños", main: false },
          { sel: 'input[aria-label="Fecha límite"]', text: "Fecha: 3 de mayo, se repite cada año", main: false },
          { sel: 'select[aria-label="Avisar"]', text: "Y acá elegís cuándo te avisa", main: false },
        ];
    }
    return [...(step.spot && step.spotLabel ? [{ sel: step.spot, text: step.spotLabel, main: true }] : []), ...(step.marks ?? []).map((m) => ({ ...m, main: false }))];
  })();
  const markKey = JSON.stringify(markDefs);
  // Las flechitas: dónde está cada cosa (la principal, en amarillo; las demás, oscuras). Se siguen si se mueven.
  type Mark = { rect: DOMRect; text: string; main: boolean };
  const [marks, setMarks] = useState<Mark[]>([]);
  useEffect(() => {
    const list = markDefs;
    if (!list.length) {
      setMarks([]);
      return;
    }
    let scrolled = false;
    const find = () => {
      const box = target ? document.querySelector(`[data-module="${target}"]`)?.getBoundingClientRect() : null;
      const found: Mark[] = [];
      for (const m of list) {
        const el = document.querySelector(m.sel);
        if (el && m.main && !scrolled) {
          el.scrollIntoView({ block: "center", inline: "nearest" });
          scrolled = true;
        }
        const r = el?.getBoundingClientRect();
        const inside = !box || (r && r.top >= box.top - 4 && r.bottom <= box.bottom + 4);
        if (r && r.width > 0 && inside) found.push({ rect: r, text: m.text, main: m.main });
      }
      setMarks(found);
    };
    find();
    const t = window.setInterval(find, 300);
    return () => window.clearInterval(t);
  }, [step.id, target, markKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step.id !== "hoy" || !goals.length || !goals.every((g) => todayChecks.includes(g.id))) return;
    const t = window.setTimeout(() => nextRef.current(), 1600);
    return () => window.clearTimeout(t);
  }, [step.id, todayChecks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step.id !== "metas" || openGoals - (goalsAtStep.current ?? 0) < 2) return;
    const t = window.setTimeout(() => nextRef.current(), 1600);
    return () => window.clearTimeout(t);
  }, [step.id, openGoals]);
  // Sueño, trabajo y emprendimiento siguen solos al completarse (con una pausa para que se entienda).
  const AUTO = ["sueno", "trabajo", "emprendimiento"];
  const advanced = useRef<string | null>(null);
  useEffect(() => {
    if (!AUTO.includes(step.id) || missing || advanced.current === step.id || noBusiness) return;
    advanced.current = step.id;
    const t = window.setTimeout(() => nextRef.current(), 1500);
    return () => window.clearTimeout(t);
  }, [step.id, missing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const done = () => {
      if (STEPS[iRef.current]?.id === "noneg" && goalsRef.current >= 3) nextRef.current();
    };
    window.addEventListener("lb:noneg-listo", done);
    return () => window.removeEventListener("lb:noneg-listo", done);
  }, []);

  const next = () => {
    if (step.id === "texto" && routineDays?.length) exampleToRoutine(routineDays);
    if (step.id === "noneg") {
      (document.activeElement as HTMLElement | null)?.blur();
      window.setTimeout(() => window.dispatchEvent(new Event("lb:noneg-done")), 0);
    }
    if (step.id === "tour") {
      setSetupDone(true);
      cheer("welcome");
      onDone();
      return;
    }
    if (step.id !== "welcome") play("complete");
    else if (!isZenPlaying()) void startZen().then(() => setZen(isZenPlaying()));
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      setI((n) => n + 1);
    }, step.target ? 420 : 200);
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  // El análisis del balde: lo que falta para vos esta semana.
  const week = weekMinutes(routine, logros, sleep);
  const lacking = ACTIVE_PARTS.filter((p) => week[p] === 0);

  const pad = 8;
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const center = !target || !hole;
  // El resto de la pantalla: bien oscuro y borroso, para que solo se vea el panel con el que trabajamos.
  const shade = "pointer-events-auto absolute bg-[color-mix(in_oklab,var(--color-ink)_72%,transparent)] backdrop-blur-[3px]";
  const dots = (
    <span className="flex gap-1" aria-hidden>
      {STEPS.slice(1).map((st, k) => (
        <span key={st.id} className={cn("h-1.5 rounded-full transition-all duration-300", k + 1 === i ? "w-4 bg-ink" : k + 1 < i ? "w-1.5 bg-ink/50" : "w-1.5 bg-ink/15")} />
      ))}
    </span>
  );
  const barPlace = (): React.CSSProperties => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(560, vw - 24);
    const h = bubble.current?.offsetHeight ?? 120;
    if (!hole || phone) return { top: 12, left: (vw - w) / 2, width: w };
    const left = Math.min(Math.max(12, hole.left), vw - w - 12);
    if (hole.top - h - 14 >= 8) return { top: hole.top - h - 14, left, width: w };
    if (hole.top + hole.height + h + 14 <= vh - 8) return { top: hole.top + hole.height + 14, left, width: w };
    // Al costado, centrada en lo alto (del lado con más lugar).
    const spaceL = hole.left - 24;
    const spaceR = vw - (hole.left + hole.width) - 24;
    const sw = Math.min(420, Math.max(spaceL, spaceR));
    if (sw >= 280) {
      const top = Math.min(Math.max(12, hole.top + hole.height / 2 - h / 2), vh - h - 12);
      return spaceL >= spaceR ? { top, left: hole.left - sw - 12, width: sw } : { top, left: hole.left + hole.width + 12, width: sw };
    }
    return { top: 12, left: (vw - w) / 2, width: w };
  };
  const nextLabel = step.id === "welcome" ? "Empezar" : step.id === "rutina" ? "Vamos" : step.id === "tour" ? "Ir a mi LifeBucket" : "Siguiente";
  const missingNote = missing && (
    <p role="status" className="flex items-center gap-2 rounded-xl bg-[color-mix(in_oklab,#d99a00_12%,transparent)] px-3 py-1.5 text-[12.5px] leading-snug text-[#8a6200]">
      <span aria-hidden>👉</span>
      {missing}
    </p>
  );
  // Las etiquetas con flechita, al costado de cada elemento (del lado donde haya lugar).
  const label = (m: Mark, k: number) => {
    const vw = window.innerWidth;
    const right = m.rect.left < 250 || (m.rect.right + 250 < vw && m.rect.left < vw / 2);
    const y = m.rect.top + m.rect.height / 2;
    return (
      <div key={k} aria-hidden className="pointer-events-none fixed z-[6]" style={{ top: m.rect.top - 4, left: m.rect.left - 4, width: m.rect.width + 8, height: m.rect.height + 8 }}>
        <span className={cn("absolute inset-0 rounded-xl ring-[3px]", m.main ? "animate-pulse ring-[#d99a00]" : "ring-white/80")} />
        <span
          className={cn(
            "fixed flex max-w-[230px] -translate-y-1/2 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] leading-snug font-semibold shadow-[var(--shadow-popover)]",
            m.main ? "bg-[#d99a00] text-white" : "bg-ink text-surface",
            right ? "animate-[nudge-l_0.9s_ease-in-out_infinite]" : "animate-[nudge-r_0.9s_ease-in-out_infinite] flex-row-reverse text-right",
          )}
          style={right ? { top: y, left: m.rect.right + 12 } : { top: y, right: vw - m.rect.left + 12 }}
        >
          <span className="text-[16px] leading-none">{right ? "←" : "→"}</span>
          {m.text}
        </span>
      </div>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      {step.id === "welcome" ? (
        // La bienvenida, a pantalla completa: todavía no se ve la app.
        <div className="pointer-events-auto absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#fdf6e3_0%,#f3eefc_45%,#e8eef9_100%)]" />
      ) : center ? (
        <div className={cn(shade, "inset-0")} />
      ) : (
        <>
          <div className={cn(shade, "inset-x-0 top-0")} style={{ height: Math.max(0, hole.top) }} />
          <div className={cn(shade, "inset-x-0 bottom-0")} style={{ top: hole.top + hole.height }} />
          <div className={cn(shade, "left-0")} style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left) }} />
          <div className={cn(shade, "right-0")} style={{ top: hole.top, height: hole.height, left: hole.left + hole.width }} />
          <div aria-hidden className="pointer-events-none absolute rounded-[22px] ring-[3px] ring-white shadow-[0_0_0_6px_rgba(255,255,255,0.18)] transition-all duration-300" style={hole} />
        </>
      )}

      {demo && (
        <>
          {demo.sel && <div aria-hidden className="pointer-events-none fixed z-[6] rounded-[5px] border-2 border-dashed border-ink/60 bg-ink/10 transition-all duration-[1100ms] ease-out" style={demo.sel} />}
          <div aria-hidden className="pointer-events-none fixed z-[7] transition-[left,top] duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]" style={{ left: demo.x, top: demo.y }}>
            <svg width="26" height="26" viewBox="0 0 24 24" className={cn("drop-shadow-md transition-transform duration-150", demo.press && "scale-90")}>
              <path d="M4 2l15 9-6.5 1.6L9.6 19z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          {demo.hint && (
            <div className="animate-fade-up pointer-events-none fixed z-[7] -translate-x-1/2" style={{ left: demo.hint.x, top: demo.hint.y }}>
              <span className="mx-auto block w-fit animate-bounce text-center text-[20px] leading-none text-[#d99a00]">↑</span>
              <span className="block rounded-xl bg-[#d99a00] px-3 py-1.5 text-center text-[12.5px] leading-snug font-semibold text-white shadow-[var(--shadow-popover)]">
                Almuerzo de 12 a 13, en el medio de tu trabajo.
                <br />
                Podés moverlo o estirarlo.
              </span>
            </div>
          )}
        </>
      )}
      {!editorOpen && !center && marks.map(label)}

      {center ? (
        // Bienvenida, intro y cierre: una tarjeta al centro.
        <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
          <div ref={bubble} key={step.id} role="dialog" aria-labelledby="setup-title" className="pointer-events-auto animate-fade-up relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-[540px] flex-col gap-3 overflow-y-auto rounded-3xl bg-surface p-7 shadow-[var(--shadow-popover)] sm:p-8">
            {step.id === "welcome" ? (
              <span className="animate-fade-up mb-1 flex items-center gap-2">
                <BrandMark size={34} />
                <span className="text-[15px] font-semibold tracking-[0.18em]">LIFEBUCKET</span>
              </span>
            ) : (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">
                <Sparkles aria-hidden className="size-3.5" />
                {step.kicker}
              </p>
            )}
            <h2 id="setup-title" className="text-[26px] leading-tight font-semibold tracking-tight">
              {step.title}
            </h2>
            {step.lines ? (
              <div className="flex flex-col gap-2.5">
                {step.lines.map((l, k) => (
                  <p key={k} style={{ animationDelay: `${200 + k * 450}ms` }} className={cn("animate-fade-up text-[17px] leading-snug text-ink/85", k === step.lines!.length - 1 && step.id === "welcome" && "font-medium text-ink")}>
                    {l}
                  </p>
                ))}
              </div>
            ) : (
              step.body && <p className="text-[15.5px] leading-relaxed text-ink/80">{step.body}</p>
            )}
            {step.id === "tour" && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {TOUR.map((x) => (
                  <li key={x.title} className="flex gap-2.5 rounded-2xl bg-surface-sunken/70 p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm">
                      <x.icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <b className="block text-[13px] font-semibold">{x.title}</b>
                      <span className="text-[12px] leading-snug text-ink-muted">{x.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
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
                dots
              )}
              <button type="button" onClick={next} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-6 text-[14px] font-semibold text-surface hover:bg-ink/90">
                {nextLabel}
                <ArrowRight aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        // En los módulos: una barra chica arriba con el paso, qué hacer y los botones. Lo demás lo dicen las flechitas.
        <div
          ref={bubble}
          key={step.id}
          role="dialog"
          aria-labelledby="setup-title"
          style={barPlace()}
          className={cn(
            "pointer-events-auto animate-fade-up fixed z-10 flex max-h-[46dvh] flex-col gap-2 overflow-y-auto rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-popover)] transition-[top,left] duration-300",
            (editorOpen || (AUTO.includes(step.id) && !missing)) && "hidden",
            leaving && "opacity-0 transition-opacity duration-300",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
              <Sparkles aria-hidden className="size-3.5" />
              {step.kicker}
            </p>
            {dots}
          </div>
          <div className="flex items-start gap-3">
            <h2 id="setup-title" className="min-w-0 flex-1 text-[15.5px] leading-snug font-semibold">
              {step.title}
            </h2>
            <span className="flex shrink-0 items-center gap-1.5">
              {step.skip && (
                <button type="button" onClick={next} className="pressable h-9 rounded-full px-3.5 text-[12.5px] font-semibold text-ink-muted ring-1 ring-line hover:bg-surface-sunken hover:text-ink">
                  Saltear
                </button>
              )}
              {!step.noNext && (
                <button
                  type="button"
                  onClick={next}
                  disabled={!!missing}
                  title={missing ?? undefined}
                  className="pressable inline-flex h-9 items-center gap-1 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {nextLabel}
                  <ArrowRight aria-hidden className="size-3.5" />
                </button>
              )}
            </span>
          </div>
          {step.action && (
            <div className="flex flex-col gap-2">
              {(() => {
                const cfg =
                  step.action === "sleep"
                    ? { icon: Moon, label: sleepSet ? "Cambiar mi horario de sueño" : "Abrir el horario de sueño", done: sleepSet, onClick: onSleep }
                    : step.action === "work"
                      ? { icon: Briefcase, label: hasWork ? "Sumar otro horario de trabajo" : "Cargar mi trabajo", done: hasWork, onClick: () => onAddBlock(WORK) }
                      : { icon: Rocket, label: hasBusiness ? "Sumar otro horario" : "Cargar mi emprendimiento", done: hasBusiness, onClick: () => onAddBlock(BUSINESS) };
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
                      className={cn(
                        "pressable h-11 rounded-2xl border px-3 text-[13px] font-semibold",
                        l === "No emprendo" ? "border-danger/40 text-danger hover:bg-danger/10" : "border-line text-ink-muted hover:bg-surface-sunken hover:text-ink",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step.id === "resto" && lunchAsk === "no" && (
            <p className="flex gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-[13.5px] leading-snug">
              <span aria-hidden>💡</span>
              <span>
                Por ejemplo, <b className="font-semibold">voy a agregar el almuerzo de 12 a 13</b>, en el medio de tu trabajo. Mirá…
              </span>
            </p>
          )}
          {step.id === "resto" && lunchAsk === "ask" && (
            <div className="flex flex-col gap-2 rounded-xl border border-ink/15 p-3">
              <p className="text-[13.5px] font-semibold">¿Te sirve el almuerzo de 12 a 13?</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setLunchAsk("kept")} className="pressable h-9 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-surface">
                  Sí, dejalo
                </button>
                <button type="button" onClick={removeLunch} className="pressable h-9 rounded-full px-4 text-[12.5px] font-semibold text-danger ring-1 ring-danger/40 hover:bg-danger/10">
                  No, borralo
                </button>
              </div>
              <p className="text-[11.5px] text-ink-muted">Si es otro horario, arrastralo o estiralo en el calendario.</p>
            </div>
          )}
          {step.id === "resto" && (lunchAsk === "kept" || lunchAsk === "removed") && (
            <p className="flex gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-[13px] leading-snug">
              <span aria-hidden>👉</span>
              <span>Ahora sumá lo demás que hacés: arrastrá con el mouse sobre los espacios en blanco del calendario (desde la hora que empieza hasta la que termina) y ponele nombre.</span>
            </p>
          )}
          {step.id === "resto" && sleepSet && (
            <p className={cn("rounded-xl px-3 py-2 text-[12.5px] leading-snug", empty ? "bg-[color-mix(in_oklab,#d99a00_12%,transparent)] text-[#8a6200]" : "bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)] text-[color-mix(in_oklab,var(--color-success)_75%,var(--color-ink))]")}>
              {empty ? `Te quedan ${Math.round(empty / 60)} h sin asignar en la semana.` : "✓ ¡Semana completa! Cada hora tiene su lugar."}
            </p>
          )}
          {step.id === "texto" && typed === "enter" && (
            <p className="flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-[12.5px] font-medium">
              <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold shadow-sm">Enter ⏎</kbd>
              Y se agrega a tu calendario…
            </p>
          )}
          {step.id === "texto" && typed === "saved" && (
            <div className="flex flex-col gap-2 rounded-xl border border-ink/15 p-3">
              <p className="text-[12.5px] text-[color-mix(in_oklab,var(--color-success)_75%,var(--color-ink))]">✓ Quedó mañana de 19 a 20 en tu calendario.</p>
              <p className="text-[13px] font-semibold">¿Es algo de una vez o parte de tu rutina?</p>
              <div role="radiogroup" aria-label="Tipo de evento" className="grid grid-cols-2 gap-1.5">
                <button type="button" role="radio" aria-checked={!routineDays} onClick={() => setRoutineDays(null)} className={cn("pressable h-9 rounded-full text-[12.5px] font-semibold", !routineDays ? "bg-ink text-surface" : "ring-1 ring-line hover:bg-surface-sunken")}>
                  Solo esta vez
                </button>
                <button type="button" role="radio" aria-checked={!!routineDays} onClick={() => setRoutineDays([1, 2, 3, 4, 5, 6, 0])} className={cn("pressable h-9 rounded-full text-[12.5px] font-semibold", routineDays ? "bg-ink text-surface" : "ring-1 ring-line hover:bg-surface-sunken")}>
                  Hacerlo rutina
                </button>
              </div>
              {routineDays && (
                <>
                  <p className="text-[12px] text-ink-muted">En verde, los días que van (lo ves en el calendario). Tocá para sacar los que no. Si algún día es en otro horario, después lo cambiás en el calendario.</p>
                  <div role="group" aria-label="Días de la rutina" className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((dd) => {
                      const on = routineDays.includes(dd);
                      return (
                        <button
                          key={dd}
                          type="button"
                          aria-pressed={on}
                          aria-label={`Rutina: ${DAY_NAMES[dd]}`}
                          onClick={() => setRoutineDays(on ? routineDays.filter((x) => x !== dd) : [...routineDays, dd])}
                          className={cn("pressable grid size-8 place-items-center rounded-full text-[12px] font-semibold", on ? "bg-success text-white" : "bg-surface-sunken text-ink-muted hover:text-ink")}
                        >
                          {"DLMMJVS"[dd]}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {/* El balde: el análisis y lo que falta. */}
          {step.id === "balde" && (
            <div className="flex flex-col gap-1.5">
              {lacking.length ? (
                <>
                  <p className="text-[13px] leading-snug text-ink/85">
                    Veo que no agregaste nada en <b className="font-semibold">{lacking.map((p) => LABEL[p]).join(", ")}</b>. ¿Querés agregar alguno?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {lacking.map((p) => (
                      <button
                        key={p}
                        type="button"
                        style={partStyle(p)}
                        onClick={() => onAddBlock({ ...EXAMPLE[p], kicker: "Tu balde", title: `Sumá algo de ${LABEL[p]} a tu semana`, subtitle: "Ajustá el ejemplo a lo que hacés de verdad: nombre, días y horario." })}
                        className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--q)] bg-[var(--q-soft)] px-3 text-[12.5px] font-semibold"
                      >
                        <QuadrantIcon id={p as QuadrantId} className="size-3.5 text-[var(--q)]" />
                        <Plus aria-hidden className="size-3.5" />
                        {p === "alma" ? "Hobbies" : QUADRANT_BY_ID[p as QuadrantId]?.name ?? LABEL[p]}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-ink/85">¡Tenés un poco de todo lo que te hace bien! Ahora, a sostenerlo.</p>
              )}
            </div>
          )}

          {step.id === "tour" && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {TOUR.map((x) => (
                <li key={x.title} className="flex gap-2.5 rounded-2xl bg-surface-sunken/70 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm">
                    <x.icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[13px] font-semibold">{x.title}</b>
                    <span className="text-[12px] leading-snug text-ink-muted">{x.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {missingNote}
        </div>
      )}
    </div>
  );
}
