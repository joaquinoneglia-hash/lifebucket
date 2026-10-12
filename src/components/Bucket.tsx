"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { ACTIVE_PARTS, monthMinutes, partColor, weekMinutes, WEEK_MINUTES, type Part } from "@/lib/week-shares";
import { Dashboard } from "./Dashboard";
import { QuadrantIcon } from "./QuadrantIcon";
import { Segmented, Sheet } from "./ui";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const h = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;

/**
 * Cómo llenás tu balde: una torta con a qué le dedicás el tiempo (la semana tipo más tus logros), de la
 * semana o del mes. Lo importante (Deporte, Mente y Alma, Hobbies, Habilidades, Vínculos) va con color;
 * la base (Trabajo, Libre y Sueño) queda más tenue.
 */
export function BucketCard({ className, showReport = true }: { className?: string; showReport?: boolean }) {
  const routine = usePlanner((s) => s.routine);
  const logros = usePlanner((s) => s.logros);
  const sleep = usePlanner((s) => s.sleep);
  const [range, setRange] = useState<"semana" | "mes">("semana");
  const [report, setReport] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");

  const month = new Date().toISOString().slice(0, 7);
  const { minutes, total } = range === "semana" ? { minutes: weekMinutes(routine, logros, sleep), total: WEEK_MINUTES } : monthMinutes(routine, logros, sleep, month);
  const pct = (m: number) => Math.round((m / total) * 100);
  const mine = ACTIVE_PARTS.reduce((acc, p) => acc + minutes[p], 0);
  const rest = minutes.libre + minutes.sueno;

  // La torta: lo tuyo primero (con color), después Trabajo y al final libre y sueño (gris).
  const slices: { id: Part | "resto"; v: number; color: string }[] = [
    ...ACTIVE_PARTS.map((p) => ({ id: p, v: minutes[p], color: partColor(p) })),
    { id: "trabajo" as const, v: minutes.trabajo, color: partColor("trabajo") },
    { id: "resto" as const, v: rest, color: "color-mix(in oklab, var(--color-ink) 9%, transparent)" },
  ].filter((s) => s.v > 0);

  return (
    <section data-tour="bucket" aria-labelledby="bucket-title" className={cn("card flex flex-col gap-3 p-4", className)}>
      <header className="flex items-center justify-between gap-2">
        <h2 id="bucket-title" className="type-title">
          Cómo llenás tu balde
        </h2>
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
      </header>

      <div className="flex items-center gap-4">
        <Donut slices={slices} total={total} center={h(mine)} sub="para vos" />
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {ACTIVE_PARTS.map((p) => (
            <li key={p} className={cn("flex items-center gap-2 text-[12.5px] tabular-nums", minutes[p] === 0 && "opacity-45")}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ background: partColor(p) }}>
                <QuadrantIcon id={p as never} className="size-3" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">{p === "alma" ? "Hobbies" : QUADRANT_BY_ID[p as keyof typeof QUADRANT_BY_ID].name}</span>
              <span className="text-ink-muted">{h(minutes[p])}</span>
              <span className="w-8 text-right font-semibold">{pct(minutes[p])}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3 border-t border-line pt-2.5 text-[12px] text-ink-muted tabular-nums">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: partColor("trabajo") }} />
          Trabajo <b className="text-ink">{pct(minutes.trabajo)}%</b>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[color-mix(in_oklab,var(--color-ink)_15%,transparent)]" />
          Libre y sueño <b className="text-ink">{pct(rest)}%</b>
        </span>
      </div>

      {showReport && (
        <>
          <button type="button" onClick={() => setReport(true)} className="pressable -mx-1 inline-flex items-center gap-1 self-start rounded-md px-1 text-[12.5px] font-medium text-ink-muted hover:text-ink">
            Ver reporte completo
            <ArrowRight aria-hidden className="size-3.5" />
          </button>
          {report && (
            <Sheet isMobile={!desktop} side onClose={() => setReport(false)} labelledBy="report-title" width="max-w-[460px]">
              <div className="flex h-full flex-col">
                <h2 id="report-title" className="type-headline border-b border-line px-5 py-4">
                  Reporte
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <Dashboard />
                </div>
              </div>
            </Sheet>
          )}
        </>
      )}
    </section>
  );
}

/** La torta (anillo), con lo tuyo en el centro. */
function Donut({ slices, total, center, sub }: { slices: { id: string; v: number; color: string }[]; total: number; center: string; sub: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let at = 0;
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="13" />
        {slices.map((s) => {
          const len = (s.v / total) * c;
          const gap = slices.length > 1 ? Math.min(1.2, len / 3) : 0;
          const el = <circle key={s.id} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="13" strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-at} className="transition-[stroke-dasharray,stroke-dashoffset] duration-500" />;
          at += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span className="flex flex-col leading-tight">
          <span className="text-[19px] font-semibold tabular-nums">{center}</span>
          <span className="text-[11px] text-ink-muted">{sub}</span>
        </span>
      </div>
    </div>
  );
}
