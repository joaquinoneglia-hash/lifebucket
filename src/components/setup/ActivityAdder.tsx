"use client";

import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { cn, formatMinutes } from "@/lib/format";
import { QUADRANT_BY_ID, quadrantStyle, type QuadrantId } from "@/lib/quadrants";
import type { ActivitySpec, TimeOfDay } from "@/lib/routine";
import { interpret } from "@/lib/setup-ai";
import { parseLoose } from "@/lib/setup-parse";
import type { SleepSettings } from "@/lib/sleep";
import { QuadrantIcon } from "../QuadrantIcon";
import { Composer } from "./Composer";

/** Las tres categorías de lo que te llena (Alma incluye lo vincular). */
export const LIFE: QuadrantId[] = ["cuerpo", "mente", "alma"];

const POPULAR: { name: string; quadrant: QuadrantId; perWeek: number; timeOfDay?: TimeOfDay }[] = [
  { name: "Gimnasio", quadrant: "cuerpo", perWeek: 3, timeOfDay: "mañana" },
  { name: "Correr", quadrant: "cuerpo", perWeek: 2, timeOfDay: "mañana" },
  { name: "Yoga", quadrant: "cuerpo", perWeek: 2 },
  { name: "Fútbol", quadrant: "cuerpo", perWeek: 1, timeOfDay: "noche" },
  { name: "Leer", quadrant: "mente", perWeek: 5, timeOfDay: "noche" },
  { name: "Estudiar", quadrant: "mente", perWeek: 2 },
  { name: "Inglés", quadrant: "mente", perWeek: 2 },
  { name: "Meditar", quadrant: "alma", perWeek: 5, timeOfDay: "mañana" },
  { name: "Terapia", quadrant: "alma", perWeek: 1 },
  { name: "Familia", quadrant: "alma", perWeek: 1, timeOfDay: "noche" },
  { name: "Amigos", quadrant: "alma", perWeek: 1, timeOfDay: "noche" },
  { name: "Pareja", quadrant: "alma", perWeek: 2, timeOfDay: "noche" },
];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const MOMENTS: { id: TimeOfDay; short: string }[] = [
  { id: "mañana", short: "Mañana" },
  { id: "tarde", short: "Tarde" },
  { id: "noche", short: "Noche" },
];

/** Vínculos va dentro de Alma en el arranque. */
const toLife = (q: QuadrantId): QuadrantId => (q === "vinculos" ? "alma" : q);

/**
 * "¿Qué más hacés en la semana?": escribís o dictás y se suma con su categoría (la detecta sola;
 * si no, te la pregunta). Cada actividad se puede ajustar: veces, duración y momento.
 */
export function ActivityAdder({
  items,
  onChange,
  sleep,
  placeholder = "Ej: gimnasio 3 veces a la mañana",
}: {
  items: ActivitySpec[];
  onChange: (items: ActivitySpec[]) => void;
  sleep: SleepSettings;
  placeholder?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // Algo que no reconocimos: le preguntamos la categoría.
  const [pending, setPending] = useState<Omit<ActivitySpec, "quadrant"> | null>(null);
  const names = items.map((i) => i.name.toLowerCase());

  const merge = (add: ActivitySpec[]) => {
    const out = [...items];
    for (const a of add) {
      const spec = { ...a, quadrant: toLife(a.quadrant) };
      const i = out.findIndex((x) => x.name.toLowerCase() === spec.name.toLowerCase());
      if (i >= 0) out[i] = spec;
      else out.push(spec);
    }
    onChange(out);
  };

  const send = async (text: string) => {
    setBusy(true);
    const r = await interpret("activities", "¿Qué otras cosas hacés en la semana?", text, sleep, "");
    setBusy(false);
    if (r.activities.length) {
      merge(r.activities);
      setNote(r.activities.map((a) => `${a.name} → ${QUADRANT_BY_ID[toLife(a.quadrant)].name}`).join(" · "));
      setPending(null);
    } else if (!r.none) {
      setPending(parseLoose(text));
      setNote("");
    }
  };

  const update = (i: number, patch: Partial<ActivitySpec>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div className="flex flex-col gap-3">
      <Composer onSend={send} busy={busy} placeholder={placeholder} autoFocus />
      {note && <p className="animate-fade-up px-1 text-[12.5px] text-ink-muted">Sumado: {note}</p>}

      {pending && (
        <div className="animate-fade-up flex flex-wrap items-center gap-2 rounded-xl bg-surface-sunken/70 p-3">
          <span className="text-[13px]">
            ¿<span className="font-semibold">{pending.name}</span> es de…
          </span>
          {LIFE.map((q) => (
            <button
              key={q}
              type="button"
              style={quadrantStyle(q)}
              onClick={() => {
                merge([{ ...pending, quadrant: q }]);
                setPending(null);
              }}
              className="pressable inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--q-soft)] px-3 text-[12.5px] font-medium hover:brightness-95"
            >
              <QuadrantIcon id={q} className="size-3.5 text-[var(--q)]" />
              {QUADRANT_BY_ID[q].name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {POPULAR.filter((p) => !names.includes(p.name.toLowerCase())).map((p) => (
          <button
            key={p.name}
            type="button"
            style={quadrantStyle(p.quadrant)}
            onClick={() => merge([{ quadrant: p.quadrant, name: p.name, perWeek: p.perWeek, minutes: 60, timeOfDay: p.timeOfDay }])}
            className="pressable inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-ink-faint px-2.5 text-[12.5px] text-ink-muted hover:border-[var(--q)] hover:text-ink"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--q)]" />
            {p.name}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((s, i) => (
            <li key={s.name} style={quadrantStyle(s.quadrant)} className="animate-fade-up flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-[var(--q-soft)] px-2.5 py-2">
              {/* Tocás la categoría para cambiarla. */}
              <button
                type="button"
                onClick={() => update(i, { quadrant: LIFE[(LIFE.indexOf(s.quadrant) + 1) % LIFE.length] })}
                title="Cambiar categoría"
                className="pressable inline-flex h-7 items-center gap-1 rounded-full bg-surface/80 pr-2 pl-1.5 text-[11.5px] font-semibold text-[var(--q)]"
              >
                <QuadrantIcon id={s.quadrant} className="size-3.5" />
                {QUADRANT_BY_ID[s.quadrant].name}
              </button>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.name}</span>
              <div className="flex items-center gap-0.5">
                <Step label={`Menos ${s.name}`} disabled={s.perWeek <= 1} onClick={() => update(i, { perWeek: s.perWeek - 1, days: undefined })}>
                  <Minus aria-hidden className="size-3" />
                </Step>
                <span className="w-12 text-center text-[12px] font-semibold tabular-nums">{s.perWeek === 7 ? "Diario" : `${s.perWeek}/sem`}</span>
                <Step label={`Más ${s.name}`} disabled={s.perWeek >= 7} onClick={() => update(i, { perWeek: s.perWeek + 1, days: undefined })}>
                  <Plus aria-hidden className="size-3" />
                </Step>
              </div>
              <select
                aria-label={`Duración de ${s.name}`}
                value={s.minutes}
                onChange={(e) => update(i, { minutes: Number(e.target.value) })}
                className="h-7 rounded-md border border-line bg-surface px-1 text-[12px]"
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
              <div role="radiogroup" aria-label={`Momento de ${s.name}`} className="flex gap-0.5 rounded-md bg-surface/70 p-0.5">
                {MOMENTS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={s.timeOfDay === t.id}
                    onClick={() => update(i, { timeOfDay: s.timeOfDay === t.id ? undefined : t.id })}
                    className={cn("h-6 rounded px-1.5 text-[11px]", s.timeOfDay === t.id ? "bg-ink text-surface" : "text-ink-muted hover:text-ink")}
                  >
                    {t.short}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label={`Sacar ${s.name}`}
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                className="pressable grid size-7 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Step({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="pressable grid size-6 place-items-center rounded-md border border-line bg-surface text-ink-muted hover:text-ink disabled:opacity-35"
    >
      {children}
    </button>
  );
}
