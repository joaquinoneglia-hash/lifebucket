"use client";

import { ChevronDown, Moon, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toKey } from "@/lib/dates";
import { cheer, lastCheerAt } from "@/lib/motivation";
import { play } from "@/lib/sfx";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { usePlanner } from "@/lib/store";
import { emptyMinutes, firstFreeSlot } from "@/lib/routine";
import { ACTIVE_PARTS, monthMinutes, partColor, thisMonday, weekMinutes } from "@/lib/week-shares";
import { ModuleControls } from "./Modules";
import { QuadrantIcon } from "./QuadrantIcon";
import { GoalsBoard } from "./GoalsBoard";
import { Segmented, Sheet } from "./ui";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const h = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;

/**
 * Tu Balde: tu semana (o tu mes) en partes, todas sobre el 100%: Sueño, Trabajo, Tareas cotidianas, el
 * tiempo para mí (un grupo que se abre para ver deporte, mente, hobbies…) y los espacios sin completar. Se
 * ordenan de mayor a menor; cuando lo tuyo sube un puesto, se festeja. El aviso compara lo tuyo con el
 * trabajo: menos de la mitad es grave; cerca, vas bien; si lo supera, ¡logro!
 */
export function BucketCard({ className }: { className?: string; showReport?: boolean }) {
  const routine = usePlanner((s) => s.routine);
  const logros = usePlanner((s) => s.logros);
  const sleep = usePlanner((s) => s.sleep);
  const sleepSet = usePlanner((s) => s.sleepSet);
  // El mes cuenta desde el día que configuraste la app.
  const startedAt = usePlanner((s) => s.startedAt);
  const [range, setRange] = useState<"semana" | "mes">("mes");
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const toggleOpen = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {}
  };

  const month = new Date().toISOString().slice(0, 7);
  // El mes entero: tu semana llevada a todos los días del mes (así el objetivo semanal se ve en el mes).
  const lastDay = toKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  const monthly = monthMinutes(routine, logros, sleep, month, startedAt, lastDay);
  const { minutes } = range === "semana" ? { minutes: weekMinutes(routine, logros, sleep) } : monthly;
  const emptyWeek = sleepSet ? emptyMinutes(routine, sleep) : 0;
  const empty = range === "semana" ? emptyWeek : emptyWeek * (monthly.days / 7);
  const mine = ACTIVE_PARTS.reduce((acc, p) => acc + minutes[p], 0);
  // Todo sobre el 100%: lo cargado más los espacios sin completar.
  const total = Math.max(1, minutes.sueno + minutes.trabajo + minutes.libre + mine + empty);
  // «No hago nada» va aparte de las tareas cotidianas (se guarda como cotidianas, marcado).
  const nadaWeek = routine.filter((b) => b.nada).reduce((acc, b) => acc + b.minutes * b.days.length, 0);
  const nada = Math.min(minutes.libre, range === "semana" ? nadaWeek : nadaWeek * (monthly.days / 7));
  const part = { sueno: minutes.sueno, trabajo: minutes.trabajo, libre: minutes.libre - nada, nada };
  const pct = (m: number) => Math.round((m / total) * 100);

  // Las filas, de mayor a menor (los espacios sin completar, siempre al final).
  type RowId = "sueno" | "trabajo" | "libre" | "nada" | "vos";
  const rows = (["sueno", "trabajo", "libre", "nada", "vos"] as RowId[])
    .filter((id) => id !== "nada" || nada > 0)
    .map((id) => ({ id, m: id === "vos" ? mine : part[id] }))
    .sort((a, b) => b.m - a.m);
  const vosRank = rows.findIndex((r) => r.id === "vos");
  // Cada vez que sumás tiempo para vos: sonido y un aviso (si no hubo otro más importante recién).
  const lastMine = useRef<{ m: number; range: string } | null>(null);
  useEffect(() => {
    const prev = lastMine.current;
    lastMine.current = { m: mine, range };
    if (!prev || prev.range !== range || mine <= prev.m + 1) return;
    const added = range === "semana" ? Math.round((mine - prev.m) / 30) / 2 : 0;
    const t = window.setTimeout(() => {
      if (Date.now() - lastCheerAt() > 400) cheer("mine", added >= 0.5 ? `+${String(added).replace(".", ",")} h de «Tiempo para mí» por semana. ¡Eso! 💪` : undefined, '[data-module="bucket"]');
    }, 60);
    return () => window.clearTimeout(t);
  }, [mine, range]);
  // Cuando lo tuyo sube un puesto: sonido y aviso (no al abrir la app).
  const lastRank = useRef<number | null>(null);
  useEffect(() => {
    if (lastRank.current !== null && vosRank < lastRank.current) {
      const passed = rows[vosRank + 1];
      cheer("allChecks", `¡Tu «Tiempo para mí» superó a ${passed ? ROW_LABEL[passed.id].toLowerCase() : "otra parte"}! 🎉`, '[data-module="bucket"]');
    }
    lastRank.current = vosRank;
  }, [vosRank]); // eslint-disable-line react-hooks/exhaustive-deps

  // El aviso: lo tuyo comparado con el trabajo.
  const ratio = minutes.trabajo ? mine / minutes.trabajo : mine > 0 ? 2 : 0;
  const level = minutes.trabajo === 0 && mine === 0 ? null : ratio >= 1 ? "logro" : ratio >= 0.5 ? "cerca" : "grave";
  const LEVEL = {
    grave: { text: `Tu «Tiempo para mí» no llega ni a la mitad de tu trabajo (${Math.round(ratio * 100)}%). Sumá algo para vos.`, cls: "bg-[color-mix(in_oklab,var(--color-danger)_10%,transparent)] text-[color-mix(in_oklab,var(--color-danger)_80%,var(--color-ink))]" },
    cerca: { text: `Estás cerquita de un buen balance entre lo tuyo y el trabajo: lo tuyo es el ${Math.round(ratio * 100)}% de tu trabajo.`, cls: "bg-[color-mix(in_oklab,#d99a00_14%,transparent)] text-[#8a6200]" },
    logro: { text: "¡Lograste el balance! Tu «Tiempo para mí» ya supera a tu trabajo.", cls: "bg-[color-mix(in_oklab,var(--color-success)_13%,transparent)] text-[color-mix(in_oklab,var(--color-success)_75%,var(--color-ink))]" },
  } as const;
  // El logro se festeja una vez por semana (o por mes), con papelitos.
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (level !== "logro") return;
    const key = `lb:balde-logro:${range === "semana" ? thisMonday() : month}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    setParty(true);
    play("fanfare");
    const t = window.setTimeout(() => setParty(false), 4500);
    return () => window.clearTimeout(t);
  }, [level, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const completar = () => {
    const slot = firstFreeSlot(routine, sleep);
    document.querySelector<HTMLElement>('[data-module="semana"]')?.scrollIntoView({ block: "nearest" });
    window.dispatchEvent(new CustomEvent("lb:add-block", { detail: { name: "", quadrant: "libre", days: [slot?.day ?? 1], start: slot?.start ?? 8 * 60, minutes: 60 } }));
  };

  // El trabajo se come lo tuyo (50% más o más): un fueguito que titila al lado de su %.
  const fire = minutes.trabajo > 0 && minutes.trabajo >= mine * 1.5;
  // La nota del balde: flota al lado del trabajo; se oculta (vuelve al día siguiente) pero no se borra.
  const today = toKey(new Date());
  const [noteHidden, setNoteHidden] = useState(() => {
    try {
      return localStorage.getItem(NOTE_KEY) === today;
    } catch {
      return false;
    }
  });
  const hideNote = (hide: boolean) => {
    setNoteHidden(hide);
    try {
      if (hide) localStorage.setItem(NOTE_KEY, today);
      else localStorage.removeItem(NOTE_KEY);
    } catch {}
  };
  const workRow = useRef<HTMLLIElement>(null);
  const [notePos, setNotePos] = useState<React.CSSProperties | null>(null);
  useEffect(() => {
    if (!level || noteHidden) return setNotePos(null);
    const place = () => {
      const row = workRow.current?.getBoundingClientRect();
      const card = workRow.current?.closest("section")?.getBoundingClientRect();
      if (!row || !card || !row.height) return setNotePos(null);
      const vw = window.innerWidth;
      // A la derecha del balde, a la altura del trabajo; si no entra, debajo de la fila.
      setNotePos(card.right + 290 < vw ? { left: card.right + 10, top: row.top - 6, width: 270 } : { left: card.left + 12, top: row.bottom + 6, width: card.width - 24 });
    };
    place();
    const t = window.setInterval(place, 400);
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", place);
    };
  }, [level, noteHidden]);

  const baseRow = (id: "sueno" | "trabajo" | "libre" | "nada") => (
    <li key={id} ref={id === "trabajo" ? workRow : undefined} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] tabular-nums", part[id] === 0 && "opacity-45")}>
      <span className="grid size-[20px] shrink-0 place-items-center rounded-full text-[11px] text-white" style={{ background: ROW_COLOR[id] }}>
        {id === "sueno" ? <Moon aria-hidden className="size-3" /> : id === "nada" ? "💤" : <QuadrantIcon id={id} className="size-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{ROW_LABEL[id]}</span>
      <span className="text-ink-muted">{h(part[id])}</span>
      {id === "trabajo" && fire && (
        <span aria-label="El trabajo se come tu tiempo" title="Tu trabajo es 50% más (o más) que tu «Tiempo para mí»" className="inline-block origin-bottom motion-safe:animate-[flame_1.1s_ease-in-out_infinite]">
          🔥
        </span>
      )}
      <span className="w-10 text-right font-semibold">{pct(part[id])}%</span>
      {id === "trabajo" && level && noteHidden && (
        <button type="button" onClick={() => hideNote(false)} aria-label="Ver la nota de tu balde" title="Ver la nota" className="pressable -mr-1 grid size-6 place-items-center rounded-full text-[12px] hover:bg-surface-sunken">
          💬
        </button>
      )}
    </li>
  );

  return (
    <section data-tour="bucket" aria-labelledby="bucket-title" className={cn("card relative flex min-h-0 flex-col gap-2.5 overflow-hidden px-4 pt-3 pb-3", className)}>
      <header className="flex items-center justify-between gap-2">
        <h2 id="bucket-title" className="type-title">
          Tu Balde
        </h2>
        <div className="flex items-center gap-1">
          <BaseAdjust />
          <Segmented
            label="Período"
            value={range}
            onChange={setRange}
            options={[
              { id: "semana", label: "Semana" },
              { id: "mes", label: MONTHS[Number(month.slice(5)) - 1].replace(/^./, (c) => c.toUpperCase()) },
            ]}
            className="text-[12px]"
          />
          <ModuleControls />
        </div>
      </header>

      <ul data-tour="balde-lista" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {rows.map((r) =>
          r.id === "vos" ? (
            <li key="vos" data-tour="balde-vos" className="rounded-xl border-[1.5px] border-transparent" style={{ background: VOS_BG }}>
              <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] tabular-nums">
                <span className="grid size-[20px] shrink-0 place-items-center rounded-full text-white" style={{ background: VOS_STRONG }}>
                  <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">Tiempo para mí</span>
                <span className="text-ink-muted">{h(mine)}</span>
                <span className="w-10 text-right font-bold">{pct(mine)}%</span>
              </button>
              {open && (
                <div className="px-2.5 pb-2">
                  <GoalsBoard minutes={minutes} weeks={range === "semana" ? 1 : monthly.days / 7} total={total} />
                </div>
              )}
            </li>
          ) : (
            baseRow(r.id)
          ),
        )}
        {empty > 0 && (
          <li>
            <button
              type="button"
              data-tour="balde-libres"
              onClick={completar}
              // Al pasar el mouse, se marcan en el calendario los espacios que faltan completar.
              onMouseEnter={() => window.dispatchEvent(new CustomEvent("lb:show-empty", { detail: true }))}
              onMouseLeave={() => window.dispatchEvent(new CustomEvent("lb:show-empty", { detail: false }))}
              onFocus={() => window.dispatchEvent(new CustomEvent("lb:show-empty", { detail: true }))}
              onBlur={() => window.dispatchEvent(new CustomEvent("lb:show-empty", { detail: false }))}
              title="Completarlos en tu rutina"
              className="pressable flex w-full items-center gap-2 rounded-lg border border-dashed border-ink/25 px-2.5 py-1.5 text-left text-[12.5px] tabular-nums hover:bg-surface-sunken"
            >
              <span className="size-[20px] shrink-0 rounded-full border-2 border-dashed border-ink/35" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="font-medium">Espacios libres sin completar</span>
                <span className="block text-[10.5px] text-ink-muted">Tocá para completarlos en tu rutina</span>
              </span>
              <span className="text-ink-muted">{h(empty)}</span>
              <span className="w-10 text-right font-semibold">{pct(empty)}%</span>
            </button>
          </li>
        )}
      </ul>

      {level &&
        notePos &&
        createPortal(
          <div role="status" style={notePos} className={cn("animate-fade-up fixed z-[55] flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 shadow-[var(--shadow-popover)] ring-1 ring-black/5", LEVEL[level].cls, "bg-surface")}>
            <div className={cn("absolute inset-0 -z-10 rounded-2xl", LEVEL[level].cls)} />
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[12.5px] leading-snug font-medium">{LEVEL[level].text}</p>
              <button type="button" onClick={() => hideNote(true)} aria-label="Ocultar la nota (vuelve mañana)" title="Ocultar (vuelve mañana)" className="pressable -mt-0.5 -mr-1.5 grid size-6 shrink-0 place-items-center rounded-full opacity-70 hover:bg-black/5 hover:opacity-100">
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
            {level !== "logro" && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("lb:add-block", { detail: { name: "", quadrant: "cuerpo", days: [2, 4], start: 1140, minutes: 60 } }))}
                className="pressable h-8 self-start rounded-full bg-ink px-3 text-[12px] font-semibold text-surface hover:bg-ink/90"
              >
                Sumar algo para vos
              </button>
            )}
          </div>,
          document.body,
        )}

      {party &&
        createPortal(
          <div role="status" className="pointer-events-none fixed inset-0 z-[150] grid place-items-center">
            <div aria-hidden className="absolute top-1/2 left-1/2">
              {Array.from({ length: 30 }, (_, k) => {
                const ang = (k / 30) * Math.PI * 2;
                const dist = 160 + (k % 4) * 45;
                return (
                  <span
                    key={k}
                    className="absolute h-3 w-1.5 animate-[spark_1.6s_ease-out_forwards] rounded-[2px]"
                    style={{ "--dx": `${Math.cos(ang) * dist}px`, "--dy": `${Math.sin(ang) * dist}px`, background: ["#2e9e63", "#8a5cf0", "#e3a008", "#e5508a", "#2563eb"][k % 5], animationDelay: `${(k % 5) * 70}ms` } as React.CSSProperties}
                  />
                );
              })}
            </div>
            <div className="animate-fade-up rounded-3xl bg-surface px-7 py-5 text-center shadow-[var(--shadow-popover)]">
              <p className="text-[30px]">🎉</p>
              <p className="mt-1 text-[18px] font-semibold">¡Lograste el balance!</p>
              <p className="mt-1 text-[13.5px] text-ink-muted">Tu «Tiempo para mí» supera a tu trabajo. Ese es el objetivo.</p>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

const OPEN_KEY = "lb:balde-vos-abierto";
const NOTE_KEY = "lb:balde-nota-oculta";
const ROW_LABEL = { sueno: "Sueño", trabajo: "Trabajo", libre: "Tareas cotidianas", nada: "No hago nada", vos: "Tiempo para mí" } as const;
// Sueño en azul, trabajo en negro, tareas cotidianas en gris.
const ROW_COLOR = { sueno: "#3b6fe0", trabajo: "#1f2329", libre: "#8a919c", nada: "#c3c8d0" } as const;

/** Ajustar la base desde el balde: abre una pantalla con el sueño, el trabajo y las tareas cotidianas para tocar cada uno. */
function BaseAdjust() {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <>
      <button
        type="button"
        data-tour="ajustar-base"
        onClick={() => setOpen(true)}
        className="pressable inline-flex h-6 items-center gap-1 rounded-full bg-surface px-2 text-[11px] font-semibold tracking-normal text-ink normal-case ring-1 ring-line hover:ring-ink"
      >
        <SlidersHorizontal aria-hidden className="size-3" />
        Ajustar
      </button>
      {/* Fuera del título (que va en mayúsculas): en el body. */}
      {open && createPortal(<BaseEditor isMobile={!desktop} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function BaseEditor({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const routine = usePlanner((s) => s.routine);
  const sleep = usePlanner((s) => s.sleep);
  const sleepSet = usePlanner((s) => s.sleepSet);
  const go = (fn: () => void) => {
    onClose();
    window.setTimeout(fn, 60);
  };
  const edit = (id: string) => go(() => window.dispatchEvent(new CustomEvent("lb:edit-block", { detail: { id } })));
  const add = (quadrant: "trabajo" | "libre", name: string, start: number, minutes: number) =>
    go(() => window.dispatchEvent(new CustomEvent("lb:add-block", { detail: { name, quadrant, days: [1, 2, 3, 4, 5], start, minutes } })));
  const section = (quadrant: "trabajo" | "libre", title: string, addLabel: string, addName: string, start: number, minutes: number) => {
    const blocks = routine.filter((b) => b.quadrant === quadrant).sort((x, y) => x.start - y.start);
    return (
      <section className="rounded-xl border border-line p-3">
        <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
          <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: partColor(quadrant) }}>
            <QuadrantIcon id={quadrant} className="size-3.5" />
          </span>
          {title}
        </p>
        {blocks.length ? (
          <ul className="flex flex-col gap-1">
            {blocks.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => edit(b.id)} className="pressable flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{b.name}</span>
                  <span className="text-[11px] text-ink-muted tabular-nums">
                    {[1, 2, 3, 4, 5, 6, 0].filter((d) => b.days.includes(d)).map((d) => DAY_LETTER[d]).join(" ")} · {hhmm(b.start)}–{hhmm(b.start + b.minutes)}
                  </span>
                  <span className="text-[11.5px] font-semibold text-ink-muted">Editar</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 text-[12px] text-ink-muted">Todavía no hay nada.</p>
        )}
        <button type="button" onClick={() => add(quadrant, addName, start, minutes)} className="pressable mt-1.5 inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-ink-muted ring-1 ring-line hover:text-ink hover:ring-ink">
          + {addLabel}
        </button>
      </section>
    );
  };
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="base-title" width="max-w-[520px]">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="base-title" className="type-headline">
              Tu base
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Lo que sostiene tu semana: sueño, trabajo y tareas cotidianas. Tocá lo que quieras cambiar.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <section className="rounded-xl border border-line p-3">
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-[var(--color-sleep)] text-white">
              <Moon aria-hidden className="size-3.5" />
            </span>
            Sueño
          </p>
          <button type="button" onClick={() => go(() => window.dispatchEvent(new Event("lb:open-sleep")))} className="pressable flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken">
            <span className="min-w-0 flex-1 text-[12px] text-ink-muted tabular-nums">
              {sleepSet ? (
                <>
                  Semana: {hhmm(sleep.weekday.bed)} a {hhmm(sleep.weekday.wake)} · Finde: {hhmm(sleep.weekend.bed)} a {hhmm(sleep.weekend.wake)}
                </>
              ) : (
                "Sin configurar"
              )}
            </span>
            <span className="text-[11.5px] font-semibold text-ink-muted">Cambiar horarios</span>
          </button>
        </section>
        {section("trabajo", "Trabajo", "Sumar trabajo", "Trabajo", 540, 480)}
        {section("libre", "Tareas cotidianas", "Sumar tarea cotidiana", "", 780, 60)}
      </div>
    </Sheet>
  );
}

// Tiempo para mí, multicolor como el fondo de la app (el verde es de Deporte): un fondo suave y el borde con
// el degradé.
const VOS_STRONG = "linear-gradient(135deg, #5b8def, #9b7bf0 40%, #ec6fa5 75%, #f5a36b)";
const VOS_BG = `linear-gradient(120deg, color-mix(in oklab, #96bef5 22%, var(--color-surface)), color-mix(in oklab, #c4b0f5 22%, var(--color-surface)) 40%, color-mix(in oklab, #faaacd 22%, var(--color-surface)) 75%, color-mix(in oklab, #ffc8aa 24%, var(--color-surface))) padding-box, ${VOS_STRONG} border-box`;
