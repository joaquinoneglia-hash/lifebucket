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
  /** En el celular (con pestañas): otro texto y, si hace falta, otra parte a resaltar. */
  phoneBody?: string;
  phoneTarget?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const GAP = 14;
const CARD_W = 340;

/**
 * Guía paso a paso: oscurece la pantalla, resalta una parte por vez y muestra un consejo al lado.
 * Se avanza con "Siguiente consejo" (o flechas / Enter) y se sale con "Saltar" (o Escape).
 */
export function Tour({ steps: all, phone = false, onClose }: { steps: TourStep[]; phone?: boolean; onClose: () => void }) {
  // Los textos del celular, y solo los consejos de lo que se ve en esta pantalla.
  const [steps] = useState(() =>
    all
      .map((s) => (phone ? { ...s, target: s.phoneTarget ?? s.target, body: s.phoneBody ?? s.body } : s))
      .filter((s) => {
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
    // En el celular la tarjeta va abajo, salvo que lo resaltado esté abajo (por ejemplo, las pestañas).
    pos = rect && rect.top + rect.height / 2 > vp.h / 2 && rect.height < vp.h / 2 ? { left: 16, right: 16, top: 16 } : { left: 16, right: 16, bottom: 16 };
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
            {step.body}
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
    title: "Tu semana, en una barra",
    body: "La barra es tu semana entera. La llenan el Trabajo (rojo) y lo que te hace bien: Deporte, Mente y Alma, Hobbies, Habilidades y Vínculos. Lo que queda es libre y sueño. Pasá el mouse por cada grupo para ver el detalle.",
    phoneBody:
      "La barra es tu semana entera. La llenan el Trabajo (rojo) y lo que te hace bien: Deporte, Mente y Alma, Hobbies, Habilidades y Vínculos. Lo que queda es libre y sueño. Tocá cada grupo para ver el detalle.",
  },
  {
    target: "semana",
    title: "Tu semana tipo: la estructura",
    body: "Acá va lo que se repite todas las semanas: trabajo, gimnasio, clases, comidas. No es una agenda de reuniones ni de eventos: es la estructura de tu semana. Arrastrá sobre un espacio vacío para crear un bloque.",
    phoneBody:
      "Acá va lo que se repite todas las semanas: trabajo, gimnasio, clases, comidas. No es una agenda de reuniones ni de eventos: es la estructura de tu semana. Tocá un espacio vacío para crear un bloque o arrastrá para marcar el horario.",
  },
  {
    target: "semana",
    title: "Editar bloques",
    body: "Tocá un bloque para cambiarle el horario, los días o la categoría. Agarralo de ⠿ para moverlo, estiralo desde los bordes y, si lo arrastrás hasta el tacho de abajo, lo eliminás.",
    phoneBody: "Tocá un bloque para cambiarle el horario, los días o la categoría. Arrastralo para moverlo, estiralo desde el borde, o llevalo al tacho de abajo para eliminarlo.",
  },
  {
    target: "logros-panel",
    phoneTarget: "logros",
    title: "Tus logros: el diario",
    body: "Lo que no se repite va acá: «hoy medité», «cené con amigos», «practiqué inglés». A la noche contá qué hiciste, la categoría se sugiere sola y elegís cuánto duró. Suma a tu semana y a tu mes.",
    phoneBody: "En esta pestaña está tu diario de logros: lo que no se repite («hoy medité», «cené con amigos»). A la noche contá qué hiciste; la categoría se sugiere sola y suma a tu semana y a tu mes.",
  },
  {
    target: "bucket",
    phoneTarget: "logros",
    title: "Cómo llenás tu balde",
    body: "La torta junta tu semana tipo y tus logros: cuánto le dedicás a lo que te hace bien, de la semana o del mes. Abajo tenés el reporte completo.",
    phoneBody: "Arriba de tus logros está el balde: cuánto le dedicás a lo que te hace bien, de la semana o del mes. El reporte completo está en la pestaña Reporte.",
  },
  {
    target: "sueno",
    title: "Tu sueño",
    body: "Tocá acá para configurar a qué hora te dormís y te levantás. En el calendario se ve con lunitas.",
  },
  {
    target: "objetivos",
    title: "Metas",
    body: "Tus metas del año, mes por mes: un organizador personal que no cambia tu balance. Escribila y dale Enter o +; la fecha es opcional.",
    phoneBody: "En esta pestaña están tus metas del año, mes por mes: un organizador personal que no cambia tu balance.",
  },
  {
    target: "semana-header",
    phoneTarget: "tabs",
    title: "Todo a la vista",
    body: "A la izquierda, cómo llenás tu balde y tus logros; en el centro, tu semana tipo; a la derecha, tus metas.",
    phoneBody: "Con estas pestañas vas de tu Semana a tus Logros, el Reporte y tus Metas. LifeBucket se acuerda de dónde quedaste.",
  },
  {
    target: "asistente",
    title: "Tu asistente",
    body: "Pedile cambios hablando o escribiendo: «gimnasio lunes y jueves de 7 a 8» o «hoy medité 20 minutos». Te muestra lo que va a hacer y lo aplicás con un toque.",
  },
  {
    target: "cuenta",
    title: "Tu cuenta",
    body: "Desde acá ves si tus datos están guardados, volvés a ver esta guía o salís de tu cuenta.",
  },
];
