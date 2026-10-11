import { cn } from "@/lib/format";
import { QUADRANTS, quadrantStyle, type QuadrantId, type QuadrantRecord } from "@/lib/quadrants";
import { QuadrantIcon } from "../QuadrantIcon";

/** Cuerpo, mente y alma (alma suma lo vincular). */
const LIFE: QuadrantId[] = ["cuerpo", "mente", "alma"];
const BASE: QuadrantId[] = ["trabajo", "libre"];
const CHART_H = 132;

const h = (minutes: number) => {
  const v = Math.round((minutes / 60) * 2) / 2;
  return `${v.toLocaleString("es-AR")} h`;
};

/**
 * Tu semana contra otra (la de una persona promedio, o la de hoy contra la ideal) en columnas:
 * por cada parte de tu vida, dos barras lado a lado con la misma escala. Trabajo y Libre, que
 * son mucho más grandes, van abajo como números para no aplastar al resto.
 */
export function WeekCompare({
  mine: mineRaw,
  other: otherRaw,
  mineLabel = "Vos",
  otherLabel = "Promedio",
  /** "average": la otra es una referencia gris; "before": tu semana de antes (punteada). */
  variant = "average",
}: {
  mine: QuadrantRecord<number>;
  other: QuadrantRecord<number>;
  mineLabel?: string;
  otherLabel?: string;
  variant?: "average" | "before";
}) {
  const merge = (r: QuadrantRecord<number>) => ({ ...r, alma: r.alma + r.vinculos, vinculos: 0 });
  const mine = merge(mineRaw);
  const other = merge(otherRaw);
  const cols = LIFE;
  const max = Math.max(180, ...cols.flatMap((id) => [mine[id], other[id]]));
  const bar = (m: number) => Math.max(m > 0 ? 3 : 0, (m / max) * CHART_H);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-ink" />
          {mineLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-sm", variant === "average" ? "bg-ink-faint/60" : "border border-dashed border-ink-faint")} />
          {otherLabel}
        </span>
      </div>

      <div
        role="img"
        aria-label={cols.map((id) => `${QUADRANTS.find((q) => q.id === id)!.name}: ${mineLabel.toLowerCase()} ${h(mine[id])}, ${otherLabel.toLowerCase()} ${h(other[id])}`).join("; ")}
        className="grid gap-2 border-b border-line"
        style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
      >
        {cols.map((id) => (
          <div key={id} style={quadrantStyle(id)} className="flex items-end justify-center gap-1.5" aria-hidden>
            <Column value={mine[id]} height={bar(mine[id])} className="bg-[var(--q)]" strong />
            <Column
              value={other[id]}
              height={bar(other[id])}
              className={variant === "average" ? "bg-ink-faint/50" : "border border-b-0 border-dashed border-[color-mix(in_oklab,var(--q)_60%,transparent)] bg-[color-mix(in_oklab,var(--q-soft)_70%,transparent)]"}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
        {cols.map((id) => {
          const q = QUADRANTS.find((x) => x.id === id)!;
          const a = mine[id];
          const b = other[id];
          const ratio = b > 0 ? a / b : a > 0 ? Infinity : 1;
          const tag =
            Math.abs(a - b) < 30 ? "parejo" : ratio === Infinity ? "nuevo" : ratio >= 1.5 ? `${ratio.toLocaleString("es-AR", { maximumFractionDigits: 1 })}×` : a > b ? `+${h(a - b)}` : `−${h(b - a)}`;
          return (
            <div key={id} style={quadrantStyle(id)} className="flex flex-col items-center gap-1 text-center">
              <span className="flex items-center gap-1 text-[12px] font-medium">
                <QuadrantIcon id={id} className="size-3.5 text-[var(--q)]" />
                {q.name}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10.5px] font-semibold tabular-nums",
                  a > b + 29 ? "bg-[color-mix(in_oklab,var(--color-success)_14%,white)] text-success" : "bg-surface-sunken text-ink-muted",
                )}
              >
                {tag}
              </span>
            </div>
          );
        })}
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] tabular-nums">
        {BASE.map((id) => (
          <div key={id} style={quadrantStyle(id)} className="flex items-center gap-1.5">
            <QuadrantIcon id={id} className="size-3.5 text-[var(--q)]" />
            <dt className="text-ink-muted">{QUADRANTS.find((q) => q.id === id)!.name}</dt>
            <dd>
              <span className="font-semibold">{h(mine[id])}</span> <span className="text-ink-muted">/ {h(other[id])}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Column({ value, height, className, strong }: { value: number; height: number; className: string; strong?: boolean }) {
  return (
    <div className="flex w-full max-w-7 flex-col items-center justify-end gap-1" style={{ height: CHART_H + 18 }}>
      <span className={cn("text-[10.5px] tabular-nums", strong ? "font-semibold text-ink" : "text-ink-muted")}>{h(value)}</span>
      <div className="w-full rounded-t-[4px] transition-[height] duration-300 ease-[var(--ease-out)]" style={{ height }}>
        <div className={cn("size-full rounded-t-[4px]", className)} />
      </div>
    </div>
  );
}
