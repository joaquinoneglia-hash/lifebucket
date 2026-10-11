"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { cn, formatMinutes } from "@/lib/format";
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
  showSleep,
}: {
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
  /** Ids recién agregados: aparecen con un destello. */
  highlight?: string[];
}) {
  const windows = WEEK_ORDER.map((d) => awakeFor(d, sleep));
  const from = range ? range[0] : Math.floor(Math.min(...windows.map((w) => w.wake)) / 60) * 60;
  const to = range ? range[1] : Math.ceil(Math.max(...windows.map((w) => w.bed)) / 60) * 60;
  const editable = !!(onChange || onCreateAt);
  const slotAt = (clientY: number, el: HTMLElement, wake: number, bed: number) => slotAtImpl(clientY, el, from, row, wake, bed);
  const row = Math.max(9, Math.min(24, (height - 32) / ((to - from) / 30)));
  const top = (m: number) => ((m - from) / 30) * row;
  const [editing, setEditing] = useState<{ block?: RoutineBlock; day: number; start: number } | null>(null);
  // Crear arrastrando: apretás en un hueco y estirás hacia abajo o arriba.
  // `inside`: la selección empezó adentro de un bloque (si no se estira, es un clic: se abre ese bloque).
  const [sel, setSel] = useState<{ day: number; a: number; b: number; inside?: { block: RoutineBlock; y: number }; moved?: boolean } | null>(null);
  // Mover o estirar un bloque: dónde quedaría mientras arrastrás.
  type Drag = { block: RoutineBlock; fromDay: number; mode: "move" | "top" | "bottom"; x: number; y: number; colW: number; day: number; start: number; minutes: number; moved: boolean };
  const [drag, setDrag] = useState<Drag | null>(null);
  const justDragged = useRef(false);
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
    <div className="select-none">
      <div className="grid" style={{ gridTemplateColumns: `${AXIS}px repeat(7, minmax(0, 1fr))` }}>
        <div />
        {WEEK_ORDER.map((d) => (
          <div key={d} className="pb-1.5 text-center text-[11.5px] font-medium text-ink-muted">
            {DAY_SHORT[d]}
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `${AXIS}px repeat(7, minmax(0, 1fr))` }}>
        <div className="relative" style={{ height: top(to) }} aria-hidden>
          {Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60)
            .filter((_, i) => row >= 14 || i % 2 === 0)
            .map((m) => (
              <span key={m} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-ink-muted tabular-nums" style={{ top: Math.max(6, top(m)) }}>
                {formatTime(m)}
              </span>
            ))}
        </div>
        {WEEK_ORDER.map((d, col) => {
          const { wake, bed } = range
            ? showSleep
              ? { wake: Math.max(from, windows[col].wake), bed: Math.min(to, windows[col].bed) }
              : { wake: from, bed: to }
            : windows[col];
          return (
            <div
              key={d}
              className={cn("relative touch-none border-l border-line select-none", editable && "cursor-pointer")}
              style={{ height: top(to), ...(range ? hourLines(row) : {}) }}
              onPointerDown={(e) => {
                if (!editable || e.target !== e.currentTarget || e.pointerType !== "mouse" || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
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
                const len = minutes <= 30 ? Math.min(60, bed - start) : minutes;
                if (onCreateAt) onCreateAt(d, start, len);
                else setEditing({ day: d, start });
              }}
              onPointerCancel={() => setSel(null)}
              onClick={(e) => {
                // En pantallas táctiles, tocar crea (con mouse lo resuelve el arrastre).
                if (!editable || e.target !== e.currentTarget || (e.nativeEvent as PointerEvent).pointerType === "mouse") return;
                const start = slotAt(e.clientY, e.currentTarget, wake, bed);
                if (onCreateAt) onCreateAt(d, start);
                else setEditing({ day: d, start });
              }}
            >
              {/* Despierto = Libre hasta que lo llenes. */}
              {!range && <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-[color-mix(in_oklab,var(--color-libre-soft)_70%,transparent)]"
                style={{ top: top(wake), height: top(bed) - top(wake) }}
              />}
              {(!range || showSleep) && <SleepStripe style={{ top: 0, height: top(wake) }} />}
              {(!range || showSleep) && <SleepStripe style={{ top: top(bed), height: top(to) - top(bed) }} />}

              {sel?.day === d && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[2px] z-[4] flex items-start rounded-[5px] border border-ink/40 bg-surface/90 px-1.5 pt-0.5 text-[10.5px] font-medium tabular-nums"
                  style={{ top: top(Math.min(sel.a, sel.b)) + 1, height: ((Math.abs(sel.b - sel.a) + 30) / 30) * row - 2 }}
                >
                  {formatTime(Math.min(sel.a, sel.b))}–{formatTime(Math.max(sel.a, sel.b) + 30)}
                </div>
              )}

              {drag?.moved && drag.day === d && (
                <div
                  aria-hidden
                  style={{ ...quadrantStyle(drag.block.quadrant), top: top(drag.start) + 1, height: (drag.minutes / 30) * row - 2 }}
                  className="pointer-events-none absolute inset-x-[3px] z-[5] flex flex-col overflow-hidden rounded-[5px] border-2 border-[var(--q)] bg-[var(--q-soft)] px-1.5 py-0.5 shadow-[var(--shadow-lifted)]"
                >
                  <span className="truncate text-[11px] font-semibold">{drag.block.name}</span>
                  <span className="text-[10px] text-ink-muted tabular-nums">
                    {formatTime(drag.start)}–{formatTime(drag.start + drag.minutes)}
                  </span>
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
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "group/block absolute inset-x-[3px] z-[2] touch-none",
                        onCreateAt && "cursor-crosshair",
                        drag?.moved && drag.block.id === b.id && drag.fromDay === d && "opacity-30",
                      )}
                      style={{ top: top(b.start) + 1, height: h }}
                      onPointerDown={(e) => {
                        if (e.pointerType !== "mouse" || e.button !== 0) return;
                        if ((e.target as HTMLElement).closest("[data-trash]")) return;
                        const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle as "top" | "bottom" | "move" | undefined;
                        // Arrastrar adentro del bloque: marcar una franja para meter otro encima (el de abajo se corta).
                        if (!handle && onCreateAt) {
                          const column = e.currentTarget.parentElement!;
                          column.setPointerCapture(e.pointerId);
                          const m = slotAt(e.clientY, column, wake, bed);
                          setSel({ day: d, a: m, b: m, inside: { block: b, y: e.clientY } });
                          return;
                        }
                        if (!onMove) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const colW = e.currentTarget.parentElement!.getBoundingClientRect().width;
                        setDrag({ block: b, fromDay: d, mode: handle && handle !== "move" ? handle : "move", x: e.clientX, y: e.clientY, colW, day: d, start: b.start, minutes: b.minutes, moved: false });
                      }}
                      onPointerMove={(e) => drag && drag.block.id === b.id && drag.fromDay === d && setDrag(dragTo(drag, e.clientX, e.clientY))}
                      onPointerUp={() => {
                        if (!drag || drag.block.id !== b.id || drag.fromDay !== d) return;
                        const done = drag;
                        setDrag(null);
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
                        // Con mouse lo resuelve el puntero (abrir o arrastrar); acá queda el teclado y el toque.
                        if (onMove && e.detail !== 0 && (e.nativeEvent as PointerEvent).pointerType === "mouse") return;
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
                        "flex size-full flex-col overflow-hidden rounded-[5px] px-1.5 text-left",
                        b.quadrant === "trabajo"
                          ? "bg-[color-mix(in_oklab,var(--q-soft)_92%,transparent)]"
                          : b.quadrant === "libre"
                            ? "border border-[color-mix(in_oklab,var(--q)_35%,transparent)] bg-[var(--q-soft)]"
                            : "border border-[color-mix(in_oklab,var(--q)_25%,transparent)] bg-[var(--q-soft)]",
                        h >= 22 ? "py-0.5" : "justify-center",
                        (onChange || onOpen) && "pressable hover:brightness-[0.97]",
                        highlight?.includes(b.id) && "animate-fade-up",
                      )}
                    >
                      <span className={cn("truncate text-[11px] leading-tight font-semibold", b.quadrant === "libre" ? "text-ink-muted" : "text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]")}>
                        {b.name}
                      </span>
                      {h >= 30 && (
                        <span className="truncate text-[10px] leading-tight text-ink-muted tabular-nums">
                          {formatTime(b.start)}–{formatTime(b.start + b.minutes)}
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

function slotAtImpl(clientY: number, el: HTMLElement, from: number, row: number, wake: number, bed: number) {
  const y = clientY - el.getBoundingClientRect().top;
  return Math.max(wake, Math.min(bed - 30, from + Math.floor(Math.max(0, y) / row) * 30));
}

function SleepStripe({ style }: { style: CSSProperties }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0"
      style={{
        ...style,
        backgroundImage:
          "repeating-linear-gradient(135deg, var(--color-sleep-soft) 0 5px, color-mix(in oklab, var(--color-sleep-soft) 50%, var(--color-surface)) 5px 10px)",
      }}
    />
  );
}

/** Líneas de hora suaves (para la grilla de rango fijo, sin el fondo de despierto). */
function hourLines(row: number): CSSProperties {
  return {
    backgroundImage: "linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)",
    backgroundSize: `100% ${row * 2}px`,
  };
}
