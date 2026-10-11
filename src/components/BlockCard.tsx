"use client";

import { Repeat2, Trash2 } from "lucide-react";
import { cn, formatMinutes } from "@/lib/format";
import { isRoutine, quadrantStyle } from "@/lib/quadrants";
import { SIMPLE_MODE } from "@/lib/mode";
import type { Block } from "@/lib/store";
import { formatTimeRange } from "@/lib/time";

interface BlockFaceProps {
  block: Block;
  /** Alto en px: lo define la duración en la grilla. */
  height: number;
  lifted?: boolean;
  onOpen?: (id: string) => void;
  onToggleDone?: (id: string) => void;
  /** Borrado rápido (con deshacer). */
  onDelete?: (id: string) => void;
}

/**
 * La ficha del bloque. Según el alto disponible:
 * - 30 min: una sola línea (nombre + check).
 * - 1 h: nombre en una línea + horario.
 * - 2 h o más: nombre hasta en dos líneas (sin cortar palabras) + horario.
 * Si es angosta (dos bloques lado a lado), los botones van arriba y el texto abajo,
 * con todo el ancho, en lugar de cortarse al lado del check.
 */
export function BlockFace({
  block,
  height,
  lifted,
  onOpen,
  onToggleDone,
  onDelete,
}: BlockFaceProps) {
  const done = block.status === "done";
  const skipped = block.status === "skipped";
  const routine = isRoutine(block.quadrant);
  const compact = height < 34;
  const roomy = height >= 70;
  // 1 h con filas chicas: nombre y horario apretados para que no se pisen.
  const tight = !compact && height < 46;
  const range = formatTimeRange(block.start, block.minutes);

  return (
    <div
      style={{ ...quadrantStyle(block.quadrant), height }}
      className={cn(
        "group @container relative overflow-hidden rounded-md border",
        "transition-[background-color,opacity,box-shadow,transform] duration-150",
        // Trabajo y Libre son la base del día: planos, como el sueño, sin check.
        routine
          ? "border-transparent bg-[color-mix(in_oklab,var(--q-soft)_80%,transparent)]"
          : done
            ? "bg-[color-mix(in_oklab,var(--q-soft),var(--q)_20%)]"
            : "bg-[var(--q-soft)]",
        routine
          ? ""
          : skipped
          ? "border-dashed border-[color-mix(in_oklab,var(--q)_60%,transparent)] opacity-55"
          : "border-[color-mix(in_oklab,var(--q)_14%,transparent)]",
        lifted && "scale-[1.02] cursor-grabbing shadow-[var(--shadow-lifted)]",
      )}
    >
      <div
        className={cn(
          "flex h-full gap-1",
          compact || tight
            ? cn("items-center pr-0.5 pl-2", tight && "py-[3px]")
            : cn(
                "items-start pr-0.5 pl-2.5 @max-[104px]:flex-col-reverse @max-[104px]:gap-0 @max-[104px]:pt-0.5 @max-[104px]:pl-2",
                tight ? "py-[3px]" : "py-1",
              ),
        )}
      >
        <button
          type="button"
          title={`${block.title} · ${range}`}
          aria-label={`${block.title}, ${range}, ${formatMinutes(block.minutes)}${block.seriesId ? ", se repite" : ""}`}
          onClick={() => onOpen?.(block.id)}
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-1 flex-col justify-start self-stretch overflow-hidden rounded-sm text-left",
            tight ? "gap-0" : "gap-0.5",
          )}
        >
          <span
            className={cn(
              "font-medium [hyphens:none] [overflow-wrap:normal] [word-break:normal]",
              routine ? "text-[color-mix(in_oklab,var(--q)_70%,var(--color-ink))]" : "text-ink",
              tight
                ? "text-[12.5px] leading-[1.2]"
                : "text-[12.5px] leading-[1.3]",
              roomy ? "line-clamp-2" : "truncate",
              compact && "leading-none",
            )}
          >
            {block.title}
          </span>
          {!compact && (
            <span className="flex items-center gap-1 truncate text-[11px] leading-[1.25] tabular-nums @max-[104px]:text-[10.5px] text-[color-mix(in_oklab,var(--q)_55%,var(--color-ink))]">
              {range}
              {block.seriesId && (
                <Repeat2
                  aria-hidden
                  className="size-3 shrink-0"
                  strokeWidth={2}
                />
              )}
            </span>
          )}
        </button>

        <div
          className={cn(
            "flex shrink-0 items-center",
            compact || tight
              ? "@max-[104px]:hidden"
              : "@max-[104px]:-mb-0.5 @max-[104px]:self-end",
          )}
        >
          {/* Tachito: aparece al pasar el mouse (en pantallas táctiles se borra desde la edición). */}
          {onDelete && !lifted && (
            <button
              type="button"
              aria-label={`Borrar ${block.title}`}
              title="Borrar"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(block.id);
              }}
              className={cn(
                "pressable grid size-6 shrink-0 place-items-center rounded-full text-[color-mix(in_oklab,var(--q)_60%,var(--color-ink))] hover:bg-surface/80 hover:text-danger",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden",
                compact && "-my-1",
              )}
            >
              <Trash2 aria-hidden className="size-3.5" />
            </button>
          )}

          {/* Libre no se "cumple": no lleva check. */}
          {!routine && !SIMPLE_MODE && (
            <button
              type="button"
              aria-pressed={done}
              aria-label={
                done
                  ? `Desmarcar ${block.title}`
                  : `Marcar ${block.title} como cumplido`
              }
              onClick={() => onToggleDone?.(block.id)}
              className={cn(
                "pressable grid size-6 shrink-0 place-items-center rounded-full",
                compact && "-my-1",
              )}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full border-[1.5px] transition-colors duration-150",
                  done
                    ? "animate-check-pop border-[var(--q)] bg-[var(--q)]"
                    : "border-[color-mix(in_oklab,var(--q)_45%,transparent)] bg-surface/80 group-hover:border-[var(--q)]",
                )}
              >
                {done && (
                  <svg aria-hidden viewBox="0 0 12 12" className="size-2.5">
                    <path
                      d="M2.5 6.2l2.3 2.3 4.7-4.9"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
