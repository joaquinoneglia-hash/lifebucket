"use client";

import { SlidersHorizontal, Trophy, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_IDEAL, IDEAL_PARTS, IDEAL_WHY, idealOf, idealProgress, type IdealPart } from "@/lib/balance-goals";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { partColor, thisMonday, type Part } from "@/lib/week-shares";
import { QuadrantIcon } from "./QuadrantIcon";

const h = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;
const label = (p: IdealPart) => (p === "alma" ? "Hobbies" : QUADRANT_BY_ID[p].name);
const HIT_KEY = "lb:hits";

/**
 * El tablero de logros: cada cosa que es para vos con su barra hacia su meta de la semana (tu balde ideal),
 * ordenadas de más a menos avance. Cuando una pasa a otra, sube con una animación y un sonido; llegar a la
 * mitad o a la meta de una categoría, o a tu balde ideal, se festeja (una vez por semana cada hito).
 */
export function GoalsBoard({ minutes, weeks = 1 }: { minutes: Record<Part, number>; weeks?: number }) {
  const custom = usePlanner((s) => s.idealHours);
  const ideal = idealOf(custom);
  const prog = idealProgress(minutes, ideal, weeks);
  const rows = [...prog.rows].sort((a, b) => b.pct - a.pct || b.minutes - a.minutes);
  const [edit, setEdit] = useState(false);

  // La animación de reordenar (FLIP): cada fila se desliza desde donde estaba.
  const refs = useRef(new Map<string, HTMLLIElement>());
  const prevTop = useRef(new Map<string, number>());
  const prevOrder = useRef<string[]>([]);
  const order = rows.map((r) => r.p).join(",");
  useLayoutEffect(() => {
    for (const [p, el] of refs.current) {
      const before = prevTop.current.get(p);
      const now = el.getBoundingClientRect().top;
      if (before !== undefined && before !== now) {
        el.animate([{ transform: `translateY(${before - now}px)` }, { transform: "translateY(0)" }], { duration: 520, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
      }
      prevTop.current.set(p, now);
    }
  }, [order]);

  // Hitos: subir de puesto, la mitad y la meta de una categoría, y el balde ideal completo.
  useEffect(() => {
    if (weeks !== 1) return;
    const week = thisMonday();
    let hits: Record<string, string> = {};
    try {
      hits = JSON.parse(localStorage.getItem(HIT_KEY) ?? "{}");
    } catch {}
    const fire = (id: string, text: string) => {
      if (hits[id] === week) return false;
      hits[id] = week;
      cheer("allChecks", text);
      return true;
    };
    const ids = rows.map((r) => r.p as string);
    const before = prevOrder.current;
    let fired = false;
    if (prog.pct >= 100) fired = fire("ideal", "¡Llenaste tu balde ideal de la semana! 🎉");
    for (const r of rows) {
      if (fired) break;
      if (r.pct >= 100) fired = fire(`${r.p}-100`, `¡Cumpliste tu meta de ${label(r.p)} de la semana!`);
      else if (r.pct >= 50) fired = fire(`${r.p}-50`, `Vas por la mitad de ${label(r.p)}. ¡Seguí así!`);
    }
    // Una categoría subió de puesto (y ya tenía algo).
    if (!fired && before.length) {
      const up = rows.find((r, i) => r.minutes > 0 && before.indexOf(r.p) > i);
      if (up) {
        const passed = before[ids.indexOf(up.p)];
        cheer("check", `${label(up.p)} pasó a ${label(passed as IdealPart)} 💪`);
      }
    }
    prevOrder.current = ids;
    try {
      localStorage.setItem(HIT_KEY, JSON.stringify(hits));
    } catch {}
  }, [order, prog.pct]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.max(0, prog.goal - prog.total);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Trophy aria-hidden className="size-3.5 text-[#d99a00]" />
        <p className="min-w-0 flex-1 text-[11.5px] font-semibold tracking-wide uppercase">
          Tu balde ideal <span className="font-medium tracking-normal text-ink-muted normal-case tabular-nums">· {h(prog.total)} de {h(prog.goal)}</span>
        </p>
        <button type="button" aria-label="Ajustar tus metas" title="Ajustar tus metas" onClick={() => setEdit(true)} className="pressable grid size-6 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
          <SlidersHorizontal aria-hidden className="size-3.5" />
        </button>
      </div>
      {/* La barra total hacia el balde ideal. */}
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
        <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-cuerpo),var(--color-interior),var(--color-alma))] transition-[width] duration-700" style={{ width: `${Math.min(100, prog.pct)}%` }} />
      </div>
      <p className="text-[11px] text-ink-muted">{left > 0 ? `Te faltan ${h(left)} para tu balde ideal ${weeks === 1 ? "de la semana" : "del mes"}.` : "¡Balde ideal completo! 🎉"}</p>
      <ol className="mt-0.5 flex flex-col gap-1.5" aria-label="Tablero de logros">
        {rows.map((r, i) => (
          <li
            key={r.p}
            ref={(el) => {
              if (el) refs.current.set(r.p, el);
              else refs.current.delete(r.p);
            }}
            className="flex items-center gap-2 text-[12px] tabular-nums"
          >
            <span className="w-3 text-right text-[10.5px] font-semibold text-ink-faint">{i + 1}</span>
            <span className="grid size-[18px] shrink-0 place-items-center rounded-full text-white" style={{ background: partColor(r.p) }}>
              <QuadrantIcon id={r.p} className="size-3" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-baseline justify-between gap-1">
                <span className={cn("truncate leading-tight", r.minutes === 0 && "text-ink-muted")}>{label(r.p)}</span>
                <span className="shrink-0 text-[11px] text-ink-muted">
                  {h(r.minutes)} / {h(r.goal)}
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, r.pct)}%`, background: partColor(r.p) }} />
              </span>
            </span>
            <span className={cn("w-9 text-right text-[11.5px] font-semibold", r.pct >= 100 ? "text-success" : r.pct === 0 && "text-ink-faint")}>{r.pct >= 100 ? "✓" : `${r.pct}%`}</span>
          </li>
        ))}
      </ol>
      {edit && <IdealEditor onClose={() => setEdit(false)} />}
    </div>
  );
}

/** Ajustar tu balde ideal: horas por semana de cada cosa, con el recomendado y por qué. */
function IdealEditor({ onClose }: { onClose: () => void }) {
  const custom = usePlanner((s) => s.idealHours);
  const set = usePlanner((s) => s.setIdealHours);
  const ideal = idealOf(custom);
  const total = IDEAL_PARTS.reduce((a, p) => a + ideal[p], 0);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/35 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-labelledby="ideal-title" className="animate-fade-up relative flex w-full max-w-[460px] flex-col gap-3 rounded-3xl bg-surface p-6 shadow-[var(--shadow-popover)]">
        <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable absolute top-3 right-3 grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken">
          <X aria-hidden className="size-4" />
        </button>
        <h2 id="ideal-title" className="text-[20px] font-semibold tracking-tight">
          Tu balde ideal
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Horas por semana para cada cosa. Arrancamos con lo que recomienda la investigación: en total ~18 h (unas 2,5 h por día), dentro de las 2 a 5 h diarias de tiempo propio que más bienestar dan.
        </p>
        <ul className="flex flex-col gap-2">
          {IDEAL_PARTS.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ background: partColor(p) }}>
                <QuadrantIcon id={p} className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px] font-semibold">{label(p)}</b>
                <span className="text-[11.5px] leading-snug text-ink-muted">{IDEAL_WHY[p]}</span>
              </span>
              <span className="flex items-center gap-1">
                <button type="button" aria-label={`Menos ${label(p)}`} onClick={() => set({ ...custom, [p]: Math.max(0, ideal[p] - 0.5) })} className="pressable grid size-7 place-items-center rounded-full bg-surface-sunken text-[15px]">
                  −
                </button>
                <span className="w-10 text-center text-[13.5px] font-semibold tabular-nums">{ideal[p].toLocaleString("es-AR")} h</span>
                <button type="button" aria-label={`Más ${label(p)}`} onClick={() => set({ ...custom, [p]: Math.min(40, ideal[p] + 0.5) })} className="pressable grid size-7 place-items-center rounded-full bg-surface-sunken text-[15px]">
                  +
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line pt-3 text-[13px]">
          <span>
            Total: <b className="tabular-nums">{total.toLocaleString("es-AR")} h por semana</b>
          </span>
          <button type="button" onClick={() => set({})} disabled={IDEAL_PARTS.every((p) => ideal[p] === DEFAULT_IDEAL[p])} className="pressable text-[12.5px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-40">
            Volver a lo recomendado
          </button>
        </div>
      </div>
    </div>
  );
}
