"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHEER_EVENT, type CheerKind } from "@/lib/motivation";

/** Los logros grandes llevan papelitos. */
const PARTY: CheerKind[] = ["allChecks", "goalDone"];
const CONFETTI = ["#2e9e63", "#8a5cf0", "#e3a008", "#e5508a", "#2563eb", "#f5a36b"];

type Msg = { text: string; id: number; party: boolean; x: number; y: number };

/**
 * La frase del acompañante: aparece cerca del módulo donde estás trabajando (el último que tocaste), en verde,
 * y se desvanece sola. En los logros grandes, con papelitos.
 */
export function CheerToast() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastModule = useRef<Element | null>(null);
  useEffect(() => {
    // El módulo (o ventana) que tocaste por última vez: ahí aparece el aviso.
    const track = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("dialog[open] > *, [data-module]");
      if (el) lastModule.current = el;
    };
    const on = (e: Event) => {
      const { text, kind, anchor } = (e as CustomEvent<{ text: string; kind: CheerKind; anchor?: string }>).detail;
      const el = (anchor && document.querySelector(anchor)) || (lastModule.current?.isConnected ? lastModule.current : null);
      const r = el?.getBoundingClientRect();
      const vw = window.innerWidth;
      const x = r && r.width ? Math.min(Math.max(r.left + r.width / 2, 170), vw - 170) : vw / 2;
      const y = r && r.height ? Math.min(Math.max(r.top + 64, 70), window.innerHeight - 90) : window.innerHeight - 110;
      window.clearTimeout(timer.current);
      setMsg({ text, id: Date.now(), party: PARTY.includes(kind), x, y });
      timer.current = window.setTimeout(() => setMsg(null), 3400);
    };
    document.addEventListener("pointerdown", track, true);
    document.addEventListener("focusin", track, true);
    window.addEventListener(CHEER_EVENT, on);
    return () => {
      document.removeEventListener("pointerdown", track, true);
      document.removeEventListener("focusin", track, true);
      window.removeEventListener(CHEER_EVENT, on);
      window.clearTimeout(timer.current);
    };
  }, []);
  if (!msg) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed z-[160]" style={{ left: msg.x, top: msg.y }}>
      {msg.party && (
        <div aria-hidden className="absolute top-1/2 left-1/2">
          {Array.from({ length: 22 }, (_, k) => {
            const ang = (k / 22) * Math.PI * 2;
            const dist = 70 + (k % 4) * 28;
            return (
              <span
                key={k}
                className="absolute h-2.5 w-1.5 animate-[spark_1.4s_ease-out_forwards] rounded-[2px]"
                style={{ "--dx": `${Math.cos(ang) * dist}px`, "--dy": `${Math.sin(ang) * dist}px`, background: CONFETTI[k % CONFETTI.length], animationDelay: `${(k % 4) * 60}ms` } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}
      <p
        key={msg.id}
        className="flex w-max max-w-[min(340px,calc(100vw-32px))] animate-[cheer-life_3.4s_cubic-bezier(0.23,1,0.32,1)_forwards] items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2e9e63,#22b07a_55%,#5cc98f)] px-4 py-2.5 text-[13.5px] leading-snug font-semibold text-white shadow-[0_10px_30px_-8px_rgba(46,158,99,0.55)]"
      >
        <Sparkles aria-hidden className="size-4 shrink-0 text-[#fff3b0]" />
        {msg.text}
      </p>
    </div>
  );
}
