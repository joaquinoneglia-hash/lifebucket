"use client";

import { BookOpen, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useState } from "react";
import { addDays, fromKey, toKey, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { FEELINGS, feelingOf, moodRange, periodLabel, type MoodPeriod } from "@/lib/mood";
import { play } from "@/lib/sfx";
import { usePlanner } from "@/lib/store";
import { ModuleControls } from "./Modules";
import { Segmented, Sheet } from "./ui";

const DAY = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const dayTitle = (d: DateKey) => DAY.format(fromKey(d)).replace(/^./, (c) => c.toUpperCase());

/**
 * "¿Cómo te sentiste hoy?": tocás 1 a 3 emociones y, si querés, lo contás con tus palabras. Se guarda solo,
 * un registro por día (se puede ir a días anteriores). No suma horas al balde: es para leerte después.
 */
export function MoodCard({ className }: { className?: string }) {
  const moods = usePlanner((s) => s.moods);
  const setMood = usePlanner((s) => s.setMood);
  const today = toKey(new Date());
  const [day, setDay] = useState<DateKey>(today);
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState(false);
  // Enter guarda (Shift+Enter, nueva línea): se confirma con un sonido y un "¡Guardado!".
  const confirm = () => {
    if (!entry.feelings.length && !entry.text.trim()) return;
    setMood({ ...entry, text: entry.text.trim() });
    play("paper");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const desktop = useMediaQuery("(min-width: 1024px)");
  const entry = moods.find((m) => m.date === day) ?? { date: day, feelings: [], text: "" };
  const toggle = (id: string) => {
    const on = entry.feelings.includes(id);
    if (!on && entry.feelings.length >= 3) return;
    play(on ? "click" : "pop");
    setMood({ ...entry, feelings: on ? entry.feelings.filter((f) => f !== id) : [...entry.feelings, id] });
  };
  const label = day === today ? "¿Cómo te sentiste hoy?" : day === toKey(addDays(new Date(), -1)) ? "¿Cómo te sentiste ayer?" : `¿Cómo te sentiste el ${dayTitle(day).toLowerCase()}?`;

  return (
    <section aria-label="¿Cómo te sentiste hoy?" className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <h2 className="flex min-w-0 items-center gap-2 type-title">
          <Heart aria-hidden className="size-4 shrink-0 text-ink-muted" />
          <span className="truncate">¿Cómo te sentiste?</span>
        </h2>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => {
              play("paper");
              setReading(true);
            }}
            className="pressable inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <BookOpen aria-hidden className="size-3.5" />
            Leer
          </button>
          <ModuleControls />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Día anterior" onClick={() => setDay(toKey(addDays(fromKey(day), -1)))} className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <p className="min-w-0 flex-1 text-[13px] font-semibold">{label}</p>
          <button
            type="button"
            aria-label="Día siguiente"
            disabled={day >= today}
            onClick={() => setDay(toKey(addDays(fromKey(day), 1)))}
            className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
        <ul aria-label="Emociones (hasta 3)" className="flex flex-wrap gap-1.5">
          {FEELINGS.map((f) => {
            const on = entry.feelings.includes(f.id);
            const full = !on && entry.feelings.length >= 3;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggle(f.id)}
                  style={{ "--f": f.color } as React.CSSProperties}
                  className={cn(
                    "pressable inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors duration-150 disabled:opacity-35",
                    on ? "border-[var(--f)] bg-[color-mix(in_oklab,var(--f)_18%,var(--color-surface))] text-ink" : "border-line bg-surface text-ink-muted hover:text-ink",
                  )}
                >
                  <span aria-hidden>{f.emoji}</span>
                  {f.label}
                </button>
              </li>
            );
          })}
        </ul>
        <textarea
          value={entry.text}
          onChange={(e) => setMood({ ...entry, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            e.currentTarget.blur();
            confirm();
          }}
          enterKeyHint="done"
          rows={3}
          placeholder="Contalo con tus palabras: qué pasó, qué te hizo bien, qué te costó…"
          aria-label="Contá cómo te sentiste"
          className="min-h-[72px] w-full flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />
        <p className={cn("text-[11px] transition-colors duration-200", saved ? "font-semibold text-success" : "text-ink-faint")}>
          {saved ? "¡Guardado! Se sumó a tu historia ✓" : entry.feelings.length || entry.text.trim() ? "Enter para guardar · se va sumando a tu historia" : "Elegí hasta 3 emociones y contalo. Enter para guardar."}
        </p>
      </div>
      {reading && <MoodBook isMobile={!desktop} onClose={() => setReading(false)} />}
    </section>
  );
}

/** Leer cómo estuviste: por semana o por mes, como un cuentito día por día, con la mezcla de emociones arriba. */
function MoodBook({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const moods = usePlanner((s) => s.moods);
  const [period, setPeriod] = useState<MoodPeriod>("semana");
  const [anchor, setAnchor] = useState(new Date());
  const { from, to, entries, mix } = moodRange(moods, period, anchor);
  const shift = (by: number) => {
    play("paper");
    const d = new Date(anchor);
    if (period === "semana") d.setDate(d.getDate() + by * 7);
    else d.setMonth(d.getMonth() + by, 1);
    setAnchor(d);
  };
  const total = mix.reduce((a, m) => a + m.count, 0);
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="mood-book-title" width="max-w-[620px]">
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 pt-5 pb-3">
          <h2 id="mood-book-title" className="type-headline">
            Cómo estuviste
          </h2>
          <Segmented label="Período" options={[{ id: "semana", label: "Semana" }, { id: "mes", label: "Mes" }] as const} value={period} onChange={setPeriod} />
          <div className="flex w-full items-center gap-1">
            <button type="button" aria-label="Anterior" onClick={() => shift(-1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <p className="flex-1 text-center text-[13px] font-semibold">{periodLabel(period, from, to)}</p>
            <button type="button" aria-label="Siguiente" disabled={to >= toKey(new Date())} onClick={() => shift(1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30">
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
          {/* La mezcla de emociones del período. */}
          {total > 0 && (
            <div className="w-full">
              <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
                {mix.map((m) => (
                  <span key={m.id} title={`${feelingOf(m.id).label}: ${m.count}`} style={{ flexGrow: m.count, background: feelingOf(m.id).color }} />
                ))}
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-muted">
                {mix.slice(0, 5).map((m) => (
                  <span key={m.id}>
                    {feelingOf(m.id).emoji} {feelingOf(m.id).label} · {m.count}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[color-mix(in_oklab,#fff7d6_45%,var(--color-surface))] px-5 py-4">
          {entries.length ? (
            <ol className="flex flex-col gap-4">
              {entries.map((e) => (
                <li key={e.date}>
                  <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{dayTitle(e.date)}</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed">
                    {e.feelings.length > 0 && (
                      <span className="mr-1">
                        {e.feelings.map((id, i) => (
                          <b key={id} className="font-semibold" style={{ color: `color-mix(in oklab, ${feelingOf(id).color} 75%, var(--color-ink))` }}>
                            {i > 0 ? (i === e.feelings.length - 1 ? " y " : ", ") : ""}
                            {feelingOf(id).emoji} {feelingOf(id).label.toLowerCase()}
                          </b>
                        ))}
                        {e.text.trim() ? "." : ""}
                      </span>
                    )}
                    {e.text.trim()}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-muted">Todavía no hay nada anotado en este período.</p>
          )}
        </div>
        <div className="border-t border-line p-3 text-right">
          <button type="button" onClick={onClose} className="pressable h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface hover:bg-ink/90">
            Cerrar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
