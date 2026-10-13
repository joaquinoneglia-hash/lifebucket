"use client";

import { BookOpen, ChevronLeft, ChevronRight, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { ChartColumnBig } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, fromKey, toKey, type DateKey } from "@/lib/dates";
import { formatTime } from "@/lib/time";
import { carve, type RoutineBlock } from "@/lib/routine";
import { DIARY_CATS, monthStory, parseDiary, type DiaryItem } from "@/lib/diary";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { cheer } from "@/lib/motivation";
import { partStyle } from "@/lib/mode";
import { QUADRANT_BY_ID } from "@/lib/quadrants";
import { play } from "@/lib/sfx";
import { newId, usePlanner, type Logro, type LogroCat } from "@/lib/store";
import { ModuleControls } from "./Modules";
import { QuadrantIcon } from "./QuadrantIcon";
import { Segmented, Sheet } from "./ui";

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
            <ChartColumnBig aria-hidden className="size-4" />
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
export function DiaryComposer({ compact, bar, onSaved }: { compact?: boolean; bar?: boolean; onSaved?: (date: DateKey) => void }) {
  if (bar) compact = true;
  const addLogro = usePlanner((s) => s.addLogro);
  const [text, setText] = useState("");
  // Lo que se cambió a mano en lo que se entendió (por posición): categoría, duración o día.
  const [edits, setEdits] = useState<Record<number, Partial<DiaryItem>>>({});
  const today = toKey(new Date());
  const yesterday = toKey(addDays(new Date(), -1));
  const tomorrow = toKey(addDays(new Date(), 1));
  const routine = usePlanner((s) => s.routine);
  const items = parseDiary(text, new Date(), routine).map((it, i) => ({ ...it, ...edits[i] }));
  const missingTitle = items.some((it) => !it.text.trim());
  const boxRef = useRef<HTMLDivElement>(null);
  // La barra de abajo del calendario avisa qué se está escribiendo, para dibujarlo en su día y hora.
  const previewKey = bar ? JSON.stringify(items) : "";
  useEffect(() => {
    if (!bar) return;
    window.dispatchEvent(new CustomEvent("lb:diary-preview", { detail: JSON.parse(previewKey || "[]") }));
  }, [bar, previewKey]);
  useEffect(() => () => void (bar && window.dispatchEvent(new CustomEvent("lb:diary-preview", { detail: [] }))), [bar]);
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
    if (!items.length || missingTitle) return;
    let madeRoutine = false;
    for (const it of items) {
      // Hecho rutina: pasa a la semana tipo (los días elegidos), reemplazando lo que hubiera en ese horario.
      if (it.repeat?.length && it.category) {
        const st = usePlanner.getState();
        const block: RoutineBlock = { id: newId(), quadrant: it.category, name: it.text, days: it.repeat, start: it.start ?? 18 * 60, minutes: it.minutes || 60 };
        st.setRoutine(carve(st.routine, block), st.routineSeries);
        madeRoutine = true;
        continue;
      }
      addLogro({ text: it.text, category: it.category, minutes: it.category ? it.minutes : 0, date: it.date, start: it.start });
    }
    if (madeRoutine) play("complete");
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
            {/* El título: se puede tocar y cambiar antes de guardar. */}
            <input
              value={it.text}
              onChange={(e) => set(i, { text: e.target.value })}
              placeholder="¿Qué es? Escribí el nombre…"
              aria-label="Título"
              className={cn(
                "min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-semibold placeholder:font-normal placeholder:text-ink-faint hover:border-line focus:border-ink focus:bg-surface focus:outline-none",
                !it.text.trim() && "border-dashed border-ink/30",
              )}
            />
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
              { d: yesterday, l: "Ayer" },
              { d: today, l: "Hoy" },
              { d: tomorrow, l: "Mañana" },
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
              onChange={(e) => e.target.value && set(i, { date: e.target.value as DateKey })}
              aria-label="Otro día"
              className={cn("h-7 min-w-0 flex-1 rounded-full border bg-surface px-2 text-[11.5px] focus:border-ink focus:outline-none", it.date !== today && it.date !== yesterday && it.date !== tomorrow ? "border-ink text-ink" : "border-line text-ink-muted")}
            />
          </span>
          {/* La hora (si se dijo o si va a la rutina) y la pregunta: ¿lo hacés rutina? ¿qué días? */}
          {it.category && (
            <span className="flex flex-wrap items-center gap-1">
              {(it.start !== undefined || it.repeat) && (
                <input
                  type="time"
                  step={900}
                  aria-label={`Hora de ${it.text}`}
                  value={formatTime(it.start ?? 18 * 60)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (Number.isFinite(h)) set(i, { start: h * 60 + (m || 0) });
                  }}
                  className="h-7 rounded-full border border-line bg-surface px-2 text-[11.5px] tabular-nums focus:border-ink focus:outline-none"
                />
              )}
              <button
                type="button"
                aria-pressed={!!it.repeat}
                onClick={() => set(i, { repeat: it.repeat ? undefined : [fromKey(it.date).getDay()], start: it.start ?? 18 * 60 })}
                className={cn("pressable h-7 rounded-full px-2.5 text-[11.5px] font-semibold", it.repeat ? "bg-ink text-surface" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink")}
              >
                {it.repeat ? "✓ Va a tu rutina" : "¿Lo hacés rutina?"}
              </button>
              {it.repeat && (
                <span role="group" aria-label="Días que se repite" className="flex gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = it.repeat!.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d]}
                        onClick={() => {
                          const next = on ? it.repeat!.filter((x) => x !== d) : [...it.repeat!, d];
                          set(i, { repeat: next.length ? next : undefined });
                        }}
                        className={cn("pressable grid size-7 place-items-center rounded-full text-[11px] font-semibold", on ? "bg-[var(--q)] text-white" : "bg-surface text-ink-muted hover:text-ink")}
                      >
                        {"DLMMJVS"[d]}
                      </button>
                    );
                  })}
                </span>
              )}
            </span>
          )}
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
          rows={bar ? 1 : compact ? 2 : 5}
          placeholder={bar ? "Agregá algo dentro o fuera de tu rutina, como: «Mañana salgo a comer de 19 a 21 hs con amigos»" : "Hoy corrí 2 horas, cené con amigos y practiqué guitarra…"}
          aria-label={bar ? "Agregar a tu rutina o sumar algo fuera de tu rutina" : "¿Qué hiciste hoy?"}
          enterKeyHint="done"
          className={cn(
            "w-full resize-none border border-line bg-surface text-[13.5px] leading-relaxed placeholder:text-ink-faint focus:border-ink focus:outline-none",
            bar ? "h-10 overflow-hidden rounded-full py-[9px] pr-11 pl-4 whitespace-nowrap placeholder:text-[12px]" : "rounded-2xl px-3.5 py-2.5 pr-12",
          )}
        />
        <button
          type="submit"
          disabled={!items.length || missingTitle}
          aria-label="Guardar en mi diario"
          className={cn("pressable absolute grid place-items-center rounded-full bg-ink text-surface disabled:opacity-25", bar ? "top-1 right-1 size-8" : "right-2 bottom-2.5 size-9")}
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
            className="animate-fade-up fixed z-[85] flex max-h-[min(420px,60dvh)] flex-col gap-2 overflow-y-auto rounded-2xl border border-line bg-surface p-2.5 shadow-[var(--shadow-popover)]"
            style={
              // Al costado de la barra si hay lugar: así no tapa el calendario, donde se dibuja lo que escribís.
              bar && anchor.left > 400
                ? { left: anchor.left - 392, width: 380, bottom: window.innerHeight - anchor.bottom }
                : bar && anchor.bottom < window.innerHeight * 0.6
                ? { left: anchor.left, width: Math.max(anchor.width, 360), top: anchor.bottom + 8 }
                : { left: anchor.left, width: bar ? Math.min(anchor.width, 520) : anchor.width, bottom: window.innerHeight - anchor.top + 8 }
            }
          >
            <p className="px-0.5 text-[11.5px] font-semibold text-ink-muted">Esto se va a guardar (tocá + o Enter):</p>
            {cards}
          </div>,
          document.body,
        )}
      {!text && !compact && <p className="text-[11.5px] leading-snug text-ink-faint">Escribí como te salga: se reconoce qué suma a tu balde (Deporte, Mente y Espíritu, Hobbies, Intelecto y Cognitivo, Vínculos), cuánto duró y qué día fue.</p>}
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
  const [view, setView] = useState<"mes" | "anio">("mes");
  // Los puntos del gráfico: los días del mes elegido, o los meses de su año.
  const year = month.slice(0, 4);
  const lastDay = new Date(Number(year), Number(month.slice(5)), 0).getDate();
  const months =
    view === "mes"
      ? Array.from({ length: lastDay }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)
      : Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">{view === "mes" ? "Tu mes, día por día" : `Tu ${year}, mes por mes`}</p>
        <Segmented
          label="Período"
          value={view}
          onChange={setView}
          options={[
            { id: "mes", label: "Este mes" },
            { id: "anio", label: "El año" },
          ]}
          className="text-[11.5px]"
        />
      </div>
      {series.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">Cuando anotes cosas que suman a tu balde, acá vas a ver cómo crece cada grupo.</p>
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
            {months.map((m, i) =>
              view === "mes" ? (
                (i === 0 || (i + 1) % 5 === 0) && (
                  <text key={m} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">
                    {i + 1}
                  </text>
                )
              ) : (
                <text key={m} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fontWeight={m === month ? 700 : 400} fill={m === month ? "var(--color-ink)" : "var(--color-ink-muted)"}>
                  {MONTHS[Number(m.slice(5)) - 1].slice(0, 1).toUpperCase()}
                </text>
              ),
            )}
            {series.map((s) => (
              <g key={s.c} style={partStyle(s.c)}>
                <path d={s.vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--q)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
                {s.vals.map((v, i) => v > 0 && <circle key={i} cx={x(i)} cy={y(v)} r={view === "mes" ? 2.2 : 3} fill="var(--color-surface)" stroke="var(--q)" strokeWidth="2" />)}
              </g>
            ))}
          </svg>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {series.map((s) => (
              <li key={s.c} style={partStyle(s.c)} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <span aria-hidden className="h-[3px] w-3.5 rounded-full bg-[var(--q)]" />
                {catName(s.c)} <b className="font-semibold text-ink tabular-nums">{Math.round(s.vals.reduce((a, v) => a + v, 0) * 10) / 10} h</b>
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
            {/* El día contado como un cuento: lo que hiciste, en el color de su grupo; los hitos, subrayados. */}
            <p className="text-[15px] leading-[1.9] text-ink/85">
              {d.items.map((l, k) => (
                <span key={l.id}>
                  {k > 0 && (k === d.items.length - 1 ? " y " : ", ")}
                  <Phrase
                    logro={l}
                    milestone={story.milestones.has(l.id)}
                    onRemove={() => {
                      play("delete");
                      removeLogro(l.id);
                    }}
                  />
                </span>
              ))}
              .
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Una cosa del cuento, dentro del texto: en el color de su grupo (con sus horas); si es un hito, subrayada y
 * con estrella; si es una nota, en itálica. Al pasar el mouse, se puede borrar.
 */
function Phrase({ logro: l, milestone, onRemove }: { logro: Logro; milestone: boolean; onRemove: () => void }) {
  const cat = l.category && l.minutes > 0 ? l.category : null;
  const text = l.text.charAt(0).toLowerCase() + l.text.slice(1);
  return (
    <span style={cat ? partStyle(cat) : undefined} className="group/p relative">
      <span
        className={cn(
          "rounded-md px-1 py-0.5 box-decoration-clone",
          cat ? "bg-[var(--q-soft)] font-medium text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]" : "italic",
          milestone && "underline decoration-[var(--q,var(--color-ink))] decoration-2 underline-offset-[5px]",
        )}
      >
        {milestone && <Star aria-label="Hito" className="mr-0.5 inline size-3 -translate-y-px" fill="currentColor" />}
        {text}
        {cat && <span className="ml-1 text-[12px] font-normal opacity-80 tabular-nums">({durLabel(l.minutes)})</span>}
      </span>
      <button
        type="button"
        aria-label={`Borrar ${l.text}`}
        onClick={onRemove}
        className="absolute -top-2 -right-2 hidden size-5 place-items-center rounded-full bg-surface text-ink-faint shadow-sm group-hover/p:grid hover:text-danger focus-visible:grid"
      >
        <Trash2 aria-hidden className="size-3" />
      </button>
    </span>
  );
}

/**
 * Mi diario personal en el encabezado: un librito (abre el diario completo) y una barra para contar lo que
 * hiciste hoy. Lo que escribís se archiva en tu diario.
 */
export function HeaderDiary() {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <div data-module="diario" className="flex w-[300px] items-center gap-1.5 xl:w-[360px]">
      <button
        type="button"
        onClick={() => {
          play("paper");
          setOpen(true);
        }}
        aria-label="Abrir mi diario personal"
        title="Mi diario personal"
        className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-surface/80 text-ink shadow-[var(--shadow-card)] hover:bg-surface"
      >
        <BookOpen aria-hidden className="size-[18px]" />
      </button>
      <div className="min-w-0 flex-1">
        <DiaryComposer bar />
      </div>
      {open && <DiaryBook isMobile={!desktop} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** "Hoy saliste a caminar (1 h), llamaste a tu mamá…": las cosas de un día contadas como una frase. */
function daySentence(items: Logro[]) {
  const parts = items.map((l) => {
    const t = l.text.charAt(0).toLowerCase() + l.text.slice(1);
    return l.category && l.minutes > 0 ? `${t} (${durLabel(l.minutes)})` : t;
  });
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/**
 * Mi diario, como tablero: un librito comprimido con lo de hoy contado en una frase ("Hoy: saliste a
 * caminar…") y lo de ayer. Al abrirlo, el diario completo con la historia del mes.
 */
export function DiaryMini({ className }: { className?: string }) {
  const logros = usePlanner((s) => s.logros);
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const today = toKey(new Date());
  const yesterday = toKey(addDays(new Date(), -1));
  const hoy = logros.filter((l) => l.date === today);
  const ayer = logros.filter((l) => l.date === yesterday);
  const monthCount = logros.filter((l) => l.date.startsWith(today.slice(0, 7))).length;
  return (
    <section aria-labelledby="diary-mini-title" className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <h2 id="diary-mini-title" className="flex items-center gap-2 type-title">
          <BookOpen aria-hidden className="size-4 text-ink-muted" />
          Mi diario
        </h2>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => {
              play("paper");
              setOpen(true);
            }}
            className="pressable h-8 rounded-full px-3 text-[12px] font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            Abrir
          </button>
          <ModuleControls />
        </div>
      </header>
      <button
        type="button"
        onClick={() => {
          play("paper");
          setOpen(true);
        }}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-[color-mix(in_oklab,#fff7d6_55%,var(--color-surface))] px-4 py-3 text-left"
      >
        <p className="text-[13px] leading-relaxed text-ink/85">
          <b className="font-semibold">Hoy</b> {hoy.length ? `${daySentence(hoy)}.` : "todavía no anotaste nada. Contalo abajo de tu rutina."}
        </p>
        {ayer.length > 0 && (
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            <b className="font-semibold">Ayer</b> {daySentence(ayer)}.
          </p>
        )}
        <p className="mt-auto text-[11px] text-ink-faint">{monthCount ? `${monthCount} ${monthCount === 1 ? "cosa anotada" : "cosas anotadas"} este mes · tocá para leer tu historia` : "Tocá para abrir tu diario"}</p>
      </button>
      {open && <DiaryBook isMobile={!desktop} onClose={() => setOpen(false)} />}
    </section>
  );
}
