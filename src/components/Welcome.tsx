"use client";

import { useEffect, useRef, useState } from "react";
import { playIntro } from "@/lib/sfx";
import { BrandMark } from "./BrandMark";

/** Una semana de ejemplo para la barra: cada parte con su color. */
const DEMO: { id: string; label: string; share: number }[] = [
  { id: "trabajo", label: "Trabajo", share: 30 },
  { id: "cuerpo", label: "Cuerpo", share: 9 },
  { id: "mente", label: "Mente", share: 8 },
  { id: "alma", label: "Disfrute", share: 13 },
  { id: "vinculos", label: "Vínculos", share: 8 },
  { id: "libre", label: "Libre", share: 32 },
];

/** Libre usa el gris de la app; el resto, el color de su parte. */
const colorOf = (id: string) => (id === "libre" ? "#aab1be" : `var(--color-${id})`);

/**
 * La bienvenida, una sola vez por cuenta: el logo, tu nombre, qué hace la app y una semana de ejemplo
 * que se llena de colores. Suena la intro (si el navegador todavía no deja, suena en el primer toque).
 */
export function Welcome({ name, onDone }: { name?: string; onDone: (tour: boolean) => void }) {
  const [leaving, setLeaving] = useState(false);
  const played = useRef(false);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tryPlay = async () => {
      if (played.current) return;
      played.current = await playIntro();
    };
    // Primero se intenta solo; si el navegador lo frena, suena en el primer toque o tecla.
    const onFirst = () => {
      if (!cancelled) void tryPlay();
    };
    void tryPlay().then(() => {
      if (!played.current && !cancelled) {
        window.addEventListener("pointerdown", onFirst, { once: true });
        window.addEventListener("keydown", onFirst, { once: true });
      }
    });
    const focus = window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), 2600);
    return () => {
      cancelled = true;
      window.clearTimeout(focus);
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, []);

  const finish = (tour: boolean) => {
    setLeaving(true);
    window.setTimeout(() => onDone(tour), 220);
  };

  const at = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onKeyDown={(e) => e.key === "Escape" && finish(false)}
      className={`fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[color-mix(in_oklab,var(--color-canvas)_82%,transparent)] px-4 py-10 backdrop-blur-2xl transition-[opacity,transform] duration-200 ${leaving ? "scale-[0.985] opacity-0" : "opacity-100"}`}
    >
      <div className="flex w-full max-w-[560px] flex-col items-center text-center">
        <div className="animate-welcome-rise" style={at(0)}>
          <BrandMark size={84} animated />
        </div>

        <p className="animate-welcome-rise mt-8 text-[15px] font-medium text-ink-muted" style={at(450)}>
          Te damos la bienvenida{name ? "," : " a LifeBucket"}
        </p>
        {name && (
          <h1 id="welcome-title" className="animate-welcome-rise mt-1 text-[44px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[60px]" style={at(650)}>
            {name}
          </h1>
        )}
        {!name && (
          <h1 id="welcome-title" className="sr-only">
            Te damos la bienvenida a LifeBucket
          </h1>
        )}

        <p className="animate-welcome-rise mt-5 max-w-[30ch] text-[19px] leading-snug text-ink sm:text-[22px]" style={at(1250)}>
          LifeBucket te va a ayudar a entender cómo estás distribuyendo tus días.
        </p>

        {/* Una semana de ejemplo que se llena de colores. */}
        <div className="animate-welcome-rise mt-9 w-full max-w-[420px]" style={at(1700)} aria-hidden>
          <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full">
            {DEMO.map((p, i) => (
              <span
                key={p.id}
                className="animate-welcome-fill h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${p.share}%`, background: colorOf(p.id), ...at(1850 + i * 110) }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-[12px] text-ink-muted">
            {DEMO.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: colorOf(p.id) }} />
                {p.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-snug text-ink-muted">Tu semana es un balde de horas. Cada parte de tu vida lo llena con su color.</p>
        </div>

        <div className="animate-welcome-rise mt-9 flex w-full max-w-[320px] flex-col gap-2" style={at(2500)}>
          <button
            ref={startRef}
            type="button"
            onClick={() => finish(true)}
            className="pressable h-12 rounded-full bg-ink px-6 text-[15px] font-medium text-surface hover:bg-ink/90"
          >
            Mostrame cómo funciona
          </button>
          <button type="button" onClick={() => finish(false)} className="pressable h-10 rounded-full px-4 text-[14px] font-medium text-ink-muted hover:text-ink">
            Ya sé, quiero empezar
          </button>
        </div>
      </div>
    </div>
  );
}
