"use client";

import { CalendarPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toKey } from "@/lib/dates";
import { carve, emptyMinutes, type RoutineBlock } from "@/lib/routine";
import { play } from "@/lib/sfx";
import { newId, usePlanner } from "@/lib/store";

const KEY = "lb:routine-hint";

type Demo = { x: number; y: number; press: boolean; sel?: { left: number; top: number; width: number; height: number }; done?: boolean };

/**
 * Si tu semana tiene espacios sin completar, una vez por día un aviso al costado del calendario. Con
 * «Mostrame cómo», un cursor arrastra sobre un hueco y suma un ejemplo («Desayuno» de 7 a 8, o la primera
 * hora libre), para que se vea cómo completar el resto.
 */
export function RoutineHint({ armed }: { armed: boolean; onAdd?: () => void }) {
  const routine = usePlanner((s) => s.routine);
  const sleep = usePlanner((s) => s.sleep);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState<Demo | null>(null);
  const empty = sleepSet ? emptyMinutes(routine, sleep) : 0;

  useEffect(() => {
    if (!armed || !empty) return;
    const today = toKey(new Date());
    try {
      if (localStorage.getItem(KEY) === today) return;
    } catch {}
    const t = window.setTimeout(() => {
      // No encima de otro cartel.
      if (document.querySelector("[aria-labelledby='setup-title'], [role=dialog]")) return;
      try {
        localStorage.setItem(KEY, today);
      } catch {}
      setOpen(true);
      play("pop");
    }, 3000);
    return () => window.clearTimeout(t);
  }, [armed]); // eslint-disable-line react-hooks/exhaustive-deps

  /** El primer hueco de una hora: desayuno de 7 a 8 de lunes a viernes si está libre; si no, el primero que haya. */
  const findSlot = () => {
    const free = (d: number, s: number) => !routine.some((b) => b.days.includes(d) && b.start < s + 60 && b.start + b.minutes > s);
    const weekdays = [1, 2, 3, 4, 5];
    if (weekdays.every((d) => free(d, 7 * 60))) return { name: "Desayuno", days: weekdays, start: 7 * 60 };
    for (let s = 6 * 60; s <= 22 * 60; s += 60) {
      const days = weekdays.filter((d) => free(d, s));
      if (days.length) return { name: s < 10 * 60 ? "Desayuno" : s < 15 * 60 ? "Almuerzo" : s < 19 * 60 ? "Merienda" : "Cena", days, start: s };
    }
    return null;
  };

  const show = () => {
    setOpen(false);
    const slot = findSlot();
    const cols = [...document.querySelectorAll<HTMLElement>("[data-module=semana] [data-day-col]")];
    if (!slot || cols.length < 7) return;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const col = (d: number) => cols[order.indexOf(d)].getBoundingClientRect();
    const y = (m: number) => {
      const r = cols[0].getBoundingClientRect();
      return r.top + ((m - 5 * 60) / (24 * 60 - 5 * 60)) * r.height;
    };
    const a = col(slot.days[0]);
    const z = col(slot.days[slot.days.length - 1]);
    const y1 = y(slot.start);
    const y2 = y(slot.start + 60);
    setDemo({ x: a.left - 80, y: y1 - 60, press: false });
    const steps: [number, () => void][] = [
      [300, () => setDemo((d) => d && { ...d, x: a.left + 14, y: y1 + 4 })],
      [1400, () => setDemo((d) => d && { ...d, press: true, sel: { left: a.left + 3, top: y1, width: 6, height: 6 } })],
      [1700, () => setDemo((d) => d && { ...d, x: z.right - 14, y: y2 - 4, sel: { left: a.left + 3, top: y1, width: z.right - a.left - 6, height: y2 - y1 } })],
      [
        3000,
        () => {
          const block: RoutineBlock = { id: newId(), quadrant: "libre", name: slot.name, days: slot.days, start: slot.start, minutes: 60 };
          const st = usePlanner.getState();
          st.setRoutine(carve(st.routine, block), st.routineSeries);
          play("bubble");
          setDemo({ x: -100, y: y1, press: false, done: true, sel: { left: (a.left + z.right) / 2, top: y2 + 8, width: 0, height: 0 } });
        },
      ],
      [9000, () => setDemo(null)],
    ];
    for (const [ms, fn] of steps) window.setTimeout(fn, ms);
  };

  const semana = typeof document !== "undefined" ? document.querySelector('[data-module="semana"]')?.getBoundingClientRect() : null;
  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-labelledby="routine-hint-title"
          className="animate-sheet-in fixed z-[70] w-[min(340px,calc(100vw-24px))] rounded-3xl bg-surface p-5 shadow-[var(--shadow-popover)]"
          style={semana && semana.left > 360 ? { top: Math.max(12, semana.top + 80), left: semana.left - 352 } : { bottom: 16, left: 12 }}
        >
          <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="pressable absolute top-3 right-3 grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken">
            <X aria-hidden className="size-4" />
          </button>
          <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_oklab,#d99a00_16%,transparent)] text-[#8a6200]">
            <CalendarPlus aria-hidden className="size-5" />
          </span>
          <h2 id="routine-hint-title" className="mt-3 pr-6 text-[17px] leading-tight font-semibold tracking-tight">
            Te quedan {Math.round(empty / 60)} h sin completar en tu semana
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">Completala con lo que hacés todas las semanas: desayunar, traslados, una clase, un hobby. Te muestro cómo.</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="pressable h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
              Después
            </button>
            <button type="button" onClick={show} className="pressable h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface hover:bg-ink/90">
              Mostrame cómo
            </button>
          </div>
        </div>
      )}
      {demo && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[75]">
          {demo.sel && !demo.done && <div className="fixed rounded-[5px] border-2 border-dashed border-ink/60 bg-ink/10 transition-all duration-[1100ms] ease-out" style={demo.sel} />}
          <div className="fixed transition-[left,top] duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]" style={{ left: demo.x, top: demo.y }}>
            <svg width="26" height="26" viewBox="0 0 24 24" className={demo.press ? "scale-90 drop-shadow-md" : "drop-shadow-md"}>
              <path d="M4 2l15 9-6.5 1.6L9.6 19z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          {demo.done && demo.sel && (
            <div className="animate-fade-up fixed -translate-x-1/2" style={{ left: demo.sel.left, top: demo.sel.top }}>
              <span className="mx-auto block w-fit animate-bounce text-[20px] leading-none text-[#d99a00]">↑</span>
              <span className="block rounded-xl bg-[#d99a00] px-3 py-1.5 text-center text-[12.5px] leading-snug font-semibold text-white shadow-[var(--shadow-popover)]">
                Así: arrastrá sobre los espacios en blanco y ponele nombre.
                <br />
                Tocalo para cambiarlo o borrarlo.
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
