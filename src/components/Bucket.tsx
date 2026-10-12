"use client";

import { ArrowRight, Moon } from "lucide-react";
import { useId, useState } from "react";
import { fromKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { ACTIVE_PARTS, bucketTotal, monthMinutes, partColor, weekMinutes, type Part } from "@/lib/week-shares";
import { ModuleControls } from "./Modules";
import { QuadrantIcon } from "./QuadrantIcon";
import { RecapBook } from "./RecapBook";
import { Segmented } from "./ui";

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
  // El mes cuenta desde que empezaste a usar la app hasta hoy (no te suma días que no estabas).
  const monthly = monthMinutes(routine, logros, sleep, month, startedAt);
  const { minutes } = range === "semana" ? { minutes: weekMinutes(routine, logros, sleep) } : monthly;
  const total = bucketTotal(minutes);
  const partial = range === "mes" && monthly.start > `${month}-01`;
  const pct = (m: number) => Math.round((m / total) * 100);
  const mine = ACTIVE_PARTS.reduce((acc, p) => acc + minutes[p], 0);
  const byHours = (list: Part[]) => [...list].sort((a, b) => minutes[b] - minutes[a]);
  const BASE = byHours(["trabajo", "sueno"]);
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
        <Pail minutes={minutes} total={total} order={[...BASE.slice().reverse(), ...MINE.slice().reverse()]} center={h(mine)} pct={pct} overflow={overflow} />
        <ul className="flex max-h-full min-w-0 flex-1 flex-col gap-[3px] overflow-y-auto">
          {/* Lo que es para vos, con su total; abajo, la base (Trabajo y Sueño), de mayor a menor. */}
          <GroupTotal label="Tiempo para vos" value={h(mine)} pct={pct(mine)} />
          {MINE.map(row)}
          <li aria-hidden className="my-0.5 border-t border-line" />
          {BASE.map(row)}
        </ul>
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

/**
 * El balde: capas de colores apiladas de abajo hacia arriba (`order`), cada una con su parte del tiempo. La
 * de arriba tiene una ola suave. Al centro, las horas para vos.
 */
function Pail({ minutes, total, order, center, pct, overflow }: { minutes: Record<Part, number>; total: number; order: Part[]; center: string; pct: (m: number) => number; overflow: boolean }) {
  const id = useId().replace(/:/g, "");
  const TOP = 34;
  const BOTTOM = 150;
  // El cuerpo del balde: más ancho arriba, base redondeada.
  const body = "M14 34 L106 34 L94 144 Q93 150 87 150 L33 150 Q27 150 26 144 Z";
  let y = BOTTOM;
  const layers = order
    .filter((p) => minutes[p] > 0)
    .map((p) => {
      const hgt = (minutes[p] / total) * (BOTTOM - TOP);
      y -= hgt;
      return { p, y, hgt };
    });
  const top = layers[layers.length - 1];
  return (
    <div className="relative w-[108px] shrink-0" role="img" aria-label={`Tu balde: ${center} para vos`}>
      <svg viewBox="0 0 120 160" className="w-full overflow-visible">
        <defs>
          <clipPath id={`pail-${id}`}>
            <path d={body} />
          </clipPath>
          <linearGradient id={`shine-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.3" />
            <stop offset="0.35" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="black" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        {/* La manija. */}
        <path d="M22 38 C22 2, 98 2, 98 38" fill="none" stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
        <g clipPath={`url(#pail-${id})`}>
          <rect x="0" y="0" width="120" height="160" fill="var(--color-surface-sunken)" />
          {layers.map((l) => (
            <rect key={l.p} x="0" y={l.y} width="120" height={l.hgt + 0.5} fill={partColor(l.p)} />
          ))}
          {/* El % de cada capa, chiquito, si entra. */}
          {layers
            .filter((l) => l.hgt >= 8)
            .map((l) => (
              <text key={`t-${l.p}`} x="60" y={l.y + l.hgt / 2 + 2.6} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="white" fillOpacity="0.95" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pct(minutes[l.p])}%
              </text>
            ))}
          {/* La ola de arriba: se mece suave. */}
          {top && <path d={`M0 ${top.y + 1.5} q 15 -5 30 0 t 30 0 t 30 0 t 30 0 t 30 0 V ${top.y + 8} H 0 Z`} fill={partColor(top.p)} className="animate-wave" />}
          <rect x="0" y="0" width="120" height="160" fill={`url(#shine-${id})`} />
        </g>
        {/* Desbordado: lo de arriba se sale del balde y gotea por los costados. */}
        {overflow && top && (
          <g fill={partColor(top.p)}>
            <path d="M12 36 C 20 22, 34 30, 44 24 C 56 17, 66 28, 78 22 C 90 16, 100 28, 108 36 Z" className="animate-wave" />
            <path d="M14 34 C 8 40, 7 52, 9 60 C 11 52, 12 44, 18 36 Z" />
            <path d="M106 34 C 112 42, 113 56, 110 66 C 108 56, 107 46, 102 36 Z" />
            <circle cx="9" cy="70" r="2.6" className="animate-drip" />
            <circle cx="110" cy="76" r="2.6" className="animate-drip [animation-delay:700ms]" />
            <circle cx="60" cy="20" r="2" className="animate-drip [animation-delay:350ms]" />
          </g>
        )}
        <path d={body} fill="none" stroke="var(--color-ink)" strokeOpacity="0.55" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M10 34 L110 34" stroke="var(--color-ink)" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** El total de un grupo (Para vos, Libre y sueño): sus horas y su %. */
function GroupTotal({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-ink uppercase tabular-nums">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-medium text-ink-muted normal-case">{value}</span>
      <span className="w-8 text-right">{pct}%</span>
    </li>
  );
}
