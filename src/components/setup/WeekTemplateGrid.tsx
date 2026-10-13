"use client";

import { GripVertical, Moon, Trash2 } from "lucide-react";
import { QuadrantIcon } from "../QuadrantIcon";
import { play, step } from "@/lib/sfx";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cn, formatMinutes } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { quadrantStyle } from "@/lib/quadrants";
import { partStyle } from "@/lib/mode";
import { awakeFor, WEEK_ORDER, type RoutineBlock } from "@/lib/routine";
import type { SleepSettings } from "@/lib/sleep";
import { formatTime } from "@/lib/time";
import { BlockEditor } from "./BlockEditor";

const DAY_SHORT: Record<number, string> = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 0: "Dom" };
const AXIS = 40;


/**
 * Tu semana tipo (sin fechas): siete columnas, lo despierto en ocre suave (es Libre hasta que
 * le pongas algo) y el sueño rayado. Detrás puede ir otra semana "fantasma" para comparar.
 * Tocás un hueco para sumar un bloque; tocás un bloque para cambiarlo o sacarlo.
 */
export function WeekTemplateGrid({
  template,
  sleep,
  onChange,
  ghost,
  height = 560,
  highlight,
  range,
  onCreateAt,
  onOpen,
  onDelete,
  onMove,
  onTrash,
  showSleep,
  fit,
  markToday,
  showGaps,
  onSleepClick,
  onSleepResize,
  extras,
  onExtraChange,
  onExtraDelete,
  previewDays,
}: {
  /** Soltar un bloque en el tacho de abajo (aparece mientras lo arrastrás). Quien usa la grilla pregunta qué borrar. */
  onTrash?: (block: RoutineBlock, day: number) => void;
  /** Que entre sí o sí en `height` (pantallas bajas): las filas pueden achicarse más de lo normal. */
  fit?: boolean;
  /** Rango fijo (minutos desde la medianoche); sin él, sale de tu sueño. Con rango fijo no se dibuja el sueño. */
  range?: [number, number];
  /** Si vienen, crear y abrir los maneja quien usa la grilla (en vez de la hoja propia). */
  onCreateAt?: (day: number, start: number, minutes?: number) => void;
  onOpen?: (block: RoutineBlock, day: number) => void;
  /** Tachito en cada bloque. */
  onDelete?: (block: RoutineBlock, day: number) => void;
  /** Mover (a otra hora u otro día) o estirar un bloque arrastrando. Quien usa la grilla decide el alcance. */
  onMove?: (block: RoutineBlock, fromDay: number, next: { day: number; start: number; minutes: number }) => void;
  /** Mostrar el sueño (rayado) aunque el rango sea fijo. */
  showSleep?: boolean;
  template: RoutineBlock[];
  sleep: SleepSettings;
  /** Sin onChange es solo para mirar. */
  onChange?: (t: RoutineBlock[]) => void;
  ghost?: RoutineBlock[];
  /** Alto disponible para la grilla: las filas se ajustan para que entre entera. */
  height?: number;
  /** Resaltar hoy y atenuar los días que ya pasaron de esta semana. */
  markToday?: boolean;
  /** Lo que anotaste en tu diario con hora, esta semana: se ve en su día como algo puntual (no se repite). */
  extras?: { id: string; day: number; start: number; minutes: number; name: string; quadrant: string; preview?: boolean }[];
  /** Mientras escribís algo sin hora: el día donde va a quedar, resaltado. */
  previewDays?: number[];
  /** Mover (a otra hora u otro día de esta semana) o estirar algo del diario. */
  onExtraChange?: (id: string, next: { day: number; start: number; minutes: number }) => void;
  /** Borrar algo del diario desde el calendario. */
  onExtraDelete?: (id: string) => void;
  /** Tocar la luna del sueño: abrir su configuración. */
  onSleepClick?: () => void;
  /** Estirar el sueño desde el calendario (a qué hora te levantás o te acostás ese día de la semana). */
  onSleepResize?: (dow: number, edge: "wake" | "bed", minutes: number) => void;
  /** Marcar (con un titileo suave) los huecos sin nada entre que te levantás y te acostás: la idea es llenarlo todo. */
  showGaps?: boolean;
  /** Ids recién agregados: aparecen con un destello. */
  highlight?: string[];
}) {
  // Hoy y los días que ya pasaron (la semana va de lunes a domingo).
  const todayDow = new Date().getDay();
  const isPast = (d: number) => WEEK_ORDER.indexOf(d) < WEEK_ORDER.indexOf(todayDow);
  // La hora de ahora (se actualiza cada minuto): una línea en hoy, y lo que ya pasó de hoy, atenuado.
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    if (!markToday) return;
    const t = window.setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60_000);
    return () => window.clearInterval(t);
  }, [markToday]);
  const windows = WEEK_ORDER.map((d) => awakeFor(d, sleep));
  const from = range ? range[0] : Math.floor(Math.min(...windows.map((w) => w.wake)) / 60) * 60;
  const to = range ? range[1] : Math.ceil(Math.max(...windows.map((w) => w.bed)) / 60) * 60;
  const editable = !!(onChange || onCreateAt);
  const slotAt = (clientY: number, el: HTMLElement, wake: number, bed: number) => slotAtImpl(clientY, el, from, row, wake, bed);
  const row = Math.max(fit ? 5 : 9, Math.min(24, (height - 32) / ((to - from) / 30)));
  // Columnas angostas (celular): el nombre de cada bloque va en varias líneas en vez de cortarse.
  const compact = useMediaQuery("(max-width: 639px)");
  const top = (m: number) => ((m - from) / 30) * row;
  const [editing, setEditing] = useState<{ block?: RoutineBlock; day: number; start: number } | null>(null);
  // Lo del diario: se arrastra (mover o estirar) y al tocarlo se abre un menú chiquito para borrarlo.
  type XDrag = { id: string; mode: "move" | "bottom"; x: number; y: number; colW: number; day0: number; start0: number; min0: number; day: number; start: number; minutes: number; moved: boolean };
  const [xDrag, setXDrag] = useState<XDrag | null>(null);
  const [xMenu, setXMenu] = useState<string | null>(null);
  const xStart = (e: React.PointerEvent<HTMLElement>, x: { id: string; day: number; start: number; minutes: number }, mode: XDrag["mode"]) => {
    if (!onExtraChange || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation();
    capture(e.currentTarget, e.pointerId);
    const colW = (e.currentTarget.closest("[data-day-col]") as HTMLElement | null)?.offsetWidth ?? 80;
    setXDrag({ id: x.id, mode, x: e.clientX, y: e.clientY, colW, day0: x.day, start0: x.start, min0: x.minutes, day: x.day, start: x.start, minutes: x.minutes, moved: false });
  };
  const xMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!xDrag) return;
    const dy = e.clientY - xDrag.y;
    const dx = e.clientX - xDrag.x;
    const moved = xDrag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 4;
    const dm = Math.round(((dy / row) * 30) / 15) * 15;
    if (xDrag.mode === "bottom") {
      setXDrag({ ...xDrag, moved, minutes: Math.max(15, Math.min(to - xDrag.start0, xDrag.min0 + dm)) });
      return;
    }
    const i = Math.max(0, Math.min(6, WEEK_ORDER.indexOf(xDrag.day0) + Math.round(dx / xDrag.colW)));
    const start = Math.max(from, Math.min(to - Math.min(xDrag.min0, to - from), xDrag.start0 + dm));
    setXDrag({ ...xDrag, moved, day: WEEK_ORDER[i], start });
  };
  const xEnd = () => {
    if (!xDrag) return;
    setXDrag(null);
    if (!xDrag.moved) return setXMenu((m) => (m === xDrag.id ? null : xDrag.id));
    if (xDrag.day !== xDrag.day0 || xDrag.start !== xDrag.start0 || xDrag.minutes !== xDrag.min0)
      onExtraChange?.(xDrag.id, { day: xDrag.day, start: xDrag.start, minutes: xDrag.minutes });
  };
  useEffect(() => {
    if (!xMenu) return;
    const close = (e: PointerEvent) => !(e.target as HTMLElement).closest(`[data-extra="${xMenu}"]`) && setXMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [xMenu]);
  // Crear arrastrando: apretás en un hueco y estirás hacia abajo o arriba.
  // `inside`: la selección empezó adentro de un bloque (si no se estira, es un clic: se abre ese bloque).
  const [sel, setSel] = useState<{ day: number; a: number; b: number; inside?: { block: RoutineBlock; y: number }; moved?: boolean } | null>(null);
  // Mover o estirar un bloque: dónde quedaría mientras arrastrás.
  type Drag = { block: RoutineBlock; fromDay: number; mode: "move" | "top" | "bottom"; x: number; y: number; colW: number; day: number; start: number; minutes: number; moved: boolean; overTrash?: boolean };
  const trashRef = useRef<HTMLDivElement>(null);
  /** ¿El dedo o el mouse está sobre el tacho? (con un margen, para que sea fácil acertarle) */
  const onTrashZone = (x: number, y: number) => {
    const r = trashRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 16 && x <= r.right + 16 && y >= r.top - 20 && y <= r.bottom + 12;
  };
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sleepDrag, setSleepDrag] = useState<{ d: number; edge: "wake" | "bed"; value: number; startY: number; start: number } | null>(null);
  // Al crear: el bloque nuevo queda marcado un momento (se ve que se llenó) y recién ahí se abre el detalle.
  const [pending, setPending] = useState<{ day: number; start: number; minutes: number } | null>(null);
  const create = (day: number, start: number, minutes: number) => {
    play("pop");
    setPending({ day, start, minutes });
    window.setTimeout(() => {
      setPending(null);
      if (onCreateAt) onCreateAt(day, start, minutes);
      else setEditing({ day, start });
    }, 480);
  };
  // La escalerita: un escalón por cada media hora que cambia mientras estirás o movés.
  const selLen = sel ? Math.abs(sel.b - sel.a) / 30 + 1 : 0;
  const selKey = sel?.moved ? `${sel.a}-${sel.b}` : "";
  useEffect(() => {
    if (selKey) step(selLen);
  }, [selKey, selLen]);
  const dragKey = drag?.moved && !drag.overTrash ? `${drag.day}-${drag.start}-${drag.minutes}` : "";
  const dragLen = drag ? drag.minutes / 30 : 0;
  useEffect(() => {
    if (dragKey) step(dragLen);
  }, [dragKey, dragLen]);
  /** La franja que se está marcando, moviendo o estirando (para marcarla en la columna de las horas). */
  const marked: [number, number] | null =
    drag?.moved && !drag.overTrash
      ? [drag.start, drag.start + drag.minutes]
      : sel && (sel.moved || !sel.inside)
        ? [Math.min(sel.a, sel.b), Math.max(sel.a, sel.b) + (sel.moved ? 30 : 60)]
        : pending
          ? [pending.start, pending.start + pending.minutes]
          : null;
  const justDragged = useRef(false);
  // En pantallas táctiles el dedo dentro del calendario hace lo mismo que el mouse (crear, mover, estirar):
  // no scrollea la página. Para scrollear queda la columna de horas y lo de afuera.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Respaldo para navegadores que no respetan touch-action (Safari de iPhone): el dedo en una columna nunca
    // arranca un scroll. Tocar y arrastrar siguen andando porque la grilla usa pointer events, no clics.
    const stop = (e: TouchEvent) => {
      if (e.cancelable && (e.target as HTMLElement).closest("[data-day-col]")) e.preventDefault();
    };
    el.addEventListener("touchstart", stop, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);
  const dragTo = (d: Drag, clientX: number, clientY: number): Drag => {
    const dm = Math.round((clientY - d.y) / row) * 30;
    const dd = d.mode === "move" ? Math.round((clientX - d.x) / d.colW) : 0;
    const idx = Math.max(0, Math.min(6, WEEK_ORDER.indexOf(d.fromDay) + dd));
    const b = d.block;
    let start = b.start;
    let minutes = b.minutes;
    if (d.mode === "move") start = Math.max(from, Math.min(to - b.minutes, b.start + dm));
    if (d.mode === "top") {
      start = Math.max(from, Math.min(b.start + b.minutes - 30, b.start + dm));
      minutes = b.start + b.minutes - start;
    }
    if (d.mode === "bottom") minutes = Math.max(30, Math.min(to - b.start, b.minutes + dm));
    const moved = d.moved || Math.abs(clientY - d.y) > 4 || Math.abs(clientX - d.x) > 4;
    return { ...d, day: WEEK_ORDER[idx], start, minutes, moved };
  };

  return (
    <div ref={rootRef} className="select-none [-webkit-touch-callout:none]" onContextMenu={(e) => editable && e.preventDefault()}>
      <div className="grid" style={{ gridTemplateColumns: `${AXIS}px repeat(7, minmax(0, 1fr))` }}>
        <div />
        {WEEK_ORDER.map((d) => (
          <div key={d} className="flex justify-center pb-1.5">
            {/* Hoy, resaltado. */}
            <span className={cn("rounded-full px-2 text-center text-[11.5px] font-medium", markToday && d === todayDow ? "bg-ink font-semibold text-surface" : "text-ink-muted", markToday && isPast(d) && "opacity-55")}>
              {DAY_SHORT[d]}
            </span>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `${AXIS}px repeat(7, minmax(0, 1fr))` }}>
        <div className="relative" style={{ height: top(to) }} aria-hidden>
          {/* Todas las horas, siempre (bien legibles). */}
          {Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60)
            .map((m) => (
              <span
                key={m}
                className={cn("absolute right-1.5 -translate-y-1/2 text-[10.5px] font-medium text-ink/75 tabular-nums transition-opacity", marked && "opacity-30")}
                style={{ top: Math.max(6, top(m)) }}
              >
                {formatTime(m)}
              </span>
            ))}
          {/* Como en Google Calendar: la franja que estás marcando, con su hora de inicio y de fin. */}
          {marked && (
            <>
              <span className="absolute right-0 left-1 rounded-l-md bg-ink/[0.08]" style={{ top: top(marked[0]), height: top(marked[1]) - top(marked[0]) }} />
              <span
                className="absolute right-0.5 z-[1] -translate-y-1/2 rounded-md bg-ink px-1 py-px text-[10px] font-semibold text-surface tabular-nums"
                style={{ top: Math.max(8, top(marked[0])) }}
              >
                {formatTime(marked[0])}
              </span>
              <span
                className="absolute right-0.5 z-[1] -translate-y-1/2 rounded-md bg-ink px-1 py-px text-[10px] font-semibold text-surface tabular-nums"
                style={{ top: Math.min(top(to) - 8, top(marked[1])) }}
              >
                {formatTime(marked[1])}
              </span>
            </>
          )}
        </div>
        {WEEK_ORDER.map((d, col) => {
          const base = range
            ? showSleep
              ? { wake: Math.max(from, windows[col].wake), bed: Math.min(to, windows[col].bed) }
              : { wake: from, bed: to }
            : windows[col];
          // Mientras estirás el sueño de este día, se ve en vivo.
          const wake = sleepDrag?.d === d && sleepDrag.edge === "wake" ? sleepDrag.value : base.wake;
          const bed = sleepDrag?.d === d && sleepDrag.edge === "bed" ? sleepDrag.value : base.bed;
          return (
            <div
              key={d}
              data-day-col
              className={cn("relative touch-none border-l border-line select-none", editable && "cursor-pointer", markToday && d === todayDow && "bg-ink/[0.035]")}
              style={{ height: top(to), ...(range ? hourLines(row) : {}) }}
              onPointerDown={(e) => {
                if (!editable || e.target !== e.currentTarget) return;
                if (e.pointerType === "mouse" && e.button !== 0) return;
                capture(e.currentTarget, e.pointerId);
                const m = slotAt(e.clientY, e.currentTarget, wake, bed);
                setSel({ day: d, a: m, b: m });
              }}
              onPointerMove={(e) => {
                if (!sel || sel.day !== d) return;
                setSel({ ...sel, b: slotAt(e.clientY, e.currentTarget, wake, bed), moved: sel.moved || (sel.inside ? Math.abs(e.clientY - sel.inside.y) > 4 : true) });
              }}
              onPointerUp={() => {
                if (!sel || sel.day !== d) return;
                // Clic adentro de un bloque, sin estirar: se abre ese bloque.
                if (sel.inside && !sel.moved) {
                  const blk = sel.inside.block;
                  setSel(null);
                  if (onOpen) onOpen(blk, d);
                  else setEditing({ block: blk, day: d, start: blk.start });
                  return;
                }
                const start = Math.min(sel.a, sel.b);
                const minutes = Math.abs(sel.b - sel.a) + 30;
                setSel(null);
                // Un clic sin estirar: una hora por defecto.
                const len = minutes <= 30 && !sel.moved ? Math.min(60, bed - start) : minutes;
                create(d, start, len);
              }}
              onPointerCancel={() => setSel(null)}
            >
              {/* Despierto = Libre hasta que lo llenes. */}
              {!range && <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-[color-mix(in_oklab,var(--color-libre-soft)_70%,transparent)]"
                style={{ top: top(wake), height: top(bed) - top(wake) }}
              />}
              {previewDays?.includes(d) && (
                <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] animate-pulse bg-[color-mix(in_oklab,var(--color-ink)_7%,transparent)] ring-2 ring-ink/25 ring-inset" />
              )}
              {/* Lo que anotaste en tu diario con hora (puntual, esta semana): borde punteado y una estrellita. */}
              {extras
                ?.map((x) => (xDrag?.id === x.id ? { ...x, day: xDrag.day, start: xDrag.start, minutes: xDrag.minutes } : x))
                .filter((x) => x.day === d && x.start + x.minutes > from && x.start < to)
                .map((x) => {
                  const a = Math.max(from, x.start);
                  const b = Math.min(to, x.start + Math.max(30, x.minutes));
                  const live = !!onExtraChange && !x.preview;
                  if (x.preview)
                    return (
                      <div
                        key={`p-${x.id}`}
                        aria-hidden
                        style={{ ...quadrantStyle(x.quadrant as never), top: top(a) + 1, height: top(b) - top(a) - 2 }}
                        className="animate-fade-up pointer-events-none absolute inset-x-[3px] z-[6] flex flex-col overflow-hidden rounded-[5px] border-2 border-dashed border-[var(--q)] bg-[color-mix(in_oklab,var(--q-soft)_92%,transparent)] px-1.5 py-0.5 shadow-[var(--shadow-popover)]"
                      >
                        <span className="truncate text-[10.5px] leading-tight font-semibold text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]">✎ {x.name || "Nuevo"}</span>
                        <span className="truncate text-[10px] leading-tight text-ink-muted tabular-nums">
                          <b className="font-semibold">{formatMinutes(x.minutes)}</b> · {formatTime(x.start)}–{formatTime(x.start + x.minutes)}
                        </span>
                      </div>
                    );
                  const dragging = xDrag?.id === x.id && xDrag.moved;
                  return (
                    <div
                      key={`x-${x.id}`}
                      data-extra={x.id}
                      title={xMenu ? undefined : `${x.name} · ${formatTime(x.start)}–${formatTime(x.start + x.minutes)} (de tu diario)`}
                      style={{ ...quadrantStyle(x.quadrant as never), top: top(a) + 1, height: top(b) - top(a) - 2 }}
                      onPointerDown={(e) => xStart(e, x, "move")}
                      onPointerMove={xMove}
                      onPointerUp={xEnd}
                      onPointerCancel={() => setXDrag(null)}
                      className={cn(
                        "group/x pointer-events-auto absolute inset-x-[5px] z-[3] flex touch-none flex-col rounded-[5px] border-2 border-dashed border-[var(--q)] bg-[color-mix(in_oklab,var(--q-soft)_85%,transparent)] px-1.5 py-0.5",
                        live && "cursor-grab active:cursor-grabbing",
                        dragging && "z-[8] shadow-[var(--shadow-popover)]",
                        xMenu === x.id && "z-[9]",
                      )}
                    >
                      <span className="truncate text-[10.5px] leading-tight font-semibold text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]">★ {x.name}</span>
                      {(dragging || top(b) - top(a) >= 30) && (
                        <span className="truncate text-[10px] leading-tight text-ink-muted tabular-nums">
                          <b className="font-semibold">{formatMinutes(x.minutes)}</b> · {formatTime(x.start)}–{formatTime(x.start + x.minutes)}
                        </span>
                      )}
                      {onExtraDelete && !dragging && (
                        <button
                          type="button"
                          aria-label={"Borrar " + x.name}
                          title="Borrar"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onExtraDelete(x.id)}
                          className="absolute top-0.5 right-0.5 hidden size-5 place-items-center rounded bg-surface/90 text-ink-muted group-hover/x:grid hover:text-danger"
                        >
                          <Trash2 aria-hidden className="size-3" />
                        </button>
                      )}
                      {live && <span aria-hidden onPointerDown={(e) => xStart(e, x, "bottom")} className="absolute inset-x-0 -bottom-1 h-2.5 cursor-ns-resize" />}
                      {xMenu === x.id && (
                        <div
                          className="animate-fade-up absolute top-full left-0 z-[20] mt-1 w-44 cursor-default rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[var(--shadow-popover)]"
                          onPointerDown={(e) => e.stopPropagation()}
                          onPointerUp={(e) => e.stopPropagation()}
                        >
                          <p className="truncate px-1.5 pt-0.5 text-[12px] font-semibold">{x.name}</p>
                          <p className="px-1.5 pb-1 text-[11px] text-ink-muted tabular-nums">
                            {formatTime(x.start)}–{formatTime(x.start + x.minutes)} · {formatMinutes(x.minutes)} · de tu diario
                          </p>
                          <p className="px-1.5 pb-1.5 text-[10.5px] leading-snug text-ink-faint">Arrastralo para moverlo; desde el borde de abajo, para estirarlo.</p>
                          {onExtraDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setXMenu(null);
                                onExtraDelete(x.id);
                              }}
                              className="pressable flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[12px] font-semibold text-danger hover:bg-danger/10"
                            >
                              <Trash2 aria-hidden className="size-3.5" />
                              Borrar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              {/* Hoy: una línea punteada en la hora actual. */}
              {markToday && d === todayDow && nowMin > from && nowMin < to && (
                <>
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[7] border-t-2 border-dashed border-danger" style={{ top: top(nowMin) }}>
                    <span className="absolute -top-[5px] -left-[4px] size-2 rounded-full bg-danger" />
                  </div>
                </>
              )}
              {/* Los huecos sin completar (de una hora o más): titilan para invitar a llenarlos. */}
              {showGaps &&
                (() => {
                  const busy = template.filter((b) => b.days.includes(d)).map((b) => [b.start, b.start + b.minutes] as const).sort((a, b) => a[0] - b[0]);
                  const gaps: [number, number][] = [];
                  let at = wake;
                  for (const [a, b] of busy) {
                    if (a > at) gaps.push([at, Math.min(a, bed)]);
                    at = Math.max(at, b);
                  }
                  if (bed > at) gaps.push([at, bed]);
                  return gaps
                    .filter(([a, b]) => b - a >= 60)
                    .map(([a, b]) => (
                      <div
                        key={`gap-${a}`}
                        aria-hidden
                        className="animate-gap pointer-events-none absolute inset-x-[3px] z-[1] rounded-[5px] border border-dashed border-[#d99a00]/60 bg-[color-mix(in_oklab,#d99a00_9%,transparent)]"
                        style={{ top: top(a) + 2, height: top(b) - top(a) - 4 }}
                      />
                    ));
                })()}
              {(!range || showSleep) && <SleepStripe style={{ top: 0, height: top(wake) }} onClick={onSleepClick} />}
              {(!range || showSleep) && <SleepStripe style={{ top: top(bed), height: top(to) - top(bed) }} onClick={onSleepClick} />}
              {/* Los bordes del sueño se estiran: a qué hora te levantás y a qué hora te acostás. */}
              {showSleep && onSleepResize &&
                (["wake", "bed"] as const).map((edge) => (
                  <div
                    key={edge}
                    role="separator"
                    aria-label={edge === "wake" ? "Estirar la hora de levantarte" : "Estirar la hora de acostarte"}
                    title={edge === "wake" ? "Arrastrá para cambiar a qué hora te levantás" : "Arrastrá para cambiar a qué hora te acostás"}
                    className="group/sl absolute inset-x-0 z-[8] h-3 -translate-y-1/2 cursor-ns-resize touch-none"
                    style={{ top: top(edge === "wake" ? wake : bed) }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      capture(e.currentTarget, e.pointerId);
                      const startY = e.clientY;
                      const start = edge === "wake" ? wake : bed;
                      setSleepDrag({ d, edge, value: start, startY, start });
                    }}
                    onPointerMove={(e) => {
                      if (!sleepDrag || sleepDrag.d !== d || sleepDrag.edge !== edge) return;
                      const dm = Math.round((e.clientY - sleepDrag.startY) / row) * 30;
                      const v = edge === "wake" ? Math.max(from, Math.min(bed - 60, sleepDrag.start + dm)) : Math.max(wake + 60, Math.min(to, sleepDrag.start + dm));
                      if (v !== sleepDrag.value) {
                        setSleepDrag({ ...sleepDrag, value: v });
                        step(Math.abs(v - sleepDrag.start) / 30);
                      }
                    }}
                    onPointerUp={() => {
                      if (!sleepDrag || sleepDrag.d !== d) return;
                      const done = sleepDrag;
                      setSleepDrag(null);
                      if (done.value !== done.start) onSleepResize(d, done.edge, done.value);
                    }}
                    onPointerCancel={() => setSleepDrag(null)}
                  >
                    <span className={cn("absolute inset-x-2 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#3b6fe0] opacity-0 transition-opacity group-hover/sl:opacity-100", sleepDrag?.d === d && sleepDrag.edge === edge && "opacity-100")} />
                    {sleepDrag?.d === d && sleepDrag.edge === edge && (
                      <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#3b6fe0] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums" style={{ top: edge === "wake" ? 8 : -20 }}>
                        {formatTime(sleepDrag.value)}
                      </span>
                    )}
                  </div>
                ))}

              {sel?.day === d && (sel.moved || !sel.inside) && (() => {
                // Mientras apretás sin estirar ya se ve la hora que se va a crear.
                const a = Math.min(sel.a, sel.b);
                const b = Math.min(bed, Math.max(sel.a, sel.b) + (sel.moved ? 30 : 60));
                return (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[2px] z-[4] flex flex-col items-start rounded-[5px] border border-ink/40 bg-surface/90 px-1.5 pt-0.5 text-[10.5px] font-medium leading-tight tabular-nums"
                    style={{ top: top(a) + 1, height: ((b - a) / 30) * row - 2 }}
                  >
                    <b className="font-semibold">{formatMinutes(b - a)}</b>
                    <span className="text-ink-muted">{formatTime(a)}–{formatTime(b)}</span>
                  </div>
                );
              })()}
              {pending?.day === d && (
                <div
                  aria-hidden
                  className="animate-fill-in pointer-events-none absolute inset-x-[2px] z-[4] flex items-start rounded-[5px] border-2 border-ink bg-ink/[0.12] px-1.5 pt-0.5 text-[10.5px] font-semibold tabular-nums"
                  style={{ top: top(pending.start) + 1, height: (pending.minutes / 30) * row - 2 }}
                >
                  <b className="font-semibold">{formatMinutes(pending.minutes)}</b> · {formatTime(pending.start)}–{formatTime(pending.start + pending.minutes)}
                </div>
              )}

              {drag?.moved && !drag.overTrash && drag.day === d && (
                <div
                  aria-hidden
                  style={{ ...quadrantStyle(drag.block.quadrant), top: top(drag.start) + 1, height: (drag.minutes / 30) * row - 2 }}
                  className={cn(
                    "pointer-events-none absolute inset-x-[3px] z-[5] flex flex-col overflow-hidden rounded-[5px] border-2 border-[var(--q)] bg-[var(--q-soft)] shadow-[var(--shadow-lifted)]",
                    compact ? "px-[2px] py-px" : "px-1.5 py-0.5",
                  )}
                >
                  {compact ? (
                    <CompactLabel name={drag.block.name} minutes={drag.minutes} height={(drag.minutes / 30) * row - 2} />
                  ) : (
                    <>
                      <span className="truncate text-[11px] font-semibold">{drag.block.name}</span>
                      <span className="text-[10px] text-ink-muted tabular-nums">
                        <b className="font-semibold">{formatMinutes(drag.minutes)}</b> · {formatTime(drag.start)}–{formatTime(drag.start + drag.minutes)}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* La semana fantasma: contorno punteado, sin relleno. */}
              {ghost
                ?.filter((b) => b.days.includes(d))
                .map((b) => (
                  <div
                    key={`g-${b.id}`}
                    aria-hidden
                    style={{ ...quadrantStyle(b.quadrant), top: top(b.start) + 1, height: (b.minutes / 30) * row - 2 }}
                    className="pointer-events-none absolute inset-x-[2px] rounded-[5px] border border-dashed border-[color-mix(in_oklab,var(--q)_55%,transparent)] bg-[color-mix(in_oklab,var(--q-soft)_35%,transparent)]"
                  />
                ))}

              {template
                .filter((b) => b.days.includes(d))
                .map((b) => {
                  const h = (b.minutes / 30) * row - 2;
                  const px = (m: number) => (m / 30) * row;
                  const cuts = (extras ?? [])
                    .map((x) => (xDrag?.id === x.id ? { ...x, day: xDrag.day, start: xDrag.start, minutes: xDrag.minutes } : x))
                    .filter((x) => x.day === d)
                    .map((x) => [Math.max(0, x.start - b.start), Math.min(b.minutes, x.start + Math.max(30, x.minutes) - b.start)] as const)
                    .filter(([a, c]) => c > a)
                    .sort((p, q) => p[0] - q[0]);
                  const mask = cuts.length
                    ? `linear-gradient(to bottom, ${cuts.map(([a, c]) => `#000 ${px(a)}px, transparent ${px(a)}px, transparent ${px(c)}px, #000 ${px(c)}px`).join(", ")})`
                    : undefined;
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "group/block absolute inset-x-[3px] z-[2] touch-none",
                        // Los días que ya pasaron de la semana, atenuados.
                        // y, de hoy, solo las tarjetas que ya terminaron.
                        markToday && (isPast(d) || (d === todayDow && b.start + b.minutes <= nowMin)) && "opacity-50 saturate-50",
                        onCreateAt && "cursor-crosshair",
                        drag?.moved && drag.block.id === b.id && drag.fromDay === d && "opacity-30",
                      )}
                      style={{ top: top(b.start) + 1, height: h, ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}) }}
                      onPointerDown={(e) => {
                        if ((e.target as HTMLElement).closest("[data-trash]")) return;
                        if (e.pointerType !== "mouse") {
                          // Con el dedo: tocar abre; arrastrar mueve (o estira, si agarraste el borde de arriba o de abajo).
                          const r = e.currentTarget.getBoundingClientRect();
                          const edge = Math.min(14, r.height / 4);
                          const mode = !onMove ? null : e.clientY - r.top < edge ? "top" : r.bottom - e.clientY < edge ? "bottom" : "move";
                          capture(e.currentTarget, e.pointerId);
                          const colW = e.currentTarget.parentElement!.getBoundingClientRect().width;
                          if (mode) setDrag({ block: b, fromDay: d, mode, x: e.clientX, y: e.clientY, colW, day: d, start: b.start, minutes: b.minutes, moved: false });
                          else if (onOpen) onOpen(b, d);
                          return;
                        }
                        if (e.button !== 0) return;
                        const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle as "top" | "bottom" | "move" | undefined;
                        // Arrastrar adentro del bloque: marcar una franja para meter otro encima (el de abajo se corta).
                        if (!handle && onCreateAt) {
                          const column = e.currentTarget.parentElement!;
                          capture(column, e.pointerId);
                          const m = slotAt(e.clientY, column, wake, bed);
                          setSel({ day: d, a: m, b: m, inside: { block: b, y: e.clientY } });
                          return;
                        }
                        if (!onMove) return;
                        capture(e.currentTarget, e.pointerId);
                        const colW = e.currentTarget.parentElement!.getBoundingClientRect().width;
                        setDrag({ block: b, fromDay: d, mode: handle && handle !== "move" ? handle : "move", x: e.clientX, y: e.clientY, colW, day: d, start: b.start, minutes: b.minutes, moved: false });
                      }}
                      onPointerMove={(e) => {
                        if (!drag || drag.block.id !== b.id || drag.fromDay !== d) return;
                        const next = dragTo(drag, e.clientX, e.clientY);
                        setDrag({ ...next, overTrash: next.moved && drag.mode === "move" && onTrashZone(e.clientX, e.clientY) });
                      }}
                      onPointerUp={() => {
                        if (!drag || drag.block.id !== b.id || drag.fromDay !== d) return;
                        const done = drag;
                        setDrag(null);
                        // Soltado en el tacho: que elija qué eliminar.
                        if (done.overTrash && onTrash) {
                          justDragged.current = true;
                          onTrash(b, d);
                          return;
                        }
                        // Un clic sin arrastrar abre el bloque para editarlo.
                        if (!done.moved) {
                          if (onOpen) onOpen(b, d);
                          else setEditing({ block: b, day: d, start: b.start });
                          return;
                        }
                        justDragged.current = true;
                        if (done.day !== d || done.start !== b.start || done.minutes !== b.minutes) {
                          onMove?.(b, d, { day: done.day, start: done.start, minutes: done.minutes });
                        }
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                    {onMove && (
                      <>
                        <span data-handle="top" aria-hidden className="absolute inset-x-0 -top-0.5 z-[3] h-2 cursor-ns-resize" />
                        <span data-handle="bottom" aria-hidden className="absolute inset-x-0 -bottom-0.5 z-[3] h-2 cursor-ns-resize" />
                        {/* La franja de arriba (el título) también mueve el bloque. */}
                        <span data-handle="move" aria-hidden title="Arrastrá para mover" className="absolute inset-x-0 top-1.5 z-[3] cursor-grab active:cursor-grabbing" style={{ height: Math.max(0, Math.min(14, h / 2 - 6)) }} />
                        {/* Manija para mover (a otra hora u otro día). */}
                        <span
                          data-handle="move"
                          title="Arrastrá para mover"
                          aria-hidden
                          className="absolute top-0.5 left-0.5 z-[3] grid size-5 cursor-grab place-items-center rounded bg-surface/90 text-ink-muted opacity-0 shadow-sm group-hover/block:opacity-100 active:cursor-grabbing"
                        >
                          <GripVertical className="size-3.5" />
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={!onChange && !onOpen}
                      onClick={(e) => {
                        // Con mouse o con el dedo lo resuelve el puntero (abrir o arrastrar); acá queda el teclado.
                        if (onMove && e.detail !== 0) return;
                        if (justDragged.current) {
                          justDragged.current = false;
                          return;
                        }
                        if (onOpen) onOpen(b, d);
                        else setEditing({ block: b, day: d, start: b.start });
                      }}
                      title={`${b.name} · ${formatTime(b.start)}–${formatTime(b.start + b.minutes)}`}
                      aria-label={`${b.name}, ${DAY_SHORT[d]} ${formatTime(b.start)}, ${formatMinutes(b.minutes)}`}
                      style={partStyle(b.quadrant)}
                      className={cn(
                        "flex size-full flex-col overflow-hidden rounded-[5px] text-left",
                        compact ? "px-[3px]" : "px-1.5",
                        isBase(b.quadrant) ? "bg-[var(--q)] text-white" : "border border-[color-mix(in_oklab,var(--q)_25%,transparent)] bg-[var(--q-soft)]",
                        compact ? (h >= 14 ? "py-px" : "justify-center") : h >= 22 ? "py-0.5" : "justify-center",
                        (onChange || onOpen) && "pressable hover:brightness-[0.97]",
                        highlight?.includes(b.id) && "animate-fade-up",
                      )}
                    >
                      {compact ? (
                        <CompactLabel name={b.name} minutes={b.minutes} height={h} base={isBase(b.quadrant)} />
                      ) : (
                        <span className={cn("flex min-w-0 items-center gap-1 text-[11px] leading-tight font-semibold", isBase(b.quadrant) ? "text-white" : "text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]")}>
                          {isBase(b.quadrant) && <QuadrantIcon id={b.quadrant} className="size-3 shrink-0 opacity-90" />}
                          <span className="truncate">{b.name}</span>
                        </span>
                      )}
                      {!compact && h >= 30 && (
                        <span className={cn("truncate text-[10px] leading-tight tabular-nums", isBase(b.quadrant) ? "text-white/70" : "text-ink-muted")}>
                          <b className="font-semibold">{formatMinutes(b.minutes)}</b> · {formatTime(b.start)}–{formatTime(b.start + b.minutes)}
                        </span>
                      )}
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        data-trash
                        aria-label={`Borrar ${b.name}`}
                        title="Borrar"
                        onClick={() => onDelete(b, d)}
                        className="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full bg-surface/90 text-ink-muted opacity-0 shadow-sm group-hover/block:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:hidden"
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                    )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      {onTrash &&
        drag?.moved &&
        drag.mode === "move" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-[60] flex justify-center px-4 lg:bottom-8" aria-live="polite">
            <div
              ref={trashRef}
              className={cn(
                "animate-sheet-in flex h-14 items-center gap-2.5 rounded-full px-6 text-[14px] font-medium shadow-[var(--shadow-popover)] transition-[background-color,color,transform] duration-150",
                drag.overTrash ? "scale-105 bg-danger text-white" : "bg-ink text-surface",
              )}
            >
              <Trash2 aria-hidden className={cn("size-5 transition-transform duration-150", drag.overTrash && "-rotate-12")} />
              {drag.overTrash ? "Soltá para eliminar" : "Arrastrá acá para eliminar"}
            </div>
          </div>,
          document.body,
        )}

      {editing && onChange && (
        <BlockEditor
          block={editing.block}
          day={editing.day}
          start={editing.start}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            onChange(editing.block ? template.map((x) => (x.id === b.id ? b : x)) : [...template, b]);
            setEditing(null);
          }}
          onDelete={
            editing.block
              ? () => {
                  onChange(template.filter((x) => x.id !== editing.block!.id));
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** La base (lo estructural): Trabajo y Tareas cotidianas. Se dibuja oscura, con su ícono. */
const isBase = (q: string) => q === "trabajo" || q === "libre";

/** Captura el puntero para seguir el arrastre aunque salga del elemento (si el navegador no puede, se sigue igual). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {}
}

function slotAtImpl(clientY: number, el: HTMLElement, from: number, row: number, wake: number, bed: number) {
  const y = clientY - el.getBoundingClientRect().top;
  return Math.max(wake, Math.min(bed - 30, from + Math.floor(Math.max(0, y) / row) * 30));
}

/** El sueño: rayado y con una lunita (si entra) para que se entienda que ese horario es dormir. */
function SleepStripe({ style, onClick }: { style: CSSProperties; onClick?: () => void }) {
  const tall = typeof style.height === "number" && style.height >= 20;
  return (
    <div
      aria-hidden={!onClick}
      title="Durmiendo"
      className="pointer-events-none absolute inset-x-0 grid place-items-center"
      style={{
        ...style,
        backgroundImage:
          "repeating-linear-gradient(135deg, var(--color-sleep-soft) 0 5px, color-mix(in oklab, var(--color-sleep-soft) 50%, var(--color-surface)) 5px 10px)",
      }}
    >
      {tall &&
        (onClick ? (
          // Tocando la luna se abre la configuración del sueño.
          <button
            type="button"
            aria-label="Configurar el horario de sueño"
            title="Configurar el horario de sueño"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="pressable pointer-events-auto grid size-6 place-items-center rounded-full bg-[#3b6fe0] text-white shadow-sm hover:bg-[#2f5bc4]"
          >
            <Moon className="size-3.5" strokeWidth={2.2} />
          </button>
        ) : (
          <span className="grid size-5 place-items-center rounded-full bg-[#3b6fe0] text-white shadow-sm">
            <Moon className="size-3" strokeWidth={2.2} />
          </span>
        ))}
    </div>
  );
}

/** Líneas de hora suaves (para la grilla de rango fijo, sin el fondo de despierto). */
function hourLines(row: number): CSSProperties {
  return {
    backgroundImage: "linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)",
    backgroundSize: `100% ${row * 2}px`,
  };
}

const LINE = 10;

/**
 * El texto de un bloque en una columna angosta: el nombre en todas las líneas que entren (cortando
 * palabras si hace falta) y, si sobra lugar, el total de horas abajo (el horario se lee en la columna de horas).
 */
function CompactLabel({ name, minutes, height, base }: { name: string; minutes: number; height: number; base?: boolean }) {
  const room = Math.max(1, Math.floor((height - 2) / LINE));
  const showTime = room >= 3;
  const lines = Math.max(1, showTime ? room - 1 : room);
  return (
    <>
      <span
        lang="es"
        className={cn("text-[9.5px] font-semibold [overflow-wrap:anywhere] hyphens-auto", base ? "text-white" : "text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]")}
        style={{ lineHeight: `${LINE}px`, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}
      >
        {name}
      </span>
      {showTime && <span className={cn("mt-auto text-[9.5px] leading-[10px] font-semibold tabular-nums", base ? "text-white/70" : "text-ink-muted")}>{formatMinutes(minutes)}</span>}
    </>
  );
}
