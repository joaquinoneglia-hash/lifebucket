"use client";

import { useEffect, useRef, useState } from "react";
import { playIntro } from "@/lib/sfx";
import { BrandMark } from "./BrandMark";

/** Una semana de ejemplo para la barra: cada parte con su color. */
const DEMO: { id: string; label: string; share: number }[] = [
  { id: "trabajo", label: "Trabajo", share: 26 },
  { id: "cuerpo", label: "Deporte", share: 5 },
  { id: "interior", label: "Mente y Alma", share: 2 },
  { id: "alma", label: "Hobbies", share: 4 },
  { id: "mente", label: "Habilidades", share: 3 },
  { id: "vinculos", label: "Vínculos", share: 5 },
  { id: "libre", label: "Libre y sueño", share: 55 },
];

/** Libre usa el gris de la app; el resto, el color de su parte. */
const colorOf = (id: string) => (id === "libre" ? "#aab1be" : id === "sueno" ? "var(--color-sleep)" : `var(--color-${id})`);

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
    const focus = window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), 2900);
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
        {/* El isotipo aparece y, al lado de la frase, el logotipo letra por letra. */}
        <div className="animate-welcome-pop" style={at(0)}>
          <BrandMark size={88} animated />
        </div>
        <h1 id="welcome-title" aria-label="LifeBucket" className="mt-4 flex text-[40px] leading-none font-semibold tracking-[-0.035em] sm:text-[52px]">
          {"LifeBucket".split("").map((ch, i) => (
            <span key={i} aria-hidden className="animate-welcome-letter inline-block" style={at(420 + i * 55)}>
              {ch}
            </span>
          ))}
        </h1>

        <p className="animate-welcome-rise mt-6 text-[15px] font-medium text-ink-muted" style={at(1150)}>
          {name ? `Te damos la bienvenida, ${name}` : "Te damos la bienvenida"}
        </p>

        <p className="animate-welcome-rise mt-3 max-w-[30ch] text-[20px] leading-snug text-ink sm:text-[23px]" style={at(1500)}>
          Enterate en qué se te van las horas de tus días… <span className="text-ink-muted">y algunas funciones más!</span>
        </p>

        {/* Una semana de ejemplo que se llena de colores. */}
        <div className="animate-welcome-rise mt-9 w-full max-w-[420px]" style={at(2000)} aria-hidden>
          <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full">
            {DEMO.map((p, i) => (
              <span
                key={p.id}
                className="animate-welcome-fill h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${p.share}%`, background: colorOf(p.id), ...at(2150 + i * 110) }}
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
          <p className="mt-4 text-[13px] leading-snug text-ink-muted">
            No es una agenda de reuniones ni de salidas: es tu semana tipo en bloques, para ver cómo repartís tu tiempo.
          </p>
        </div>

        <div className="animate-welcome-rise mt-9 flex w-full max-w-[320px] flex-col gap-2" style={at(2800)}>
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
