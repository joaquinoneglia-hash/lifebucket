"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { play } from "@/lib/sfx";

export type TourStep = {
  /** El elemento a resaltar: `[data-tour="…"]`. Si no está en pantalla, el consejo aparece centrado. */
  target: string;
  title: string;
  body: string;
  /** Otro texto para el celular (sin mouse). */
  touchBody?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const GAP = 14;
const CARD_W = 340;

/**
 * Guía paso a paso: oscurece la pantalla, resalta una parte por vez y muestra un consejo al lado.
 * Se avanza con "Siguiente consejo" (o flechas / Enter) y se sale con "Saltar" (o Escape).
 */
export function Tour({ steps: all, onClose }: { steps: TourStep[]; onClose: () => void }) {
  // Solo los consejos de lo que se ve en esta pantalla (en el celular hay partes ocultas).
  const [steps] = useState(() =>
    all.filter((s) => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
      return !!el && el.getClientRects().length > 0;
    }),
  );
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const narrow = !useMediaQuery("(min-width: 640px)");
  const step = steps[i] ?? all[0];
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    setRect((cur) => (cur && cur.top === next.top && cur.left === next.left && cur.width === next.width && cur.height === next.height ? cur : next));
  }, [step.target]);

  // Al cambiar de paso: llevar la parte a la vista y seguirla todo el tiempo (scroll, cambios de tamaño, animaciones).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: narrow ? "start" : "nearest", behavior: "smooth" });
    let frame = 0;
    const loop = () => {
      measure();
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [step.target, measure, narrow]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, narrow]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [i]);

  const go = (n: number) => {
    if (n < 0) return;
    if (n >= steps.length) {
      play("complete");
      return onClose();
    }
    play("pop");
    setI(n);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
  };

  // Dónde va la tarjeta: abajo, arriba, a la derecha o a la izquierda de la parte; si no entra, en una esquina.
  let pos: React.CSSProperties;
  if (narrow) {
    pos = { left: 16, right: 16, bottom: 16 };
  } else if (!rect) {
    pos = { left: Math.max(16, (vp.w - CARD_W) / 2), top: Math.max(16, (vp.h - cardH) / 2) };
  } else {
    const clampX = (x: number) => Math.min(Math.max(16, x), vp.w - CARD_W - 16);
    const clampY = (y: number) => Math.min(Math.max(16, y), vp.h - cardH - 16);
    const centerX = rect.left + rect.width / 2 - CARD_W / 2;
    // La parte puede estar todavía fuera de la pantalla (scrolleando): la tarjeta siempre queda adentro.
    if (rect.top + rect.height + GAP + cardH <= vp.h - 16) pos = { left: clampX(centerX), top: clampY(rect.top + rect.height + GAP) };
    else if (rect.top - GAP - cardH >= 16) pos = { left: clampX(centerX), top: clampY(rect.top - GAP - cardH) };
    else if (rect.left + rect.width + GAP + CARD_W <= vp.w - 16) pos = { left: rect.left + rect.width + GAP, top: clampY(rect.top) };
    else if (rect.left - GAP - CARD_W >= 16) pos = { left: rect.left - GAP - CARD_W, top: clampY(rect.top) };
    else pos = { right: 32, bottom: 32 };
  }

  return (
    <div className="fixed inset-0 z-[65]" onKeyDown={onKey}>
      {/* Bloquea la app mientras dura la guía. */}
      <div className="absolute inset-0" onClick={() => nextRef.current?.focus()} />

      {/* El foco: un recorte que deja ver la parte de la que se habla. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl ring-2 ring-white/70 transition-[top,left,width,height] duration-300 ease-[var(--ease-out)]"
        style={
          rect
            ? { ...rect, boxShadow: "0 0 0 9999px rgba(22, 24, 34, 0.5)" }
            : { top: vp.h / 2, left: vp.w / 2, width: 0, height: 0, boxShadow: "0 0 0 9999px rgba(22, 24, 34, 0.5)" }
        }
      />

      <div
        ref={cardRef}
        key={i}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="animate-fade-up absolute flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-[var(--shadow-popover)]"
        style={{ ...pos, width: narrow ? undefined : CARD_W }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] font-medium text-ink-faint tabular-nums">
            {i + 1} de {steps.length}
          </span>
          <button type="button" onClick={onClose} className="text-[12.5px] font-medium text-ink-muted hover:text-ink">
            Saltar guía
          </button>
        </div>
        <div>
          <h2 id="tour-title" className="text-[17px] leading-snug font-semibold tracking-[-0.01em]">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
            {narrow && step.touchBody ? step.touchBody : step.body}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex shrink gap-1 overflow-hidden" aria-hidden>
            {steps.map((_, n) => (
              <span key={n} className={cn("h-1.5 rounded-full transition-all duration-300", n === i ? "w-4 bg-ink" : "w-1.5 bg-line")} />
            ))}
          </span>
          <span className="flex items-center gap-1">
            {i > 0 && (
              <button type="button" onClick={() => go(i - 1)} className="pressable h-9 rounded-full px-3 text-[13px] font-medium whitespace-nowrap text-ink-muted hover:bg-surface-sunken hover:text-ink">
                Anterior
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => go(i + 1)}
              className="pressable h-9 rounded-full bg-ink px-4 text-[13px] font-medium whitespace-nowrap text-surface hover:bg-ink/90"
            >
              {last ? "¡A armar mi semana!" : "Siguiente consejo"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Los consejos de la pantalla principal, en orden. */
export const MAIN_TOUR: TourStep[] = [
  {
    target: "shares",
    title: "Tu balde, en porcentajes",
    body: "Cada color es una parte de tu vida: Trabajo, Cuerpo, Mente, Disfrute, Vínculos y Libre. El número es cuánto de tu semana despierta se lleva cada una. Pasá el mouse para ver qué incluye y el detalle.",
    touchBody:
      "Cada color es una parte de tu vida: Trabajo, Cuerpo, Mente, Disfrute, Vínculos y Libre. El número es cuánto de tu semana despierta se lleva cada una. Tocá una para ver qué incluye y el detalle.",
  },
  {
    target: "semana",
    title: "Tu semana tipo",
    body: "De lunes a domingo, de 5 a 24 h y sin fechas: es cómo es una semana normal tuya. Arrastrá sobre un espacio vacío para crear un bloque y elegí qué es y en qué días se repite.",
    touchBody:
      "De lunes a domingo, de 5 a 24 h y sin fechas: es cómo es una semana normal tuya. Tocá un espacio vacío para crear un bloque de una hora, o mantené apretado y arrastrá para marcar el horario.",
  },
  {
    target: "semana",
    title: "Editar bloques",
    body: "Tocá un bloque para cambiarle el horario, los días o la categoría. Agarralo de ⠿ para moverlo, estiralo desde los bordes y, si arrastrás adentro de un bloque, metés otro en el medio (por ejemplo, el almuerzo dentro del trabajo).",
    touchBody:
      "Tocá un bloque para cambiarle el horario, los días o la categoría, o para borrarlo. Mantenelo apretado y arrastralo para moverlo; si lo agarrás desde el borde de arriba o de abajo, lo estirás.",
  },
  {
    target: "sueno-btn",
    title: "Tu sueño",
    body: "Configurá a qué hora te dormís y te levantás, en semana y el finde. Se ve con rayitas en el calendario y queda fuera del balance.",
  },
  {
    target: "sueno",
    title: "¿Dormís lo suficiente?",
    body: "Tus horas por noche contra la meta de 8 h. La franja verde es lo recomendado (entre 7 y 9 h).",
  },
  {
    target: "momentos",
    title: "Momentos del mes",
    body: "Vínculos (amor, familia, amigos) y los planes de Disfrute no van en el calendario: cargalos acá con el + cuando pasan. Elegís cuánto duró y con quién, y suman a tus porcentajes.",
  },
  {
    target: "tablero",
    title: "Resultados",
    body: "La torta de tu semana, el sueño, la carga de cada día y cómo vas cambiando semana a semana. Si está comprimido, tocalo para abrirlo.",
  },
  {
    target: "objetivos",
    title: "Objetivos del año",
    body: "Anotá metas por mes y elegí de qué tipo son. Marcalas cuando las cumplas; si se pasan de fecha quedan en rojo y las podés arrastrar a otro mes.",
  },
  {
    target: "semana-header",
    title: "Armalo a tu gusto",
    body: "Cada sección se comprime con el botón de su esquina y se reordena arrastrando su encabezado. LifeBucket se acuerda de cómo lo dejaste.",
    touchBody: "Cada sección se comprime con la flechita de su esquina, para que te quede a mano lo que más usás. LifeBucket se acuerda de cómo lo dejaste.",
  },
  {
    target: "cuenta",
    title: "Sonidos y cuenta",
    body: "Desde acá silenciás los sonidos, volvés a ver esta guía cuando quieras o salís de tu cuenta.",
  },
];
