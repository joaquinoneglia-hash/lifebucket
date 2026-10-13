"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { SUGGESTED_ACTIVITIES } from "@/lib/activities";
import { guessQuadrant } from "@/lib/categorize";
import { cn, formatMinutes } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { partStyle } from "@/lib/mode";
import { QUADRANTS, type QuadrantId, QUADRANT_BY_ID, QUADRANT_HINT } from "@/lib/quadrants";
import { WEEK_ORDER, type RoutineBlock } from "@/lib/routine";
import { newId, usePlanner } from "@/lib/store";
import { formatTime } from "@/lib/time";
import { QuadrantIcon } from "../QuadrantIcon";
import { GhostButton, PrimaryButton, Select, Sheet } from "../ui";

const DAY_LETTER: Record<number, { short: string; name: string }> = {
  1: { short: "L", name: "lunes" },
  2: { short: "M", name: "martes" },
  3: { short: "M", name: "miércoles" },
  4: { short: "J", name: "jueves" },
  5: { short: "V", name: "viernes" },
  6: { short: "S", name: "sábado" },
  0: { short: "D", name: "domingo" },
};
/** De 05:00 a 24:00, de a media hora. */
const TIMES = Array.from({ length: 39 }, (_, i) => 5 * 60 + i * 30);
/** Libre no se agenda: es lo que sobra. */
const PICKABLE = QUADRANTS.filter((q) => q.id !== "libre");

/** Sumar o cambiar un bloque de tu semana tipo: qué es, qué días, a qué hora y cuánto dura. */
export function BlockEditor({
  block,
  day,
  start,
  onSave,
  onDelete,
  onClose,
  quadrants,
  minutes: initialMinutes,
  draft,
}: {
  /** Un bloque nuevo precargado (por ejemplo, desde la configuración guiada: "Trabajo", de lunes a viernes). */
  draft?: { name: string; quadrant: QuadrantId; days: number[]; lock?: boolean; guided?: boolean };
  /** Duración inicial al crear (p. ej. la franja que arrastraste). */
  minutes?: number;
  /** Qué categorías se pueden elegir (por defecto, todas menos Libre). */
  quadrants?: QuadrantId[];
  block?: RoutineBlock;
  day: number;
  start: number;
  onSave: (b: RoutineBlock) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const pickable = draft?.lock ? QUADRANTS.filter((q) => q.id === draft.quadrant) : quadrants ? QUADRANTS.filter((q) => quadrants.includes(q.id) || q.id === block?.quadrant) : PICKABLE;
  const [quadrant, setQuadrant] = useState<QuadrantId>(block?.quadrant ?? draft?.quadrant ?? pickable[0]?.id ?? "cuerpo");
  const [name, setName] = useState(block?.name ?? draft?.name ?? "");
  // La categoría se elige sola según lo que escribís, hasta que la elijas vos a mano.
  const routine = usePlanner((s) => s.routine);
  const [manual, setManual] = useState(!!block || !!draft);
  const [suggested, setSuggested] = useState<QuadrantId | null>(null);
  const write = (text: string) => {
    setName(text);
    if (manual) return;
    const g = guessQuadrant(text, routine);
    const ok = g && pickable.some((q) => q.id === g) ? g : null;
    setSuggested(ok);
    if (ok) setQuadrant(ok);
  };
  // Lo que ya tenés en tu semana (sin repetir), para elegirlo de un toque.
  // Sugerencias: mientras escribís, lo que ya tenés en tu semana que empieza igual (como un predictivo); si
  // todavía no escribiste nada (por ejemplo, viniste de "Sumar deporte"), ideas de esa categoría.
  const [typed, setTyped] = useState(false);
  const q = name.trim().toLowerCase();
  const yours = typed && q
    ? [...new Map(routine.map((b) => [b.name, b])).values()].filter((b) => b.name.toLowerCase() !== q && b.name.toLowerCase().includes(q) && pickable.some((x) => x.id === b.quadrant)).slice(0, 6)
    : [];
  const ideas = !typed ? SUGGESTED_ACTIVITIES[quadrant].filter((n) => n.toLowerCase() !== q).slice(0, 6) : [];
  const [days, setDays] = useState<number[]>(block?.days ?? draft?.days ?? [day]);
  const [from, setFrom] = useState(block?.start ?? start);
  const [minutes, setMinutes] = useState(block?.minutes ?? initialMinutes ?? 60);
  const valid = name.trim() && days.length;

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="routine-block-title" width="max-w-[440px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave({ id: block?.id ?? newId(), quadrant, name: name.trim(), days, start: from, minutes });
        }}
        className="flex flex-col gap-4 p-5 sm:p-6"
      >
        <h2 id="routine-block-title" className="type-headline">
          {block ? "Cambiar bloque" : "Sumar a tu semana"}
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="routine-name" className="text-[12px] text-ink-muted">
            {block ? "¿Qué es?" : "¿Qué vas a agregar?"}
          </label>
          <input
            id="routine-name"
            data-autofocus
            value={name}
            onChange={(e) => {
              setTyped(true);
              write(e.target.value);
            }}
            placeholder="Gimnasio, trabajo, leer, almuerzo…"
            autoComplete="off"
            enterKeyHint="next"
            className="h-10 rounded-md border border-line bg-surface px-3 text-[14px] focus:border-ink focus:outline-none"
          />
          {!block && (yours.length > 0 || ideas.length > 0) && (
            <div className="flex flex-wrap items-center gap-1">
              {!yours.length && <span className="text-[11px] text-ink-faint">Ideas:</span>}
              {(yours.length ? yours.map((b) => ({ name: b.name, quadrant: b.quadrant })) : ideas.map((n) => ({ name: n, quadrant })))
                .map((it) => (
                  <button
                    key={it.name}
                    type="button"
                    onClick={() => {
                      setName(it.name);
                      setQuadrant(it.quadrant);
                      setSuggested(it.quadrant);
                    }}
                    style={partStyle(it.quadrant)}
                    className="pressable inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-sunken pr-2.5 pl-2 text-[12px] text-ink-muted hover:text-ink"
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-[var(--q)]" />
                    {it.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className={cn("flex flex-col gap-1.5", draft?.lock && "hidden")}>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            Categoría
            {suggested && !manual && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink">
                <Sparkles aria-hidden className="size-3" />
                Sugerida
              </span>
            )}
          </span>
          {/* Dos grupos: la base (lo estructural, en tonos oscuros) y el tiempo para vos (con color). */}
          <div role="radiogroup" aria-label="Parte de tu vida" className="flex flex-col gap-2">
            {[
              { title: "La base", ids: ["trabajo", "libre"] as QuadrantId[] },
              { title: "Tiempo para vos", ids: ["cuerpo", "interior", "alma", "mente", "vinculos"] as QuadrantId[] },
            ].map((g) => {
              const list = pickable.filter((q) => g.ids.includes(q.id));
              if (!list.length) return null;
              const base = g.title === "La base";
              return (
                <div key={g.title} className={cn("flex flex-col gap-1.5 rounded-xl p-2", base ? "bg-surface-sunken" : "bg-[color-mix(in_oklab,var(--color-success)_6%,transparent)]")}>
                  <span className="text-[10.5px] font-semibold tracking-wide text-ink-muted uppercase">
                    {g.title}
                    {base && <span className="font-normal tracking-normal normal-case"> · el sueño se configura con la luna</span>}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        role="radio"
                        aria-checked={quadrant === q.id}
                        onClick={() => {
                          setQuadrant(q.id);
                          setManual(true);
                        }}
                        style={partStyle(q.id)}
                        className={cn(
                          "pressable inline-flex h-8 items-center gap-1.5 rounded-full border pr-3 pl-1 text-[12.5px] font-medium transition-colors",
                          base
                            ? quadrant === q.id
                              ? "border-[var(--q)] bg-[var(--q)] text-white"
                              : "border-line bg-surface hover:bg-surface-sunken"
                            : quadrant === q.id
                              ? "border-[var(--q)] bg-[var(--q-soft)]"
                              : "border-line bg-surface hover:bg-surface-sunken",
                        )}
                      >
                        <span className={cn("grid size-6 place-items-center rounded-full", base ? "bg-[var(--q)] text-white" : "bg-[var(--q-soft)] text-[var(--q)]")}>
                          <QuadrantIcon id={q.id} className="size-3" />
                        </span>
                        {q.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11.5px] leading-snug text-ink-muted">
            <b className="font-semibold text-ink">{QUADRANT_BY_ID[quadrant].name}:</b> {QUADRANT_HINT[quadrant].charAt(0).toLowerCase() + QUADRANT_HINT[quadrant].slice(1)}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          {draft?.guided && <p className="rounded-lg bg-[color-mix(in_oklab,#d99a00_13%,transparent)] px-2.5 py-1.5 text-[11.5px] leading-snug text-[#8a6200]">👉 Tocá los días en que se repite (podés elegir varios, o «L a V» de un toque). Se repite todas las semanas.</p>}
          <span className="flex items-center justify-between text-[12px] text-ink-muted">
            ¿Qué días?
            <span className="flex gap-1">
              {[
                { label: "L a V", days: [1, 2, 3, 4, 5] },
                { label: "Finde", days: [6, 0] },
                { label: "Todos los días", days: [1, 2, 3, 4, 5, 6, 0] },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDays(p.days)}
                  className="pressable h-6 rounded-full bg-surface-sunken px-2 text-[11px] font-medium text-ink-muted hover:text-ink"
                >
                  {p.label}
                </button>
              ))}
            </span>
          </span>
          <div role="group" aria-label="Días" className="grid grid-cols-7 gap-1">
            {WEEK_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_LETTER[d].name}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                  className={cn(
                    "pressable h-9 rounded-md text-[13px] font-semibold",
                    on ? "bg-ink text-surface" : "bg-surface-sunken text-ink-muted hover:text-ink",
                  )}
                >
                  {DAY_LETTER[d].short}
                </button>
              );
            })}
          </div>
        </div>

        {draft?.guided && <p className="-mb-1 rounded-lg bg-[color-mix(in_oklab,#d99a00_13%,transparent)] px-2.5 py-1.5 text-[11.5px] leading-snug text-[#8a6200]">👉 Elegí a qué hora empieza («Desde») y a qué hora termina («Hasta»).</p>}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-muted">Desde</span>
            <Select
              label="Desde"
              value={String(from)}
              onChange={(v) => {
                const f = Number(v);
                setFrom(f);
                setMinutes((m) => Math.min(Math.max(30, m), 24 * 60 - f));
              }}
              options={TIMES.slice(0, -1).map((m) => ({ value: String(m), label: formatTime(m) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-muted">Hasta · {formatMinutes(minutes)}</span>
            <Select
              label="Hasta"
              value={String(from + minutes)}
              onChange={(v) => setMinutes(Number(v) - from)}
              options={TIMES.filter((m) => m > from).map((m) => ({ value: String(m), label: formatTime(m) }))}
            />
          </label>
        </div>

        <footer className="flex items-center justify-between gap-2 pt-1">
          {onDelete ? (
            <GhostButton danger onClick={onDelete}>
              <Trash2 aria-hidden className="size-4" />
              Sacar
            </GhostButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <GhostButton onClick={onClose}>Cancelar</GhostButton>
            <PrimaryButton type="submit" disabled={!valid}>
              {block ? "Guardar" : "Sumar"}
            </PrimaryButton>
          </div>
        </footer>
      </form>
    </Sheet>
  );
}
