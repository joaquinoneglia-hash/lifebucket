"use client";

import { Eraser } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/format";
import type { SleepSettings } from "@/lib/sleep";
import type { Job } from "@/lib/store";
import { formatTime } from "@/lib/time";

/** La franja arranca a las 05:00 y da la vuelta completa (hasta las 05:00 del día siguiente). */
const FROM = 5 * 60;
const CELLS = 48;
const minuteOf = (i: number) => FROM + i * 30;

type Paint = "sleep" | "work" | "project" | null;
type Brush = Exclude<Paint, null> | "erase";

const BRUSHES: { id: Brush; label: string; color: string }[] = [
  { id: "sleep", label: "Dormir", color: "var(--color-sleep)" },
  { id: "work", label: "Trabajo", color: "var(--color-trabajo)" },
  { id: "project", label: "Proyecto", color: "color-mix(in oklab, var(--color-trabajo) 55%, var(--color-alma))" },
  { id: "erase", label: "Borrar", color: "var(--color-ink-faint)" },
];
const COLOR: Record<Exclude<Paint, null>, string> = {
  sleep: BRUSHES[0].color,
  work: BRUSHES[1].color,
  project: BRUSHES[2].color,
};

const ROWS = [
  { id: "weekday", label: "Lunes a viernes", days: [1, 2, 3, 4, 5] },
  { id: "weekend", label: "Sábado y domingo", days: [6, 0] },
] as const;

/** Las celdas de una fila a partir de tu sueño y tus trabajos. */
function cellsFor(row: (typeof ROWS)[number], sleep: SleepSettings, jobs: Job[]): Paint[] {
  const cells: Paint[] = Array(CELLS).fill(null);
  const win = row.id === "weekday" ? sleep.weekday : sleep.weekend;
  // Dormir: de la hora de acostarte a la de levantarte (cruza la medianoche).
  for (let i = 0; i < CELLS; i++) {
    const m = minuteOf(i) % 1440;
    const bed = win.bed % 1440;
    const asleep = bed > win.wake ? m >= bed || m < win.wake : m >= bed && m < win.wake;
    if (asleep) cells[i] = "sleep";
  }
  for (const j of jobs) {
    if (!j.days.some((d) => (row.days as readonly number[]).includes(d))) continue;
    for (let i = 0; i < CELLS; i++) {
      const m = minuteOf(i);
      if (m >= j.start && m < j.end) cells[i] = j.kind === "proyecto" || j.kind === "emprendimiento" ? "project" : "work";
    }
  }
  return cells;
}

/** Tramos seguidos de un mismo color (el sueño puede dar la vuelta). */
function runs(cells: Paint[], kind: Exclude<Paint, null>): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= CELLS; i++) {
    if (i < CELLS && cells[i] === kind) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  }
  return out;
}

/** De las dos filas pintadas a tu sueño y tus trabajos (los nombres que ya pusiste se conservan). */
function derive(rows: Record<string, Paint[]>, prevSleep: SleepSettings, prevJobs: Job[]): { sleep: SleepSettings; jobs: Job[] } {
  const sleep = { ...prevSleep };
  for (const row of ROWS) {
    const cells = rows[row.id];
    let r = runs(cells, "sleep");
    // Si duerme antes y después de las 05:00, son un mismo tramo.
    if (r.length >= 2 && r[0][0] === 0 && r[r.length - 1][1] === CELLS) {
      const first = r.shift()!;
      const last = r.pop()!;
      r = [...r, [last[0], CELLS + first[1]]];
    }
    const longest = r.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (longest) {
      const bed = minuteOf(longest[0]);
      const wake = minuteOf(longest[1]) % 1440;
      sleep[row.id] = { bed: bed < 12 * 60 ? bed + 1440 : bed, wake };
    }
  }
  const nameOf = (kind: Job["kind"]) => prevJobs.find((j) => (j.kind ?? "trabajo") === kind)?.name ?? "";
  const jobs: Job[] = [];
  for (const row of ROWS) {
    for (const [kind, jobKind] of [["work", "trabajo"], ["project", "proyecto"]] as const) {
      for (const [a, b] of runs(rows[row.id], kind)) {
        jobs.push({ name: nameOf(jobKind), kind: jobKind, days: [...row.days], start: minuteOf(a), end: minuteOf(b) });
      }
    }
  }
  return { sleep, jobs };
}

/**
 * Tus horarios como franjas: elegís un pincel (Dormir, Trabajo, Proyecto) y arrastrás sobre las 24 h.
 * Una fila para los días de semana y otra para el finde.
 */
export function BandPainter({
  sleep,
  jobs,
  onChange,
}: {
  sleep: SleepSettings;
  jobs: Job[];
  onChange: (v: { sleep: SleepSettings; jobs: Job[] }) => void;
}) {
  const [brush, setBrush] = useState<Brush>("work");
  const rows = Object.fromEntries(ROWS.map((r) => [r.id, cellsFor(r, sleep, jobs)])) as Record<string, Paint[]>;
  const drag = useRef<{ row: string; last: number; cells: Record<string, Paint[]> } | null>(null);
  const hasWork = jobs.some((j) => (j.kind ?? "trabajo") === "trabajo");
  const hasProject = jobs.some((j) => j.kind === "proyecto" || j.kind === "emprendimiento");

  const indexAt = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(CELLS - 1, Math.floor(((clientX - r.left) / r.width) * CELLS)));
  };
  const paint = (rowId: string, from: number, to: number) => {
    const d = drag.current!;
    const cells = [...d.cells[rowId]];
    const [a, b] = from <= to ? [from, to] : [to, from];
    for (let i = a; i <= b; i++) cells[i] = brush === "erase" ? null : brush;
    d.cells = { ...d.cells, [rowId]: cells };
    onChange(derive(d.cells, sleep, jobs));
  };
  const rename = (kind: Job["kind"], name: string) => onChange({ sleep, jobs: jobs.map((j) => ((j.kind ?? "trabajo") === kind ? { ...j, name } : j)) });

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Qué pintás" className="flex flex-wrap gap-1.5">
        {BRUSHES.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={brush === b.id}
            onClick={() => setBrush(b.id)}
            className={cn(
              "pressable inline-flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-2 text-[13px] font-medium",
              brush === b.id ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:bg-surface-sunken",
            )}
          >
            {b.id === "erase" ? (
              <Eraser aria-hidden className="size-4" />
            ) : (
              <span aria-hidden className="size-4 rounded-[5px]" style={{ background: b.color }} />
            )}
            {b.label}
          </button>
        ))}
      </div>

      {ROWS.map((row) => (
        <div key={row.id} className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold">{row.label}</span>
          <div
            role="group"
            aria-label={`Franjas de ${row.label.toLowerCase()}`}
            className="relative flex h-11 cursor-crosshair touch-none overflow-hidden rounded-lg border border-line bg-[color-mix(in_oklab,var(--color-libre-soft)_70%,var(--color-surface))] select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const i = indexAt(e.currentTarget, e.clientX);
              drag.current = { row: row.id, last: i, cells: rows };
              paint(row.id, i, i);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.row !== row.id) return;
              const i = indexAt(e.currentTarget, e.clientX);
              if (i === d.last) return;
              paint(row.id, d.last, i);
              d.last = i;
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {rows[row.id].map((c, i) => (
              <span
                key={i}
                className={cn("h-full flex-1 transition-colors duration-100", i % 2 === 0 && "border-l border-line/70", i % 6 === 0 && "border-l-line")}
                style={c ? { background: COLOR[c] } : undefined}
              />
            ))}
          </div>
          <div className="relative h-3.5 text-[10px] text-ink-faint tabular-nums" aria-hidden>
            {[0, 6, 12, 18, 24, 30, 36, 42].map((i) => (
              <span key={i} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${(i / CELLS) * 100}%` }}>
                {formatTime(minuteOf(i))}
              </span>
            ))}
          </div>
        </div>
      ))}

      {(hasWork || hasProject) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {hasWork && (
            <input
              value={jobs.find((j) => (j.kind ?? "trabajo") === "trabajo")?.name ?? ""}
              onChange={(e) => rename("trabajo", e.target.value)}
              placeholder="¿Cómo se llama tu trabajo?"
              aria-label="Nombre de tu trabajo"
              className="h-10 rounded-md border border-line bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
            />
          )}
          {hasProject && (
            <input
              value={jobs.find((j) => j.kind === "proyecto" || j.kind === "emprendimiento")?.name ?? ""}
              onChange={(e) => rename("proyecto", e.target.value)}
              placeholder="¿Y tu proyecto?"
              aria-label="Nombre de tu proyecto"
              className="h-10 rounded-md border border-line bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
            />
          )}
        </div>
      )}
    </div>
  );
}
