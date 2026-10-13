"use client";

import { ArrowRight, Moon, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { fromKey, toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { ACTIVE_PARTS, bucketTotal, monthMinutes, partColor, weekMinutes, type Part } from "@/lib/week-shares";
import { ModuleControls } from "./Modules";
import { QuadrantIcon } from "./QuadrantIcon";
import { GoalsBoard } from "./GoalsBoard";
import { RecapBook } from "./RecapBook";
import { Segmented, Sheet } from "./ui";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmtDay = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });
const h = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;
const label = (p: Part) => (p === "alma" ? "Hobbies" : p === "sueno" ? "Sueño" : QUADRANT_BY_ID[p as keyof typeof QUADRANT_BY_ID].name);

/**
 * Tu Balde: un balde que se llena por capas con tu tiempo (tu rutina semanal más lo que anotaste en tu
 * diario), de la semana o del mes. Abajo la base (Sueño, Trabajo, Libre); arriba, con color, lo que te hace
 * bien. Al lado, el detalle de mayor a menor y una sugerencia.
 */
export function BucketCard({ className, showReport = true }: { className?: string; showReport?: boolean }) {
  const routine = usePlanner((s) => s.routine);
  const logros = usePlanner((s) => s.logros);
  const sleep = usePlanner((s) => s.sleep);
  const startedAt = usePlanner((s) => s.startedAt);
  const [range, setRange] = useState<"semana" | "mes">("mes");
  const [report, setReport] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");

  const month = new Date().toISOString().slice(0, 7);
  // El mes entero: tu semana llevada a todos los días del mes (así el objetivo semanal se ve en el mes).
  const lastDay = toKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  const monthly = monthMinutes(routine, logros, sleep, month, "", lastDay);
  const { minutes } = range === "semana" ? { minutes: weekMinutes(routine, logros, sleep) } : monthly;
  const total = bucketTotal(minutes);
  const partial = false && startedAt;
  const pct = (m: number) => Math.round((m / total) * 100);
  const mine = ACTIVE_PARTS.reduce((acc, p) => acc + minutes[p], 0);
  const byHours = (list: Part[]) => [...list].sort((a, b) => minutes[b] - minutes[a]);
  const BASE = byHours(["trabajo", "libre", "sueno"]);
  const base = minutes.trabajo + minutes.libre + minutes.sueno;
  const MINE = byHours(ACTIVE_PARTS);
  const missing = MINE.filter((p) => minutes[p] === 0);
  // Sin nada para vos, el balde se desborda de trabajo y sueño.
  const overflow = mine === 0;
  const tip = missing.length
    ? `A tu balde le falta ${label(missing[0])}. ¿Le hacés un lugar esta semana?`
    : pct(mine) >= 20
      ? "Buen equilibrio: seguí cuidando tu espacio."
      : "Sumá un rato para vos: aunque sea media hora al día se nota.";

  const row = (p: Part) => (
    <li key={p} className={cn("flex items-center gap-2 text-[12px] leading-[18px] tabular-nums", minutes[p] === 0 && "opacity-45")}>
      <span className="grid size-[18px] shrink-0 place-items-center rounded-full text-white" style={{ background: partColor(p) }}>
        {p === "sueno" ? <Moon aria-hidden className="size-3" /> : <QuadrantIcon id={p as never} className="size-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate leading-tight">{label(p)}</span>
      <span className="text-ink-muted">{h(minutes[p])}</span>
      <span className="w-8 text-right font-semibold">{pct(minutes[p])}%</span>
    </li>
  );

  return (
    <section data-tour="bucket" aria-labelledby="bucket-title" className={cn("card flex min-h-0 flex-col gap-2.5 overflow-hidden px-4 pt-3 pb-3", className)}>
      <header className="flex items-center justify-between gap-2">
        <h2 id="bucket-title" className="type-title">
          Tu Balde
        </h2>
        <div className="flex items-center gap-1">
          <Segmented
            label="Período"
            value={range}
            onChange={setRange}
            options={[
              { id: "semana", label: "Semana" },
              { id: "mes", label: MONTHS[Number(month.slice(5)) - 1].replace(/^./, (c) => c.toUpperCase()) },
            ]}
            className="text-[12px]"
          />
          <ModuleControls />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center gap-4">
        {/* Dos grupos bien separados: lo que es para vos (con color) y la base (Trabajo, Tareas cotidianas, Sueño). */}
        <div className="flex max-h-full min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
          {/* Tiempo para vos: el tablero de logros hacia tu balde ideal. */}
          <div data-tour="balde-vos" className="rounded-xl bg-[color-mix(in_oklab,var(--color-success)_7%,transparent)] px-2.5 py-2 ring-1 ring-[color-mix(in_oklab,var(--color-success)_25%,transparent)]">
            <GoalsBoard minutes={minutes} weeks={range === "semana" ? 1 : monthly.days / 7} />
          </div>
          <ul data-tour="balde-base" className="flex flex-col gap-[3px] rounded-xl bg-surface-sunken/70 px-2.5 py-2">
            <GroupTotal label="La base" value={h(base)} pct={pct(base)} muted action={<BaseAdjust />} />
            {BASE.map(row)}
          </ul>
        </div>
      </div>

      {overflow && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-[color-mix(in_oklab,var(--color-danger)_9%,transparent)] px-3 py-2">
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[color-mix(in_oklab,var(--color-danger)_80%,var(--color-ink))]">
            <b className="font-semibold">Tu balde está desbordado:</b> todo es trabajo y sueño. Sumá algo para vos a tu semana.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("lb:add-block", { detail: { name: "", quadrant: "cuerpo", days: [2, 4], start: 1140, minutes: 60 } }))}
            className="pressable h-8 shrink-0 rounded-full bg-ink px-3 text-[12px] font-semibold text-surface hover:bg-ink/90"
          >
            Sumar algo para vos
          </button>
        </div>
      )}
      <div className={cn("flex items-center justify-between gap-2 border-t border-line pt-2.5", overflow && "hidden")}>
        <p className="min-w-0 text-[12px] leading-snug text-ink-muted" title={partial ? `Desde que empezaste: ${fmtDay.format(fromKey(monthly.start))}` : undefined}>
          {tip}
        </p>
        {showReport && (
          <button type="button" onClick={() => setReport(true)} className="pressable -mr-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-[12.5px] font-medium text-ink-muted hover:text-ink">
            Resumen
            <ArrowRight aria-hidden className="size-3.5" />
          </button>
        )}
      </div>

      {report && <RecapBook range={range} isMobile={!desktop} onClose={() => setReport(false)} />}
    </section>
  );
}


/** El total de un grupo (Para vos, Libre y sueño): sus horas y su %. */
function GroupTotal({ label, value, pct, muted, action }: { label: string; value: string; pct: number; muted?: boolean; action?: React.ReactNode }) {
  return (
    <li className={cn("mb-0.5 flex items-center gap-2 border-b pb-1 text-[11.5px] font-semibold tracking-wide uppercase tabular-nums", muted ? "border-line text-ink-muted" : "border-[color-mix(in_oklab,var(--color-success)_25%,transparent)] text-[color-mix(in_oklab,var(--color-success)_70%,var(--color-ink))]")}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {action}
      <span className="font-medium text-ink-muted normal-case">{value}</span>
      <span className="w-8 text-right">{pct}%</span>
    </li>
  );
}

/** Ajustar la base desde el balde: abre una pantalla con el sueño, el trabajo y las tareas cotidianas para tocar cada uno. */
function BaseAdjust() {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <>
      <button
        type="button"
        data-tour="ajustar-base"
        onClick={() => setOpen(true)}
        className="pressable inline-flex h-6 items-center gap-1 rounded-full bg-surface px-2 text-[11px] font-semibold tracking-normal text-ink normal-case ring-1 ring-line hover:ring-ink"
      >
        <SlidersHorizontal aria-hidden className="size-3" />
        Ajustar
      </button>
      {/* Fuera del título (que va en mayúsculas): en el body. */}
      {open && createPortal(<BaseEditor isMobile={!desktop} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function BaseEditor({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const routine = usePlanner((s) => s.routine);
  const sleep = usePlanner((s) => s.sleep);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const go = (fn: () => void) => {
    onClose();
    window.setTimeout(fn, 60);
  };
  const edit = (id: string) => go(() => window.dispatchEvent(new CustomEvent("lb:edit-block", { detail: { id } })));
  const add = (quadrant: "trabajo" | "libre", name: string, start: number, minutes: number) =>
    go(() => window.dispatchEvent(new CustomEvent("lb:add-block", { detail: { name, quadrant, days: [1, 2, 3, 4, 5], start, minutes } })));
  const section = (quadrant: "trabajo" | "libre", title: string, addLabel: string, addName: string, start: number, minutes: number) => {
    const blocks = routine.filter((b) => b.quadrant === quadrant).sort((x, y) => x.start - y.start);
    return (
      <section className="rounded-xl border border-line p-3">
        <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
          <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: partColor(quadrant) }}>
            <QuadrantIcon id={quadrant} className="size-3.5" />
          </span>
          {title}
        </p>
        {blocks.length ? (
          <ul className="flex flex-col gap-1">
            {blocks.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => edit(b.id)} className="pressable flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{b.name}</span>
                  <span className="text-[11px] text-ink-muted tabular-nums">
                    {[1, 2, 3, 4, 5, 6, 0].filter((d) => b.days.includes(d)).map((d) => DAY_LETTER[d]).join(" ")} · {hhmm(b.start)}–{hhmm(b.start + b.minutes)}
                  </span>
                  <span className="text-[11.5px] font-semibold text-ink-muted">Editar</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 text-[12px] text-ink-muted">Todavía no hay nada.</p>
        )}
        <button type="button" onClick={() => add(quadrant, addName, start, minutes)} className="pressable mt-1.5 inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-ink-muted ring-1 ring-line hover:text-ink hover:ring-ink">
          + {addLabel}
        </button>
      </section>
    );
  };
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="base-title" width="max-w-[520px]">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="base-title" className="type-headline">
              Tu base
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Lo que sostiene tu semana: sueño, trabajo y tareas cotidianas. Tocá lo que quieras cambiar.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <section className="rounded-xl border border-line p-3">
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-[var(--color-sleep)] text-white">
              <Moon aria-hidden className="size-3.5" />
            </span>
            Sueño
          </p>
          <button type="button" onClick={() => go(() => window.dispatchEvent(new Event("lb:open-sleep")))} className="pressable flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken">
            <span className="min-w-0 flex-1 text-[12px] text-ink-muted tabular-nums">
              {sleepSet ? (
                <>
                  Semana: {hhmm(sleep.weekday.bed)} a {hhmm(sleep.weekday.wake)} · Finde: {hhmm(sleep.weekend.bed)} a {hhmm(sleep.weekend.wake)}
                </>
              ) : (
                "Sin configurar"
              )}
            </span>
            <span className="text-[11.5px] font-semibold text-ink-muted">Cambiar horarios</span>
          </button>
        </section>
        {section("trabajo", "Trabajo", "Sumar trabajo", "Trabajo", 540, 480)}
        {section("libre", "Tareas cotidianas", "Sumar tarea cotidiana", "", 780, 60)}
      </div>
    </Sheet>
  );
}
