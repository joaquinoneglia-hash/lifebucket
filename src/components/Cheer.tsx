"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHEER_EVENT } from "@/lib/motivation";

/** La frase del acompañante: aparece abajo un momento y se va sola. */
export function CheerToast() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const on = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      window.clearTimeout(timer.current);
      setMsg({ text, id: Date.now() });
      timer.current = window.setTimeout(() => setMsg(null), 3200);
    };
    window.addEventListener(CHEER_EVENT, on);
    return () => {
      window.removeEventListener(CHEER_EVENT, on);
      window.clearTimeout(timer.current);
    };
  }, []);
  if (!msg) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[96px] z-[70] flex justify-center px-4 lg:bottom-8">
      <p key={msg.id} className="animate-sheet-in flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-medium text-surface shadow-[var(--shadow-popover)]">
        <Sparkles aria-hidden className="size-4 text-[#ffd76a]" />
        {msg.text}
      </p>
    </div>
  );
}
