import { cn } from "@/lib/format";
import { CHART_ORDER, QUADRANT_BY_ID, type QuadrantRecord } from "@/lib/quadrants";

export interface DistributionRow {
  label: string;
  /** Porcentajes por cuadrante (suman 100, o 0 si no hay datos). */
  values: QuadrantRecord<number>;
  empty?: string;
}

/**
 * "¿A dónde va tu 100%?": una barra al 100% por fila (objetivo, agendado, cumplido),
 * una debajo de la otra para comparar de un vistazo.
 */
export function DistributionBars({ rows, dark }: { rows: DistributionRow[]; dark?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const total = CHART_ORDER.reduce((acc, id) => acc + row.values[id], 0);
        return (
          <div key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
            <span className={cn("text-[12px] font-medium", dark ? "text-surface/70" : "text-ink-muted")}>{row.label}</span>
            {total === 0 ? (
              <div
                className={cn(
                  "flex h-8 items-center rounded-lg px-3 text-[12px]",
                  dark ? "bg-white/5 text-surface/50" : "bg-surface-sunken text-ink-muted",
                )}
              >
                {row.empty ?? "Sin datos"}
              </div>
            ) : (
              <div className="flex h-8 overflow-hidden rounded-lg" role="img" aria-label={`${row.label}: ${CHART_ORDER.map((id) => `${QUADRANT_BY_ID[id].name} ${Math.round(row.values[id])}%`).join(", ")}`}>
                {CHART_ORDER.map((id) => {
                  const v = (row.values[id] / total) * 100;
                  if (v <= 0) return null;
                  return (
                    <span
                      key={id}
                      title={`${QUADRANT_BY_ID[id].name}: ${Math.round(v)}%`}
                      className={cn(
                        "bar-fill flex h-full items-center justify-center overflow-hidden text-[11px] font-semibold text-white tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]",
                        // 2px de superficie entre tramos
                        dark ? "border-r-2 border-ink last:border-r-0" : "border-r-2 border-surface last:border-r-0",
                      )}
                      style={{ width: `${v}%`, background: `var(--color-${id})` }}
                    >
                      {v >= 9 && `${Math.round(v)}%`}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
