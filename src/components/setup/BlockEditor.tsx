"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
const FOR_YOU: QuadrantId[] = ["cuerpo", "interior", "alma", "mente", "vinculos"];

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
  onPreview,
}: {
  /**
   * Un bloque nuevo precargado (por ejemplo, desde la configuración guiada: "Trabajo", de lunes a viernes).
   * En la guía trae su propia pregunta como título y el ejemplo del nombre.
   */
  draft?: { name: string; quadrant: QuadrantId; days: number[]; lock?: boolean; guided?: boolean; title?: string; placeholder?: string; kicker?: string; subtitle?: string };
  /** Mientras lo armás, cómo quedaría (para dibujarlo en el calendario). */
  onPreview?: (b: RoutineBlock | null) => void;
  /** Duración inicial al crear (p. ej. la franja que arrastraste). */
  minutes?: number;
  /** Qué categorías se pueden elegir (por defecto, todas menos Libre). */
  quadrants?: QuadrantId[];
  block?: RoutineBlock;
  day: number;
  start: number;
  /** Uno, o varios si se eligió un horario distinto para algunos días. */
  onSave: (b: RoutineBlock | RoutineBlock[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const pickable = draft?.lock ? QUADRANTS.filter((q) => q.id === draft.quadrant) : quadrants ? QUADRANTS.filter((q) => quadrants.includes(q.id) || q.id === block?.quadrant) : PICKABLE;
  const [quadrant, setQuadrant] = useState<QuadrantId>(block?.quadrant ?? draft?.quadrant ?? pickable[0]?.id ?? "cuerpo");
  const [name, setName] = useState(block?.name ?? draft?.name ?? "");
  // «No hago nada»: un rato libre (se guarda como tareas cotidianas, marcado aparte).
  const [nada, setNada] = useState(!!block?.nada);
  // La categoría se elige sola según lo que escribís, hasta que la elijas vos a mano.
  const routine = usePlanner((s) => s.routine);
  const [manual, setManual] = useState(!!block || !!draft);
  const [, setSuggested] = useState<QuadrantId | null>(null);
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
  // Distinto horario según el día: cada día con su desde y hasta.
  const [perDay, setPerDay] = useState<Record<number, { from: number; minutes: number }> | null>(null);
  const togglePerDay = () => setPerDay(perDay ? null : Object.fromEntries(days.map((d) => [d, { from, minutes }])));
  useEffect(() => {
    onPreview?.(days.length ? { id: block?.id ?? "preview", quadrant, name: name.trim() || "…", days, start: from, minutes } : null);
  }, [quadrant, name, days, from, minutes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPreview?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const desktop = useMediaQuery("(min-width: 1024px)");

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="routine-block-title" width="max-w-[440px]" side={!!draft?.guided && desktop}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          if (perDay && !block) {
            // Se agrupan los días con el mismo horario en un bloque.
            const groups = new Map<string, number[]>();
            for (const d of days) {
              const t = perDay[d] ?? { from, minutes };
              const k = `${t.from}-${t.minutes}`;
              groups.set(k, [...(groups.get(k) ?? []), d]);
            }
            onSave([...groups].map(([k, ds]) => ({ id: newId(), quadrant, ...(nada ? { nada: true } : {}), name: name.trim(), days: ds, start: Number(k.split("-")[0]), minutes: Number(k.split("-")[1]) })));
            return;
          }
          onSave({ id: block?.id ?? newId(), quadrant, ...(nada ? { nada: true } : {}), name: name.trim(), days, start: from, minutes });
        }}
        className="flex flex-col gap-4 p-5 sm:p-6"
      >
        {draft?.kicker && !block && <p data-guided-editor className="-mb-2 text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase">{draft.kicker}</p>}
        <h2 id="routine-block-title" className="type-headline">
          {block ? "Cambiar bloque" : (draft?.title ?? "Sumar a tu semana")}
        </h2>


        <div className="flex flex-col gap-1.5">
          <label htmlFor="routine-name" className="text-[12px] text-ink-muted">
            {block ? "¿Qué es?" : draft?.title ? "" : "¿Qué vas a agregar?"}
          </label>
          <input
            id="routine-name"
            data-autofocus
            value={name}
            onChange={(e) => {
              setTyped(true);
              write(e.target.value);
            }}
            placeholder={draft?.placeholder ?? "Gimnasio, trabajo, leer, almuerzo…"}
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
          {/* Arriba, lo de todos los días (Trabajo, Tareas cotidianas, No hago nada); abajo, el tiempo para vos. */}
          <div role="radiogroup" aria-label="Parte de tu vida" className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              {pickable
                .filter((q) => q.id === "trabajo" || q.id === "libre")
                .map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    role="radio"
                    aria-checked={quadrant === q.id && !nada}
                    onClick={() => {
                      setQuadrant(q.id);
                      setNada(false);
                      setManual(true);
                    }}
                    style={partStyle(q.id)}
                    className={cn(
                      "pressable inline-flex h-7 items-center gap-1 rounded-full border pr-2.5 pl-0.5 text-[12px] font-medium transition-colors",
                      quadrant === q.id && !nada ? "border-[var(--q)] bg-[var(--q)] text-white" : "border-line bg-surface hover:bg-surface-sunken",
                    )}
                  >
                    <span className="grid size-5.5 place-items-center rounded-full bg-[var(--q)] text-white">
                      <QuadrantIcon id={q.id} className="size-3" />
                    </span>
                    {q.name}
                  </button>
                ))}
              {!draft?.lock && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={nada}
                  onClick={() => {
                    setQuadrant("libre");
                    setNada(true);
                    setManual(true);
                    if (!name.trim()) setName("No hago nada");
                  }}
                  className={cn(
                    "pressable inline-flex h-7 items-center gap-1 rounded-full border pr-2.5 pl-0.5 text-[12px] font-medium transition-colors",
                    nada ? "border-ink/40 bg-ink/10" : "border-dashed border-ink/30 bg-surface hover:bg-surface-sunken",
                  )}
                >
                  <span className="grid size-5.5 place-items-center rounded-full border border-dashed border-ink/40 text-[11px]">💤</span>
                  No hago nada
                </button>
              )}
            </div>
            {pickable.some((q) => FOR_YOU.includes(q.id)) && (
              <div className="flex flex-col gap-1 rounded-xl p-1.5" style={{ background: "linear-gradient(120deg, color-mix(in oklab, #96bef5 16%, var(--color-surface)), color-mix(in oklab, #c4b0f5 16%, var(--color-surface)) 40%, color-mix(in oklab, #faaacd 16%, var(--color-surface)) 75%, color-mix(in oklab, #ffc8aa 18%, var(--color-surface)))" }}>
                <span className="px-1 text-[10.5px] font-semibold tracking-wide text-ink-muted uppercase">Tiempo para vos</span>
                <div className="flex flex-wrap gap-1">
                  {pickable
                    .filter((q) => FOR_YOU.includes(q.id))
                    .map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        role="radio"
                        aria-checked={quadrant === q.id}
                        onClick={() => {
                          setQuadrant(q.id);
                          setNada(false);
                          setManual(true);
                        }}
                        style={partStyle(q.id)}
                        className={cn(
                          "pressable inline-flex h-7 items-center gap-1 rounded-full border pr-2.5 pl-0.5 text-[12px] font-medium transition-colors",
                          quadrant === q.id ? "border-[var(--q)] bg-[var(--q-soft)]" : "border-line bg-surface hover:bg-surface-sunken",
                        )}
                      >
                        <span className="grid size-5.5 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                          <QuadrantIcon id={q.id} className="size-3" />
                        </span>
                        {q.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-[11.5px] leading-snug text-ink-muted">
            {nada ? (
              <>
                <b className="font-semibold text-ink">No hago nada:</b> un rato libre, sin nada que hacer. También es parte de tu semana.
              </>
            ) : (
              <>
                <b className="font-semibold text-ink">{QUADRANT_BY_ID[quadrant].name}:</b> {QUADRANT_HINT[quadrant].charAt(0).toLowerCase() + QUADRANT_HINT[quadrant].slice(1)}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">

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
                    // Los elegidos, en verde (que se note cuáles van).
                    on ? "bg-success text-white" : "bg-surface-sunken text-ink-muted hover:text-ink",
                  )}
                >
                  {DAY_LETTER[d].short}
                </button>
              );
            })}
          </div>
        </div>

        {perDay && !block ? (
          <div className="flex flex-col gap-1.5">
            {WEEK_ORDER.filter((d) => days.includes(d)).map((d) => {
              const t = perDay[d] ?? { from, minutes };
              const set = (p: Partial<{ from: number; minutes: number }>) => setPerDay({ ...perDay, [d]: { ...t, ...p } });
              return (
                <div key={d} className="grid grid-cols-[48px_1fr_1fr] items-center gap-2">
                  <span className="text-[12.5px] font-semibold">{DAY_LETTER[d].name.slice(0, 3)}</span>
                  <Select label={`Desde (${DAY_LETTER[d].name})`} value={String(t.from)} onChange={(v) => set({ from: Number(v), minutes: Math.min(Math.max(30, t.minutes), 24 * 60 - Number(v)) })} options={TIMES.slice(0, -1).map((m) => ({ value: String(m), label: formatTime(m) }))} />
                  <Select label={`Hasta (${DAY_LETTER[d].name})`} value={String(t.from + t.minutes)} onChange={(v) => set({ minutes: Number(v) - t.from })} options={TIMES.filter((m) => m > t.from).map((m) => ({ value: String(m), label: formatTime(m) }))} />
                </div>
              );
            })}
          </div>
        ) : (
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
        )}
        {!block && days.length > 1 && (
          <button type="button" onClick={togglePerDay} className="pressable -mt-1 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-muted ring-1 ring-line hover:bg-surface-sunken hover:text-ink">
            {perDay ? "Mismo horario todos los días" : "Personalizar horario por día"}
          </button>
        )}

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
              {block ? "Guardar" : draft?.kicker ? "Guardar y seguir" : "Sumar"}
            </PrimaryButton>
          </div>
        </footer>
      </form>
    </Sheet>
  );
}
