"use client";

import { Plus, X } from "lucide-react";
import { cn, formatMinutes } from "@/lib/format";
import type { Job } from "@/lib/store";
import { formatTime } from "@/lib/time";
import { Segmented, Select } from "./ui";

/** Lunes primero; valores de Date.getDay(). */
const WEEK = [
  { dow: 1, short: "L", name: "lunes" },
  { dow: 2, short: "M", name: "martes" },
  { dow: 3, short: "M", name: "miércoles" },
  { dow: 4, short: "J", name: "jueves" },
  { dow: 5, short: "V", name: "viernes" },
  { dow: 6, short: "S", name: "sábado" },
  { dow: 0, short: "D", name: "domingo" },
];

const NAME_SUGGESTIONS = ["Empleo", "Emprendimiento", "Freelance", "Negocio propio"];
const TIMES = Array.from({ length: 39 }, (_, i) => 5 * 60 + i * 30); // 05:00 a 24:00

export const DEFAULT_JOB: Job = { name: "Empleo", days: [1, 2, 3, 4, 5], start: 9 * 60, end: 18 * 60 };

/** En qué días y horarios trabajás. Hasta dos trabajos (empleo y emprendimiento, por ejemplo). */
export function WorkEditor({ jobs, onChange }: { jobs: Job[]; onChange: (jobs: Job[]) => void }) {
  const working = jobs.length > 0;
  const update = (i: number, patch: Partial<Job>) => onChange(jobs.map((j, k) => (k === i ? { ...j, ...patch } : j)));

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="¿Trabajás?"
        options={[
          { id: "yes", label: "Trabajo" },
          { id: "no", label: "No trabajo ahora" },
        ]}
        value={working ? "yes" : "no"}
        onChange={(v) => onChange(v === "yes" ? [DEFAULT_JOB] : [])}
      />

      {jobs.map((job, i) => {
        const total = Math.max(0, job.end - job.start) * job.days.length;
        return (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{i === 0 ? "Tu trabajo" : "Tu segundo trabajo"}</span>
              <span className="text-[12px] text-ink-muted tabular-nums">{formatMinutes(total)} por semana</span>
              {jobs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(jobs.filter((_, k) => k !== i))}
                  aria-label={`Quitar ${job.name}`}
                  className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`job-name-${i}`} className="text-[11px] text-ink-muted">
                ¿Qué tipo de trabajo?
              </label>
              <input
                id={`job-name-${i}`}
                value={job.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Empleo, emprendimiento…"
                autoComplete="off"
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[14px] placeholder:text-ink-muted/80 focus:border-ink focus:shadow-[0_0_0_3px_rgba(37,40,54,0.08)] focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {NAME_SUGGESTIONS.filter((n) => n !== job.name).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update(i, { name: n })}
                    className="pressable h-7 rounded-full bg-surface-sunken px-2.5 text-[12px] text-ink-muted hover:text-ink"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-ink-muted">¿Qué días?</span>
              <div role="group" aria-label={`Días de ${job.name}`} className="grid grid-cols-7 gap-1">
                {WEEK.map((w) => {
                  const on = job.days.includes(w.dow);
                  return (
                    <button
                      key={w.dow}
                      type="button"
                      aria-pressed={on}
                      aria-label={w.name}
                      onClick={() => update(i, { days: on ? job.days.filter((d) => d !== w.dow) : [...job.days, w.dow] })}
                      className={cn(
                        "pressable h-10 rounded-md text-[13px] font-semibold",
                        on ? "bg-ink text-surface" : "bg-surface-sunken text-ink-muted hover:bg-line hover:text-ink",
                      )}
                    >
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Desde</span>
                <Select
                  label={`Hora de inicio de ${job.name}`}
                  value={String(job.start)}
                  onChange={(v) => update(i, { start: Number(v), end: Math.max(job.end, Number(v) + 30) })}
                  options={TIMES.slice(0, -1).map((m) => ({ value: String(m), label: formatTime(m) }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-muted">Hasta</span>
                <Select
                  label={`Hora de fin de ${job.name}`}
                  value={String(job.end)}
                  onChange={(v) => update(i, { end: Number(v) })}
                  options={TIMES.filter((m) => m > job.start).map((m) => ({ value: String(m), label: formatTime(m) }))}
                />
              </label>
            </div>
          </div>
        );
      })}

      {working && jobs.length < 2 && (
        <button
          type="button"
          onClick={() => onChange([...jobs, { name: "Emprendimiento", days: [2, 4], start: 19 * 60, end: 21 * 60 }])}
          className="pressable flex items-center gap-3 rounded-xl border border-dashed border-ink-faint p-3 text-left hover:border-ink"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken">
            <Plus aria-hidden className="size-4" />
          </span>
          <span>
            <span className="block text-[13px] font-semibold">Sumar otro trabajo</span>
            <span className="block text-[12px] text-ink-muted">¿Emprendés aparte de tu empleo? Cargalo con sus propios horarios.</span>
          </span>
        </button>
      )}
    </div>
  );
}
