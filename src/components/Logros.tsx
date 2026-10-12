"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { guessQuadrant } from "@/lib/categorize";
import { addDays, fromKey, toKey, type DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { partStyle } from "@/lib/mode";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { play } from "@/lib/sfx";
import { usePlanner, type Logro, type LogroCat } from "@/lib/store";
import { thisMonday, weekRangeLabel } from "@/lib/week-shares";
import { QuadrantIcon } from "./QuadrantIcon";

/** Las categorías de un logro: lo que se trabaja y se juega (y Trabajo, por si fue un logro laboral). */
export const LOGRO_CATS: LogroCat[] = ["cuerpo", "interior", "alma", "mente", "vinculos", "trabajo"];
const DURATIONS = [30, 60, 90, 120, 180, 240];
const durLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const dayFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "short" });

/** "Hoy", "Ayer" o "martes 14 oct". */
function dayLabel(date: DateKey) {
  const today = toKey(new Date());
  if (date === today) return "Hoy";
  if (date === toKey(addDays(new Date(), -1))) return "Ayer";
  return dayFmt.format(fromKey(date)).replace(".", "");
}

/** El tipo que sugiere el texto (solo entre las categorías de logros). */
function suggest(text: string): LogroCat | null {
  const q = guessQuadrant(text);
  return q && (LOGRO_CATS as string[]).includes(q) ? (q as LogroCat) : null;
}

/**
 * Logros: el diario de cada noche. "¿Qué lograste hoy?": lo escribís, la categoría se sugiere sola, elegís
 * cuánto duró y queda en ese día. No se repite (eso es la semana): suma a los % de la semana y del mes.
 */
export function LogrosPanel({ className }: { className?: string }) {
  const logros = usePlanner((s) => s.logros);
  const removeLogro = usePlanner((s) => s.removeLogro);
  const [monday, setMonday] = useState(thisMonday());
  const current = thisMonday();
  const end = toKey(addDays(fromKey(monday), 6));
  const week = logros.filter((l) => l.date >= monday && l.date <= end).sort((a, b) => b.date.localeCompare(a.date));
  const byDay = [...new Set(week.map((l) => l.date))];
  const totals = LOGRO_CATS.map((c) => ({ c, m: week.filter((l) => l.category === c).reduce((acc, l) => acc + l.minutes, 0) })).filter((t) => t.m > 0);

  return (
    <section data-tour="logros-panel" aria-labelledby="logros-title" className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div>
          <h2 id="logros-title" className="type-title">
            Logros
          </h2>
          <p className="text-[11.5px] text-ink-muted tabular-nums">
            {week.length ? `${week.length} ${week.length === 1 ? "logro" : "logros"} esta semana` : "Lo que hiciste, día a día"}
          </p>
        </div>
        <div className="flex items-center">
          <button type="button" aria-label="Semana anterior" onClick={() => setMonday(toKey(addDays(fromKey(monday), -7)))} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="w-[86px] text-center text-[12px] font-semibold tabular-nums">{monday === current ? "Esta semana" : weekRangeLabel(monday)}</span>
          <button
            type="button"
            aria-label="Semana siguiente"
            disabled={monday >= current}
            onClick={() => setMonday(toKey(addDays(fromKey(monday), 7)))}
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </header>

      <Composer />

      {totals.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          {totals.map(({ c, m }) => (
            <li key={c} style={partStyle(c)} className="inline-flex items-center gap-1 rounded-full bg-[var(--q-soft)] px-2 py-0.5 text-[11.5px] font-medium tabular-nums">
              <QuadrantIcon id={c} className="size-3 text-[var(--q)]" />
              {durLabel(m)}
            </li>
          ))}
        </ul>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {byDay.length === 0 && (
          <p className="px-2 py-6 text-center text-[12.5px] leading-snug text-ink-muted">
            {monday === current ? "Todavía no cargaste logros esta semana. A la noche, contá qué hiciste: un entrenamiento, una salida, algo que aprendiste." : "No hay logros esa semana."}
          </p>
        )}
        {byDay.map((d) => (
          <div key={d} className="flex flex-col gap-1.5 pb-3">
            <p className="px-1 text-[11.5px] font-semibold text-ink-muted first-letter:uppercase">{dayLabel(d)}</p>
            {week
              .filter((l) => l.date === d)
              .map((l) => (
                <LogroItem key={l.id} logro={l} onRemove={() => {
                  play("delete");
                  removeLogro(l.id);
                }} />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LogroItem({ logro: l, onRemove }: { logro: Logro; onRemove: () => void }) {
  return (
    <div style={partStyle(l.category)} className="animate-fade-up flex items-center gap-2.5 rounded-xl bg-[var(--q-soft)] py-1.5 pr-1 pl-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q)] text-white">
        <QuadrantIcon id={l.category} className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="line-clamp-2 block text-[13px] font-semibold break-words">{l.text}</span>
        <span className="block text-[11px] text-[color-mix(in_oklab,var(--q)_75%,var(--color-ink))]">
          {QUADRANT_BY_ID[l.category].name} · {durLabel(l.minutes)}
        </span>
      </span>
      <button type="button" aria-label={`Borrar ${l.text}`} title="Borrar" onClick={onRemove} className="pressable grid size-8 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-surface hover:text-danger">
        <Trash2 aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

/** Cargar un logro: qué hiciste, de qué es (sugerido), cuánto duró y qué día. */
function Composer() {
  const addLogro = usePlanner((s) => s.addLogro);
  const [text, setText] = useState("");
  const [cat, setCat] = useState<LogroCat | null>(null);
  const [manual, setManual] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const today = toKey(new Date());
  const yesterday = toKey(addDays(new Date(), -1));
  const [date, setDate] = useState<DateKey>(today);
  const evening = new Date().getHours() >= 18;
  const open = text.trim().length > 0;

  const add = () => {
    if (!text.trim() || !cat) return;
    addLogro({ text: text.trim(), category: cat, minutes, date });
    play("complete");
    setText("");
    setCat(null);
    setManual(false);
    setMinutes(60);
    setDate(today);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="flex flex-col gap-2.5 border-b border-line px-4 py-3"
    >
      <label htmlFor="logro-text" className="text-[13px] font-semibold">
        {evening ? "¿Qué lograste hoy?" : "¿Qué hiciste?"}
      </label>
      <div className="flex gap-1.5">
        <input
          id="logro-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!manual) setCat(suggest(e.target.value));
          }}
          placeholder="Salí a correr, cené con amigos, practiqué inglés…"
          enterKeyHint="done"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[13.5px] focus:border-ink focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || !cat} aria-label="Sumar logro" className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-ink text-surface disabled:opacity-30">
          <Plus aria-hidden className="size-4" />
        </button>
      </div>

      {open && (
        <div className="animate-fade-up flex flex-col gap-2.5">
          <div role="radiogroup" aria-label="Categoría" className="flex flex-wrap gap-1">
            {LOGRO_CATS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cat === c}
                onClick={() => {
                  setCat(c);
                  setManual(true);
                }}
                style={partStyle(c)}
                className={cn(
                  "pressable inline-flex h-8 items-center gap-1 rounded-full border pr-2.5 pl-1 text-[12px] font-medium transition-colors",
                  cat === c ? "border-[var(--q)] bg-[var(--q-soft)]" : "border-line",
                )}
              >
                <span className="grid size-6 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                  <QuadrantIcon id={c} className="size-3" />
                </span>
                {QUADRANT_BY_ID[c].name}
              </button>
            ))}
          </div>
          {cat && !manual && <p className="-mt-1 text-[11px] text-ink-faint">Categoría sugerida: tocá otra si no es.</p>}
          <div className="flex flex-wrap items-center gap-1">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={cn("pressable h-7 rounded-full px-2.5 text-[12px] font-semibold tabular-nums", minutes === m ? "bg-ink text-surface" : "bg-surface-sunken text-ink-muted")}
              >
                {durLabel(m)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[
              { d: today, l: "Hoy" },
              { d: yesterday, l: "Ayer" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                aria-pressed={date === o.d}
                onClick={() => setDate(o.d)}
                className={cn("pressable h-7 rounded-full px-3 text-[12px] font-semibold", date === o.d ? "bg-ink text-surface" : "bg-surface-sunken text-ink-muted")}
              >
                {o.l}
              </button>
            ))}
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value as DateKey)}
              aria-label="Otro día"
              className="h-7 rounded-full border border-line bg-surface px-2 text-[12px] text-ink-muted focus:border-ink focus:outline-none"
            />
          </div>
        </div>
      )}
    </form>
  );
}
