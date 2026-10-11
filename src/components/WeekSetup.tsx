"use client";

import { ArrowLeft, ArrowRight, Plus, Repeat2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { dayLabel, type DateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { QUADRANT_BY_ID, QUADRANTS, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import { addRecurring, awakeWeekMinutes, freeGaps, type Gap, type Recurring } from "@/lib/setup";
import { weekDaysOf, weekToPlan } from "@/lib/missions";
import { describeRepeat, usePlanner } from "@/lib/store";
import { formatTime, formatTimeRange } from "@/lib/time";
import { QuadrantIcon } from "./QuadrantIcon";
import { GhostButton, PrimaryButton, Select, Sheet } from "./ui";

const WEEK = [
  { dow: 1, short: "L", name: "lunes" },
  { dow: 2, short: "M", name: "martes" },
  { dow: 3, short: "M", name: "miércoles" },
  { dow: 4, short: "J", name: "jueves" },
  { dow: 5, short: "V", name: "viernes" },
  { dow: 6, short: "S", name: "sábado" },
  { dow: 0, short: "D", name: "domingo" },
];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const TIMES = Array.from({ length: 39 }, (_, i) => 5 * 60 + i * 30);
const DURATIONS = [30, 60, 90, 120, 180, 240];

/** Rutinas típicas para arrancar rápido (se cargan en el formulario para ajustarlas). */
const SUGGESTIONS: Recurring[] = [
  { activityName: "Desayuno", quadrant: "cuerpo", days: ALL, start: 7 * 60 + 30, minutes: 30 },
  { activityName: "Almuerzo", quadrant: "cuerpo", days: ALL, start: 13 * 60, minutes: 60 },
  { activityName: "Cena", quadrant: "cuerpo", days: ALL, start: 21 * 60, minutes: 60 },
  { activityName: "Traslados", quadrant: "libre", days: WEEKDAYS, start: 8 * 60 + 30, minutes: 30 },
  { activityName: "Gimnasio", quadrant: "cuerpo", days: [1, 3, 5], start: 19 * 60, minutes: 60 },
];

interface WeekSetupProps {
  isMobile: boolean;
  onClose: () => void;
  /** Tocar un espacio libre: cerrar y abrir la hoja para llenarlo. */
  onFill: (gap: Gap) => void;
}

/**
 * "Armá tu semana base": primero lo que se repite todas las semanas,
 * después los espacios que quedaron libres para llenarlos.
 */
export function WeekSetup({ isMobile, onClose, onFill }: WeekSetupProps) {
  const [step, setStep] = useState<"repeat" | "gaps">("repeat");

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="setup-title" width="max-w-[640px]">
      <div className="flex flex-col gap-6 p-5 sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-ink-muted">{step === "repeat" ? "Paso 1 de 2" : "Paso 2 de 2"}</p>
            <h2 id="setup-title" className="type-display">
              {step === "repeat" ? "Armá tu semana base" : "Tus espacios libres"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable -mt-1 -mr-2 grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div key={step} className="animate-fade-up">
          {step === "repeat" ? <RepeatStep /> : <GapsStep onFill={onFill} />}
        </div>
        <footer className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "items-center justify-between")}>
          {step === "repeat" ? (
            <GhostButton onClick={onClose}>Lo hago después</GhostButton>
          ) : (
            <GhostButton onClick={() => setStep("repeat")}>
              <ArrowLeft aria-hidden className="size-4" />
              Volver
            </GhostButton>
          )}
          {step === "repeat" ? (
            <PrimaryButton autoFocus className={isMobile ? "h-12" : ""} onClick={() => setStep("gaps")}>
              Ver mis espacios libres
              <ArrowRight aria-hidden className="size-4" />
            </PrimaryButton>
          ) : (
            <PrimaryButton autoFocus className={isMobile ? "h-12" : ""} onClick={onClose}>
              Ir a mi semana
            </PrimaryButton>
          )}
        </footer>
      </div>
    </Sheet>
  );
}

function RepeatStep() {
  const series = usePlanner((s) => s.series);
  const activities = usePlanner((s) => s.activities);
  const removeSeries = usePlanner((s) => s.removeSeries);

  const ordered = useMemo(() => QUADRANTS.flatMap((q) => activities.filter((a) => a.quadrant === q.id)), [activities]);
  // La actividad es un id existente o una sugerencia todavía sin crear ("nueva:cuadrante:nombre").
  const [form, setForm] = useState<{ activityId: string; days: number[]; start: number; minutes: number }>(() => ({
    activityId: ordered[0]?.id ?? "",
    days: WEEKDAYS,
    start: 19 * 60,
    minutes: 60,
  }));
  const [error, setError] = useState<string | null>(null);

  const fresh = form.activityId.startsWith("nueva:") ? form.activityId.split(":") : null;
  const add = () => {
    const act = fresh
      ? { name: fresh[2], quadrant: fresh[1] as QuadrantId }
      : activities.find((a) => a.id === form.activityId);
    if (!act) return setError("Elegí una actividad");
    if (!form.days.length) return setError("Elegí al menos un día");
    addRecurring({ activityName: act.name, quadrant: act.quadrant, days: form.days, start: form.start, minutes: form.minutes });
    setError(null);
  };

  const prefill = (r: Recurring) => {
    const existing = activities.find((a) => a.quadrant === r.quadrant && a.name.toLowerCase() === r.activityName.toLowerCase());
    setForm({ activityId: existing?.id ?? `nueva:${r.quadrant}:${r.activityName}`, days: r.days, start: r.start, minutes: r.minutes });
  };

  const taken = new Set(series.map((s) => s.title.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <p className="type-body text-ink-muted">
        Primero cargamos lo que se repite todas las semanas: tu trabajo, las comidas, el gimnasio, los traslados. Después
        vemos los espacios que quedaron libres y los llenamos.
      </p>

      <section aria-labelledby="repeat-list" className="flex flex-col gap-2">
        <h3 id="repeat-list" className="type-title">
          Lo que ya se repite
        </h3>
        {series.length === 0 ? (
          <p className="rounded-lg bg-surface-sunken/70 p-3 text-[13px] text-ink-muted">Todavía nada. Sumá lo primero abajo.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {series.map((s) => (
              <li key={s.id} style={quadrantStyle(s.quadrant)} className="flex items-center gap-3 rounded-lg bg-[var(--q-soft)] py-2 pr-1.5 pl-3">
                <QuadrantIcon id={s.quadrant} className="size-4 shrink-0 text-[var(--q)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{s.title}</p>
                  <p className="text-[12px] text-[color-mix(in_oklab,var(--q)_55%,var(--color-ink))] first-letter:uppercase tabular-nums">
                    {describeRepeat(s.days)} · {formatTimeRange(s.start, s.minutes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSeries(s.id)}
                  aria-label={`Quitar ${s.title}`}
                  className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface/70 hover:text-ink"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="repeat-add" className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <h3 id="repeat-add" className="flex items-center gap-1.5 type-title">
          <Repeat2 aria-hidden className="size-4" />
          Sumá algo que se repite
        </h3>

        <div className="flex flex-wrap gap-1.5" aria-label="Sugerencias">
          {SUGGESTIONS.filter((r) => !taken.has(r.activityName.toLowerCase())).map((r) => (
            <button
              key={r.activityName}
              type="button"
              onClick={() => prefill(r)}
              style={quadrantStyle(r.quadrant)}
              className="pressable inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-[12px] text-ink-muted hover:border-[var(--q)] hover:text-ink"
            >
              <Plus aria-hidden className="size-3" />
              {r.activityName}
            </button>
          ))}
        </div>

        <Select
          label="Actividad"
          value={form.activityId}
          onChange={(v) => setForm((f) => ({ ...f, activityId: v }))}
          options={[
            ...(fresh ? [{ value: form.activityId, label: `${QUADRANT_BY_ID[fresh[1] as QuadrantId].name} · ${fresh[2]} (nueva)` }] : []),
            ...ordered.map((a) => ({ value: a.id, label: `${QUADRANT_BY_ID[a.quadrant as QuadrantId].name} · ${a.name}` })),
          ]}
        />

        <div role="group" aria-label="Días" className="grid grid-cols-7 gap-1">
          {WEEK.map((w) => {
            const on = form.days.includes(w.dow);
            return (
              <button
                key={w.dow}
                type="button"
                aria-pressed={on}
                aria-label={w.name}
                onClick={() => setForm((f) => ({ ...f, days: on ? f.days.filter((d) => d !== w.dow) : [...f.days, w.dow] }))}
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

        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Hora"
            value={String(form.start)}
            onChange={(v) => setForm((f) => ({ ...f, start: Number(v) }))}
            options={TIMES.map((m) => ({ value: String(m), label: `A las ${formatTime(m)}` }))}
          />
          <Select
            label="Duración"
            value={String(form.minutes)}
            onChange={(v) => setForm((f) => ({ ...f, minutes: Number(v) }))}
            options={DURATIONS.map((m) => ({ value: String(m), label: formatMinutes(m) }))}
          />
        </div>

        {error && (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-muted first-letter:uppercase">
            {form.days.length ? `${describeRepeat(form.days)} · ${formatTimeRange(form.start, form.minutes)}` : "Elegí los días"}
          </span>
          <button
            type="button"
            onClick={add}
            className="pressable inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-4 text-[13px] font-medium text-surface hover:bg-ink/90"
          >
            <Plus aria-hidden className="size-4" />
            Agregar
          </button>
        </div>
      </section>
    </div>
  );
}

function GapsStep({ onFill }: { onFill: (gap: Gap) => void }) {
  const blocks = usePlanner((s) => s.blocks);
  const sleep = usePlanner((s) => s.sleep);
  const targets = usePlanner((s) => s.targets);
  const materialize = usePlanner((s) => s.materialize);
  // La semana que se arma (el finde, la que viene); creamos sus repeticiones para ver los huecos reales.
  const week = useMemo(() => weekToPlan(), []);
  useEffect(() => {
    materialize(weekDaysOf(week));
  }, [materialize, week]);
  const gaps = useMemo(() => freeGaps(blocks, sleep, week), [blocks, sleep, week]);
  const freeTotal = gaps.reduce((acc, g) => acc + g.minutes, 0);
  const libreGoal = Math.round(((targets.libre / 100) * awakeWeekMinutes(sleep)) / 30) * 30;

  const byDay = gaps.reduce<Record<DateKey, Gap[]>>((acc, g) => {
    (acc[g.date] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <p className="type-body text-ink-muted">
        Esto quedó sin asignar en tu semana. Tocá un espacio para llenarlo con una actividad. Lo que no llenes queda como{" "}
        <span className="font-medium text-ink">Libre</span>, que también es parte de tu balance.
      </p>
      <div style={quadrantStyle("libre")} className="flex items-center gap-3 rounded-xl bg-[var(--q-soft)] p-4">
        <QuadrantIcon id="libre" className="size-5 shrink-0 text-[var(--q)]" />
        <p className="text-[13px] leading-snug tabular-nums">
          Tenés <span className="font-semibold">{formatMinutes(freeTotal)}</span> libres. Tu objetivo de Libre es de unas{" "}
          <span className="font-semibold">{formatMinutes(libreGoal)}</span> por semana
          {freeTotal > libreGoal ? `: podés llenar ${formatMinutes(freeTotal - libreGoal)}.` : ". Vas bien."}
        </p>
      </div>
      {Object.keys(byDay).length === 0 ? (
        <p className="rounded-lg bg-surface-sunken/70 p-4 text-[13px] text-ink-muted">No quedan espacios libres de más de una hora.</p>
      ) : (
        <div className="flex max-h-[42dvh] flex-col gap-4 overflow-y-auto pr-1">
          {Object.entries(byDay).map(([date, list]) => (
            <section key={date} className="flex flex-col gap-1.5">
              <h3 className="text-[12px] font-semibold text-ink-muted first-letter:uppercase">{dayLabel(date)}</h3>
              <ul className="flex flex-col gap-1">
                {list.map((g) => (
                  <li key={g.start}>
                    <button
                      type="button"
                      onClick={() => onFill(g)}
                      style={quadrantStyle("libre")}
                      className="pressable flex w-full items-center gap-3 rounded-lg border border-dashed border-[color-mix(in_oklab,var(--q)_45%,transparent)] px-3 py-2.5 text-left hover:bg-[var(--q-soft)]"
                    >
                      <span className="flex-1 text-[13px] font-medium tabular-nums">{formatTimeRange(g.start, g.minutes)}</span>
                      <span className="text-[12px] text-ink-muted tabular-nums">{formatMinutes(g.minutes)}</span>
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink">
                        <Plus aria-hidden className="size-3.5" />
                        Llenar
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
