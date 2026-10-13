"use client";

import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { addDays, fromKey, toKey, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { FEELINGS, feelingOf, moodRange, periodLabel, type MoodPeriod } from "@/lib/mood";
import { play } from "@/lib/sfx";
import { usePlanner } from "@/lib/store";
import { Segmented, Sheet } from "./ui";

const DAY = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const dayTitle = (d: DateKey) => DAY.format(fromKey(d)).replace(/^./, (c) => c.toUpperCase());

/**
 * «Bitácora», arriba (un librito): se abre tu diario personal. A la izquierda escribís cómo te sentiste
 * (1 a 3 emociones y, si querés, con tus palabras); a la derecha se va armando el cuentito de la semana o del
 * mes. No suma horas al balde: es para leerte después.
 */
export function BitacoraButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <>
      <button
        type="button"
        data-tour="bitacora"
        aria-label="Bitácora"
        title="Tu diario personal"
        onClick={() => {
          play("paper");
          setOpen(true);
        }}
        className={cn("pressable flex items-center gap-2 rounded-full whitespace-nowrap", compact ? "size-8 justify-center" : "bg-surface/80 px-3.5 py-2 text-[13px] font-medium shadow-[var(--shadow-card)] hover:bg-surface")}
      >
        <BookOpen aria-hidden className="size-4 text-ink-muted" />
        {!compact && <span className="max-[1399px]:sr-only">Bitácora</span>}
      </button>
      {open && <Bitacora isMobile={!desktop} onClose={() => setOpen(false)} />}
    </>
  );
}

function Bitacora({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="bitacora-title" width="max-w-[1080px]">
      <div className={cn("flex flex-col", isMobile ? "h-[90dvh]" : "h-[min(820px,90dvh)]")}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="bitacora-title" data-autofocus tabIndex={-1} className="flex items-center gap-2 type-title outline-none">
            <BookOpen aria-hidden className="size-5 text-ink-muted" />
            Bitácora · tu diario personal
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:overflow-hidden">
          <div className="border-line md:overflow-y-auto md:border-r md:bg-[color-mix(in_oklab,var(--color-surface-sunken)_45%,transparent)]">
            <MoodWriter />
          </div>
          <MoodStory />
        </div>
      </div>
    </Sheet>
  );
}

/** Escribir: el día (con flechas para ir a los anteriores), las emociones y el texto. Se guarda solo. */
function MoodWriter() {
  const moods = usePlanner((s) => s.moods);
  const setMood = usePlanner((s) => s.setMood);
  const today = toKey(new Date());
  const [day, setDay] = useState<DateKey>(today);
  const [saved, setSaved] = useState(false);
  const entry = moods.find((m) => m.date === day) ?? { date: day, feelings: [], text: "" };
  // Enter guarda (Shift+Enter, nueva línea): se confirma con un sonido y un "¡Guardado!".
  const confirm = () => {
    if (!entry.feelings.length && !entry.text.trim()) return;
    setMood({ ...entry, text: entry.text.trim() });
    play("paper");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const toggle = (id: string) => {
    const on = entry.feelings.includes(id);
    if (!on && entry.feelings.length >= 3) return;
    play(on ? "click" : "pop");
    setMood({ ...entry, feelings: on ? entry.feelings.filter((f) => f !== id) : [...entry.feelings, id] });
  };
  const label = day === today ? "¿Cómo te sentiste hoy?" : day === toKey(addDays(new Date(), -1)) ? "¿Cómo te sentiste ayer?" : `¿Cómo te sentiste el ${dayTitle(day).toLowerCase()}?`;

  return (
    <div className="flex flex-col gap-3 p-5 md:p-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Día anterior" onClick={() => setDay(toKey(addDays(fromKey(day), -1)))} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <h3 className="min-w-0 flex-1 text-[18px] leading-tight font-semibold tracking-tight">{label}</h3>
        <button
          type="button"
          aria-label="Día siguiente"
          disabled={day >= today}
          onClick={() => setDay(toKey(addDays(fromKey(day), 1)))}
          className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
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
        rows={7}
        placeholder="Contalo con tus palabras: qué pasó, qué te hizo bien, qué te costó…"
        aria-label="Contá cómo te sentiste"
        className="min-h-[160px] w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed placeholder:text-ink-faint focus:border-ink focus:outline-none"
      />
      <p className={cn("text-[11.5px] transition-colors duration-200", saved ? "font-semibold text-success" : "text-ink-faint")}>
        {saved ? "¡Guardado! Se sumó a tu historia ✓" : entry.feelings.length || entry.text.trim() ? "Enter para guardar · se va sumando a tu historia" : "Elegí hasta 3 emociones y contalo. Enter para guardar."}
      </p>
    </div>
  );
}

/** Leer cómo estuviste: por semana o por mes, como un cuentito día por día, con la mezcla de emociones arriba. */
function MoodStory() {
  const moods = usePlanner((s) => s.moods);
  const [period, setPeriod] = useState<MoodPeriod>("mes");
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
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button type="button" aria-label="Anterior" onClick={() => shift(-1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <p className="flex-1 text-center text-[13.5px] font-semibold">{periodLabel(period, from, to)}</p>
          <button type="button" aria-label="Siguiente" disabled={to >= toKey(new Date())} onClick={() => shift(1)} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30">
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
        <Segmented label="Período" options={[{ id: "semana", label: "Semana" }, { id: "mes", label: "Mes" }] as const} value={period} onChange={setPeriod} />
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
      <div className="min-h-0 flex-1 overflow-y-auto bg-[color-mix(in_oklab,#fff7d6_45%,var(--color-surface))] px-6 py-5">
        {entries.length ? (
          <ol className="flex flex-col gap-4">
            {entries.map((e) => (
              <li key={e.date}>
                <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{dayTitle(e.date)}</p>
                <p className="mt-1 text-[15px] leading-relaxed">
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
          <p className="py-10 text-center text-[13.5px] text-ink-muted">Todavía no hay nada anotado en este período. Lo que escribas a la izquierda se va contando acá.</p>
        )}
      </div>
    </div>
  );
}
