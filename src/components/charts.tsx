"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, formatMinutes } from "@/lib/format";
import { CHART_ORDER, QUADRANTS, quadrantStyle } from "@/lib/quadrants";
import type { Bucket, TrendPoint } from "@/lib/report";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Escala "linda" para el eje: 1, 2, 4, 6, 8, 10, 15, 20… horas. */
function niceHours(maxMinutes: number): number {
  const h = Math.max(1, Math.ceil(maxMinutes / 60));
  const steps = [1, 2, 4, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400];
  return steps.find((s) => s >= h) ?? Math.ceil(h / 100) * 100;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-3 py-2 text-[12px] text-surface shadow-[var(--shadow-popover)]"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  );
}

export function QuadrantLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Referencias">
      {QUADRANTS.map((q) => (
        <li key={q.id} style={quadrantStyle(q.id)} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span aria-hidden className="size-2 rounded-full bg-[var(--q)]" />
          {q.name}
        </li>
      ))}
    </ul>
  );
}

const PAD = { top: 12, right: 8, bottom: 26, left: 34 };

/** Horas cumplidas por día/mes, apiladas por cuadrante. */
export function StackedBars({ data, height = 220 }: { data: Bucket[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const maxH = niceHours(Math.max(0, ...data.map((d) => d.total)));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(28, band * 0.62));
  const y = (minutes: number) => (minutes / 60 / maxH) * innerH;
  const ticks = [0, maxH / 2, maxH];
  const labelEvery = data.length > 16 ? 5 : 1;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Horas cumplidas por período, apiladas por cuadrante">
          {ticks.map((t) => {
            const ty = PAD.top + innerH - (t / maxH) * innerH;
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={ty}
                  y2={ty}
                  stroke="var(--color-line)"
                  strokeDasharray={t === 0 ? undefined : "3 4"}
                />
                <text x={PAD.left - 8} y={ty} dy="0.32em" textAnchor="end" className="fill-ink-muted text-[11px] tabular-nums">
                  {Number.isInteger(t) ? t : t.toFixed(1)} h
                </text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const x = cx - barW / 2;
            const totalH = y(d.total);
            let acc = 0;
            return (
              <g key={d.key} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-opacity duration-150">
                <clipPath id={`bar-${d.key}`}>
                  <rect x={x} y={PAD.top + innerH - totalH} width={barW} height={totalH + 4} rx={4} />
                </clipPath>
                <g clipPath={`url(#bar-${d.key})`}>
                  {CHART_ORDER.map((id) => {
                    const v = d.values[id];
                    if (!v) return null;
                    const h = y(v);
                    const segY = PAD.top + innerH - acc - h;
                    acc += h;
                    return (
                      <rect
                        key={id}
                        x={x}
                        y={segY}
                        width={barW}
                        // 2px de superficie entre segmentos
                        height={Math.max(0, h - (acc < totalH - 0.5 ? 2 : 0))}
                        fill={`var(--color-${id})`}
                      />
                    );
                  })}
                </g>
                {(i % labelEvery === 0 || data.length <= 16) && (
                  <text x={cx} y={height - 8} textAnchor="middle" className="fill-ink-muted text-[11px] capitalize">
                    {d.short}
                  </text>
                )}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hover !== null && data[hover] && (
        <Tooltip x={PAD.left + band * hover + band / 2} y={PAD.top + innerH - y(data[hover].total)} width={width}>
          <p className="mb-1 font-semibold capitalize">{data[hover].label}</p>
          {data[hover].total === 0 ? (
            <p className="text-surface/70">Sin bloques cumplidos</p>
          ) : (
            <>
              {QUADRANTS.filter((q) => data[hover].values[q.id] > 0).map((q) => (
                <p key={q.id} className="flex items-center justify-between gap-4 tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: `var(--color-${q.id})` }} />
                    {q.name}
                  </span>
                  {formatMinutes(data[hover].values[q.id])}
                </p>
              ))}
              <p className="mt-1 flex justify-between border-t border-surface/15 pt-1 font-semibold tabular-nums">
                <span>Total</span>
                {formatMinutes(data[hover].total)}
              </p>
            </>
          )}
        </Tooltip>
      )}
    </div>
  );
}

const TREND_SERIES = [
  { key: "planScore", label: "Distribución", color: "var(--color-ink-faint)", dash: "5 4" },
  { key: "score", label: "Balance real", color: "var(--color-ink)", dash: undefined },
] as const;

/** Distribución (cómo armaste la semana) y balance real (cómo la viviste), semana a semana, de 0 a 100. */
export function TrendLine({ data, height = 200 }: { data: TrendPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const innerW = Math.max(0, width - PAD.left - PAD.right - 8);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + 8 + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (s: number) => PAD.top + innerH - (s / 100) * innerH;

  // Cortamos la línea donde no hay datos en lugar de inventar un cero.
  const segmentsOf = (key: "score" | "planScore") => {
    const out: { i: number; s: number }[][] = [];
    let current: { i: number; s: number }[] = [];
    data.forEach((p, i) => {
      const v = p[key];
      if (v === null) {
        if (current.length) out.push(current);
        current = [];
      } else current.push({ i, s: v });
    });
    if (current.length) out.push(current);
    return out;
  };

  const nearest = (clientX: number, el: SVGSVGElement) => {
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    return best;
  };

  // Una etiqueta cada ~64px como mínimo, para que no se pisen en pantallas angostas.
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64))));

  return (
    <div ref={ref} className="relative flex flex-col gap-2">
      <ul className="flex gap-4 text-[12px] text-ink-muted" aria-label="Referencias">
        {TREND_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg aria-hidden width="18" height="4">
              <line x1="0" x2="18" y1="2" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Distribución y balance real por semana"
          onMouseMove={(e) => setHover(nearest(e.clientX, e.currentTarget))}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-[11px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-line)" strokeWidth={2} />}

          {TREND_SERIES.map((s) => (
            <g key={s.key}>
              {segmentsOf(s.key).map((seg, k) => (
                <polyline
                  key={k}
                  points={seg.map((p) => `${x(p.i)},${y(p.s)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {data.map((p, i) => {
                const v = p[s.key];
                return v === null ? null : (
                  <circle key={p.key} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
                );
              })}
            </g>
          ))}
          {data.map((p, i) =>
            i % labelEvery === 0 ? (
              <text
                key={p.key}
                x={x(i)}
                y={height - 8}
                // Los extremos se anclan hacia adentro para que no se corten.
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                className="fill-ink-muted text-[11px] tabular-nums"
              >
                {p.label.replace("Semana del ", "")}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={y(Math.max(data[hover].score ?? 0, data[hover].planScore ?? 0)) + 28} width={width}>
          <p className="font-semibold">{data[hover].label}</p>
          <p className="flex justify-between gap-4 text-surface/80 tabular-nums">
            <span>Distribución</span>
            {data[hover].planScore ?? "—"}
          </p>
          <p className="flex justify-between gap-4 text-surface/80 tabular-nums">
            <span>Balance real</span>
            {data[hover].score ?? "—"}
          </p>
        </Tooltip>
      )}
    </div>
  );
}


/** Vista de tabla con los mismos datos (accesibilidad y lectura precisa). */
export function BucketsTable({ data }: { data: Bucket[] }) {
  const rows = data.filter((d) => d.total > 0);
  if (!rows.length) return <p className="type-body text-ink-muted">Todavía no hay bloques cumplidos en este período.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-ink-muted">
            <th className="py-2 pr-3 font-medium">Período</th>
            {QUADRANTS.map((q) => (
              <th key={q.id} className="py-2 pr-3 text-right font-medium">
                {q.name}
              </th>
            ))}
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.key} className="border-t border-line">
              <td className="py-2 pr-3 capitalize">{d.label}</td>
              {QUADRANTS.map((q) => (
                <td key={q.id} className={cn("py-2 pr-3 text-right", !d.values[q.id] && "text-ink-faint")}>
                  {d.values[q.id] ? formatMinutes(d.values[q.id]) : "—"}
                </td>
              ))}
              <td className="py-2 text-right font-medium">{formatMinutes(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
