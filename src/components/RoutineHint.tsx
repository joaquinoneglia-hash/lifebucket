"use client";

import { CalendarPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { play } from "@/lib/sfx";

const KEY = "lb:routine-hint";

/**
 * Un rato después de terminar la configuración (30 s), una sola vez: sobre la rutina semanal, "¿Te olvidaste
 * de agregar algo?". Invita a arrastrar en el calendario para sumar algo que se repite cada semana.
 */
export function RoutineHint({ armed, onAdd }: { armed: boolean; onAdd: () => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!armed) return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {}
    const t = window.setTimeout(() => {
      // No encima de otro cartel.
      if (document.querySelector("dialog[open], [aria-labelledby='setup-title'], [aria-labelledby='reminder-title']")) return;
      const el = document.querySelector('[data-module="semana"]') ?? document.querySelector("main#contenido");
      setRect(el?.getBoundingClientRect() ?? null);
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
      play("pop");
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [armed]);

  if (!rect) return null;
  const close = () => setRect(null);
  return (
    <div
      role="dialog"
      aria-labelledby="routine-hint-title"
      className="animate-sheet-in fixed z-[70] w-[min(380px,calc(100vw-24px))] rounded-3xl bg-surface p-5 shadow-[var(--shadow-popover)]"
      style={{ top: Math.max(12, rect.top + 64), left: Math.max(12, Math.min(window.innerWidth - 392, rect.left + rect.width / 2 - 190)) }}
    >
      <button type="button" aria-label="Cerrar" onClick={close} className="pressable absolute top-3 right-3 grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken">
        <X aria-hidden className="size-4" />
      </button>
      <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_oklab,#d99a00_16%,transparent)] text-[#8a6200]">
        <CalendarPlus aria-hidden className="size-5" />
      </span>
      <h2 id="routine-hint-title" className="mt-3 pr-6 text-[17px] leading-tight font-semibold tracking-tight">
        ¿Te olvidaste de agregar algo?
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">Arrastrá en el calendario y sumá algo que hagas todas las semanas: una clase, el almuerzo, el traslado, un hobby.</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={close} className="pressable h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
          Está todo
        </button>
        <button
          type="button"
          onClick={() => {
            close();
            onAdd();
          }}
          className="pressable h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface hover:bg-ink/90"
        >
          Sumar algo
        </button>
      </div>
    </div>
  );
}
