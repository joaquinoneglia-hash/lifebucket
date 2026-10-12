"use client";

import { BookOpen, ChevronLeft, ChevronRight, Maximize2, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, toKey, type DateKey } from "@/lib/dates";
import { DIARY_CATS, monthStory, parseDiary, type DiaryItem } from "@/lib/diary";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { cheer } from "@/lib/motivation";
import { partStyle } from "@/lib/mode";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { play } from "@/lib/sfx";
import { usePlanner, type Logro, type LogroCat } from "@/lib/store";
import { ModuleControls } from "./Modules";
import { QuadrantIcon } from "./QuadrantIcon";
import { Sheet } from "./ui";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
export const durLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const catName = (c: LogroCat) => (c === "alma" ? "Hobbies" : QUADRANT_BY_ID[c].name);
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Mi diario personal (en el dashboard): solo el campo para escribir lo que hiciste hoy fuera de tu rutina.
 * Lo que suma a tu balde se reconoce solo; lo demás queda como nota. El botón de expandir abre el libro con
 * la historia de tu mes.
 */
export function DiaryBox({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <section data-tour="logros-panel" aria-labelledby="diary-title" className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <div className="min-w-0">
          <h2 id="diary-title" className="type-title truncate">
            Mi diario personal
          </h2>
          <p className="truncate text-[11.5px] text-ink-muted">Lo que hiciste hoy fuera de tu rutina</p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => {
              play("open");
              setOpen(true);
            }}
            aria-label="Abrir mi diario"
            title="Abrir mi diario: la historia de tu mes"
            className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Maximize2 aria-hidden className="size-4" />
          </button>
          <ModuleControls />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <DiaryComposer compact />
      </div>
      {open && <DiaryBook isMobile={!desktop} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Compatibilidad: el panel del diario. */
export const LogrosPanel = DiaryBox;

/**
 * Escribir en el diario. Mientras escribís, se ve qué se entendió: una o varias cosas, cada una con su
 * categoría y su duración (se pueden cambiar) o como nota. Se guardan todas juntas.
 */
export function DiaryComposer({ compact, onSaved }: { compact?: boolean; onSaved?: (date: DateKey) => void }) {
  const addLogro = usePlanner((s) => s.addLogro);
  const [text, setText] = useState("");
  // Lo que se cambió a mano en lo que se entendió (por posición): categoría, duración o día.
  const [edits, setEdits] = useState<Record<number, Partial<DiaryItem>>>({});
  const today = toKey(new Date());
  const yesterday = toKey(addDays(new Date(), -1));
  const items = parseDiary(text).map((it, i) => ({ ...it, ...edits[i] }));
  const boxRef = useRef<HTMLDivElement>(null);
  // En el recuadro chico del tablero, lo que se entendió se muestra en una tarjeta flotante arriba del campo
  // (así no queda cortado).
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!compact || !items.length) return setAnchor(null);
    const place = () => setAnchor(boxRef.current?.getBoundingClientRect() ?? null);
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [compact, items.length]);

  const save = () => {
    if (!items.length) return;
    for (const it of items) addLogro({ text: it.text, category: it.category, minutes: it.category ? it.minutes : 0, date: it.date });
    const sums = items.some((it) => it.category);
    cheer(sums ? "diary" : "diaryNote");
    onSaved?.(items[0].date);
    setText("");
    setEdits({});
  };
  const set = (i: number, patch: Partial<DiaryItem>) => setEdits((e) => ({ ...e, [i]: { ...e[i], ...patch } }));

  /** Cada cosa que se entendió, en su tarjeta: qué fue, de qué categoría, cuánto duró y qué día. */
  const cards = (
    <ul className="flex flex-col gap-1.5" aria-label="Lo que se entendió">
      {items.map((it, i) => (
        <li key={i} style={it.category ? partStyle(it.category) : undefined} className={cn("flex flex-col gap-1.5 rounded-xl px-2.5 py-2", it.category ? "bg-[var(--q-soft)]" : "bg-surface-sunken/80")}>
          <span className="flex items-center gap-2">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", it.category ? "bg-[var(--q)] text-white" : "bg-surface text-ink-muted")}>
              {it.category ? <QuadrantIcon id={it.category} className="size-3" /> : <Sparkles aria-hidden className="size-3" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{it.text}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1">
            <select
              aria-label={`Categoría de ${it.text}`}
              value={it.category ?? "nota"}
              onChange={(e) => set(i, { category: e.target.value === "nota" ? null : (e.target.value as LogroCat), minutes: it.minutes || 60 })}
              className="h-7 rounded-full border border-line bg-surface px-2 text-[11.5px] focus:border-ink focus:outline-none"
            >
              {DIARY_CATS.map((c) => (
                <option key={c} value={c}>
                  {catName(c)}
                </option>
              ))}
              <option value="nota">Solo nota</option>
            </select>
            {it.category && (
              <select
                aria-label={`Duración de ${it.text}`}
                value={it.minutes}
                onChange={(e) => set(i, { minutes: Number(e.target.value) })}
                className="h-7 rounded-full border border-line bg-surface px-2 text-[11.5px] tabular-nums focus:border-ink focus:outline-none"
              >
                {[...new Set([...DURATIONS, it.minutes])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>
                    {durLabel(m)}
                  </option>
                ))}
              </select>
            )}
          </span>
          {/* El día, adentro de la misma tarjeta. */}
          <span className="flex items-center gap-1" role="group" aria-label={`Día de ${it.text}`}>
            {[
              { d: today, l: "Hoy" },
              { d: yesterday, l: "Ayer" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                aria-pressed={it.date === o.d}
                onClick={() => set(i, { date: o.d })}
                className={cn("pressable h-7 rounded-full px-2.5 text-[11.5px] font-semibold", it.date === o.d ? "bg-ink text-surface" : "bg-surface text-ink-muted hover:text-ink")}
              >
                {o.l}
              </button>
            ))}
            <input
              type="date"
              value={it.date}
              max={today}
              onChange={(e) => e.target.value && set(i, { date: e.target.value as DateKey })}
              aria-label="Otro día"
              className={cn("h-7 min-w-0 flex-1 rounded-full border bg-surface px-2 text-[11.5px] focus:border-ink focus:outline-none", it.date !== today && it.date !== yesterday ? "border-ink text-ink" : "border-line text-ink-muted")}
            />
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-2"
    >
      <div ref={boxRef} className="relative">
        <textarea
          id="logro-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEdits({});
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
          }}
          rows={compact ? 2 : 5}
          placeholder="Hoy corrí 2 horas, cené con amigos y practiqué guitarra…"
          aria-label="¿Qué hiciste hoy?"
          enterKeyHint="done"
          className="w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-2.5 pr-12 text-[13.5px] leading-relaxed placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={!items.length}
          aria-label="Guardar en mi diario"
          className="pressable absolute right-2 bottom-2.5 grid size-9 place-items-center rounded-full bg-ink text-surface disabled:opacity-25"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
      {items.length > 0 && !compact && <div className="animate-fade-up">{cards}</div>}
      {items.length > 0 &&
        compact &&
        anchor &&
        createPortal(
          <div
            className="animate-fade-up fixed z-[60] flex max-h-[min(420px,60dvh)] flex-col gap-2 overflow-y-auto rounded-2xl border border-line bg-surface p-2.5 shadow-[var(--shadow-popover)]"
            style={{ left: anchor.left, width: anchor.width, bottom: window.innerHeight - anchor.top + 8 }}
          >
            <p className="px-0.5 text-[11.5px] font-semibold text-ink-muted">Esto se va a guardar (tocá + o Enter):</p>
            {cards}
          </div>,
          document.body,
        )}
      {!text && !compact && <p className="text-[11.5px] leading-snug text-ink-faint">Escribí como te salga: se reconoce qué suma a tu balde (Deporte, Mente y Alma, Hobbies, Habilidades, Vínculos), cuánto duró y qué día fue.</p>}
    </form>
  );
}

/**
 * El libro del diario (grande): arriba, los meses con flechas; a la izquierda, escribir y cómo vienen tus
 * meses (un gráfico de líneas con las horas de cada grupo); a la derecha, el cuento del mes elegido.
 */
export function DiaryBook({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const [month, setMonth] = useState(toKey(new Date()).slice(0, 7));
  const current = toKey(new Date()).slice(0, 7);
  const go = (by: number) => {
    play("paper");
    setMonth(shiftMonth(month, by));
  };
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="diary-book-title" width="max-w-[1220px]">
      <div className={cn("flex flex-col", isMobile ? "h-[90dvh]" : "h-[min(860px,92dvh)]")}>
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="diary-book-title" data-autofocus tabIndex={-1} className="flex items-center gap-2 type-title outline-none">
            <BookOpen aria-hidden className="size-4 text-ink-muted" />
            <span className="max-sm:sr-only">Mi diario personal</span>
          </h2>
          {/* Los meses, como páginas. */}
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Mes anterior" onClick={() => go(-1)} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <span className="min-w-[130px] text-center text-[15px] font-semibold first-letter:uppercase">
              {MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
            </span>
            <button
              type="button"
              aria-label="Mes siguiente"
              disabled={month >= current}
              onClick={() => go(1)}
              className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center justify-self-end rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:overflow-hidden">
          {/* Página izquierda: escribir y cómo vienen tus meses. */}
          <div className="flex min-h-0 flex-col gap-3 border-line p-5 md:overflow-y-auto md:border-r md:bg-[color-mix(in_oklab,var(--color-surface-sunken)_45%,transparent)] md:p-7">
            <h3 className="text-[22px] leading-tight font-semibold tracking-tight">¿Qué hiciste hoy?</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">Fuera de tu rutina: algo que lograste, que disfrutaste, con quién estuviste. Lo que sume a tu balde se reconoce solo; lo demás queda como nota para acordarte.</p>
            <DiaryComposer onSaved={(d) => setMonth(d.slice(0, 7))} />
            <MonthsChart month={month} />
          </div>
          {/* Página derecha: el cuento del mes. */}
          <Story month={month} setMonth={setMonth} nav={false} />
        </div>
      </div>
    </Sheet>
  );
}

/** Cómo vienen tus meses: una línea por grupo con las horas que anotaste en el diario (los últimos 6 meses). */
function MonthsChart({ month }: { month: string }) {
  const logros = usePlanner((s) => s.logros);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const counted = logros.filter((l) => l.category && l.minutes > 0);
  const series = DIARY_CATS.map((c) => ({ c, vals: months.map((m) => counted.filter((l) => l.category === c && l.date.startsWith(m)).reduce((acc, l) => acc + l.minutes, 0) / 60) })).filter((x) => x.vals.some((v) => v > 0));
  const max = Math.max(2, ...series.flatMap((x) => x.vals));
  const W = 420;
  const H = 170;
  const P = { l: 30, r: 10, t: 10, b: 24 };
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (months.length - 1);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const ticks = [0, max / 2, max].map((v) => Math.round(v));
  return (
    <section className="mt-3 flex flex-col gap-2 border-t border-line pt-4" aria-label="Cómo vienen tus meses">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">Cómo vienen tus meses</p>
      {series.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">Cuando anotes cosas que suman a tu balde, acá vas a ver cómo crece cada grupo mes a mes.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Horas por grupo en los últimos meses">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t ? "3 4" : undefined} />
                <text x={P.l - 5} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--color-ink-faint)">
                  {t} h
                </text>
              </g>
            ))}
            {months.map((m, i) => (
              <text key={m} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fontWeight={m === month ? 700 : 400} fill={m === month ? "var(--color-ink)" : "var(--color-ink-muted)"}>
                {MONTHS[Number(m.slice(5)) - 1].slice(0, 3)}
              </text>
            ))}
            {series.map((s) => (
              <g key={s.c} style={partStyle(s.c)}>
                <path d={s.vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--q)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
                {s.vals.map((v, i) => v > 0 && <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--color-surface)" stroke="var(--q)" strokeWidth="2" />)}
              </g>
            ))}
          </svg>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {series.map((s) => (
              <li key={s.c} style={partStyle(s.c)} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <span aria-hidden className="h-[3px] w-3.5 rounded-full bg-[var(--q)]" />
                {catName(s.c)} <b className="font-semibold text-ink tabular-nums">{Math.round(s.vals[s.vals.length - 1] * 10) / 10} h</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** La historia de un mes: un resumen, los días con su frase y las tarjetas de color; los hitos, con estrella. */
export function Story({ month, setMonth, className, nav = true }: { month: string; setMonth: (m: string) => void; className?: string; nav?: boolean }) {
  const logros = usePlanner((s) => s.logros);
  const removeLogro = usePlanner((s) => s.removeLogro);
  const story = monthStory(logros, month);
  const current = toKey(new Date()).slice(0, 7);
  const name = MONTHS[Number(month.slice(5)) - 1];
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [story.count, month]);

  return (
    <div ref={boxRef} className={cn("flex min-h-0 flex-col overflow-y-auto p-5 md:p-7", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">La historia de tu mes</p>
        {nav && (        <div className="flex items-center">
          <button type="button" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))} className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={month >= current}
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
        )}
      </div>
      <h3 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight first-letter:uppercase">{name}</h3>
      <p className="mt-2 text-[14.5px] leading-[1.7] text-ink/85">
        {story.count === 0
          ? `Tu ${name} todavía está en blanco. Cada cosa que anotes se va a sumar acá, como un cuento de tu mes.`
          : `Este ${name} anotaste ${story.count} ${story.count === 1 ? "cosa" : "cosas"}${story.total ? ` y le sumaste ${durLabel(story.total)} a tu balde` : ""}.${story.byCat[0] ? ` Lo que más hiciste: ${catName(story.byCat[0].c)}.` : ""}`}
      </p>

      <ol className="mt-5 flex flex-col gap-5">
        {story.days.map((d) => (
          <li key={d.date} className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold">
              {d.title} <span className="font-normal text-ink-muted">· {d.lead}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {d.items.map((l) => (
                <Card key={l.id} logro={l} milestone={story.milestones.has(l.id)} onRemove={() => {
                  play("delete");
                  removeLogro(l.id);
                }} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Una tarjeta del cuento: en el color de su categoría (o en tinta suave si es una nota). Los hitos, con estrella. */
function Card({ logro: l, milestone, onRemove }: { logro: Logro; milestone: boolean; onRemove: () => void }) {
  const cat = l.category && l.minutes > 0 ? l.category : null;
  return (
    <span
      style={cat ? partStyle(cat) : undefined}
      className={cn(
        "group/card animate-fade-up inline-flex max-w-full items-center gap-1.5 rounded-xl py-1 pr-1 pl-1.5 text-[13px]",
        cat ? "bg-[var(--q-soft)]" : "bg-surface-sunken",
        milestone && "ring-2 ring-[color-mix(in_oklab,var(--q,var(--color-ink))_45%,transparent)]",
      )}
    >
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", cat ? "bg-[var(--q)] text-white" : "bg-surface text-ink-muted")}>
        {milestone ? <Star aria-hidden className="size-3" fill="currentColor" /> : cat ? <QuadrantIcon id={cat} className="size-3" /> : <Sparkles aria-hidden className="size-3" />}
      </span>
      <span className="min-w-0 font-medium break-words">{l.text}</span>
      {cat && <span className="shrink-0 text-[11px] text-[color-mix(in_oklab,var(--q)_75%,var(--color-ink))] tabular-nums">{durLabel(l.minutes)}</span>}
      <button type="button" aria-label={`Borrar ${l.text}`} onClick={onRemove} className="grid size-6 shrink-0 place-items-center rounded-full text-ink-faint opacity-0 group-hover/card:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:opacity-60">
        <Trash2 aria-hidden className="size-3" />
      </button>
    </span>
  );
}
