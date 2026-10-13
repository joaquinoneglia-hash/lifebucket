"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_IDEAL, IDEAL_PARTS, IDEAL_WHY, idealOf, idealProgress, type IdealPart } from "@/lib/balance-goals";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { bucketTotal, partColor, thisMonday, type Part } from "@/lib/week-shares";
import { QuadrantIcon } from "./QuadrantIcon";

const h = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;
const label = (p: IdealPart) => (p === "alma" ? "Hobbies" : QUADRANT_BY_ID[p].name);
const HIT_KEY = "lb:hits";

/**
 * El tablero de logros: cada cosa que es para vos con su barra hacia su meta de la semana (tu balde ideal),
 * ordenadas de más a menos avance. Cuando una pasa a otra, sube con una animación y un sonido; llegar a la
 * mitad o a la meta de una categoría, o a tu balde ideal, se festeja (una vez por semana cada hito).
 */
/** `total`: sobre cuánto se calcula el % (por defecto, todo el balde). */
export function GoalsBoard({ minutes, weeks = 1, total }: { minutes: Record<Part, number>; weeks?: number; total?: number }) {
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
    // En la semana o en el mes: cada hito se festeja una vez por período.
    const week = weeks === 1 ? thisMonday() : `mes-${new Date().toISOString().slice(0, 7)}`;
    let hits: Record<string, string> = {};
    try {
      hits = JSON.parse(localStorage.getItem(HIT_KEY) ?? "{}");
    } catch {}
    const fire = (id: string, text: string) => {
      if (hits[id] === week) return false;
      hits[id] = week;
      cheer("allChecks", text, '[data-module="bucket"]');
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
        cheer("check", `${label(up.p)} pasó a ${label(passed as IdealPart)} 💪`, '[data-module="bucket"]');
      }
    }
    prevOrder.current = ids;
    try {
      localStorage.setItem(HIT_KEY, JSON.stringify(hits));
    } catch {}
  }, [order, prog.pct]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada categoría: horas objetivo, horas llenadas y qué parte del tiempo para mí representa.
  // Cada porcentaje es sobre todo el balde (la base más lo que es para vos), igual que en «La base».
  const all = total ?? bucketTotal(minutes);
  const share = (m: number) => Math.round((m / all) * 100);
  const grid = "grid grid-cols-[14px_minmax(0,1fr)_52px_52px_44px] items-center gap-x-2";
  return (
    <div className="flex flex-col gap-1">
      <div className={cn(grid, "pb-0.5 text-[10px] font-semibold tracking-wide text-ink-faint uppercase")}>
        <span />
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {total === undefined && "Para vos"}
          <button type="button" data-tour="ajustar-vos" title="Ajustar las horas objetivo de cada cosa" onClick={() => setEdit(true)} className="pressable inline-flex h-6 items-center gap-1 rounded-full bg-surface px-2 text-[11px] font-semibold tracking-normal text-ink normal-case ring-1 ring-line hover:ring-ink">
            <SlidersHorizontal aria-hidden className="size-3" />
            Ajustar
          </button>
        </span>
        <span className="text-right">Objetivo</span>
        <span className="text-right">Llenado</span>
        <span className="text-right text-[11.5px] font-semibold tracking-normal text-[color-mix(in_oklab,var(--color-success)_70%,var(--color-ink))]">{total === undefined ? `${share(prog.total)}%` : "%"}</span>
      </div>
      <ol className="flex flex-col gap-1" aria-label="Tiempo para mí por categoría">
        {rows.map((r) => (
          <li
            key={r.p}
            ref={(el) => {
              if (el) refs.current.set(r.p, el);
              else refs.current.delete(r.p);
            }}
            className={cn(grid, "text-[12px] tabular-nums")}
          >
            <span className="grid size-[16px] place-items-center rounded-full text-white" style={{ background: partColor(r.p) }}>
              <QuadrantIcon id={r.p} className="size-2.5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("truncate leading-tight", r.minutes === 0 && "text-ink-muted")}>{label(r.p)}</span>
              {/* Cuánto del objetivo se llenó. */}
              <span className="h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, r.pct)}%`, background: partColor(r.p) }} />
              </span>
            </span>
            <span className="text-right text-[11.5px] text-ink-muted">{h(r.goal)}</span>
            <span className={cn("text-right text-[11.5px] font-semibold", r.pct >= 100 ? "text-success" : r.minutes === 0 && "text-ink-faint")}>
              {r.pct >= 100 && "✓ "}
              {h(r.minutes)}
            </span>
            <span className={cn("text-right text-[11.5px] font-semibold", r.minutes === 0 && "text-ink-faint")}>{share(r.minutes)}%</span>
          </li>
        ))}
      </ol>
      {/* El total del tiempo para mí. */}
      <div className={cn(grid, "mt-0.5 border-t border-line pt-1.5 text-[12px] font-semibold tabular-nums")}>
        <span />
        <span>Total</span>
        <span className="text-right text-[11.5px] text-ink-muted">{h(prog.goal)}</span>
        <span className={cn("text-right text-[11.5px]", prog.pct >= 100 && "text-success")}>
          {prog.pct >= 100 && "✓ "}
          {h(prog.total)}
        </span>
        <span className="text-right text-[11.5px]">{share(prog.total)}%</span>
      </div>
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
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/35 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
