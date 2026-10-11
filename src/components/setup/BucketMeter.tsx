import { cn } from "@/lib/format";

/** Las capas del balde, desde el fondo: lo que más pesa abajo. */
export type BucketFill = { dormir: number; trabajo: number; cuerpo: number; mente: number; alma: number };

const LAYERS: { key: keyof BucketFill; label: string; color: string }[] = [
  { key: "dormir", label: "Dormir", color: "var(--color-sleep)" },
  { key: "trabajo", label: "Trabajo", color: "var(--color-trabajo)" },
  { key: "cuerpo", label: "Cuerpo", color: "var(--color-cuerpo)" },
  { key: "mente", label: "Mente", color: "var(--color-mente)" },
  { key: "alma", label: "Alma", color: "var(--color-alma)" },
];

const WEEK = 168 * 60;
/** Silueta del balde: más ancho arriba que abajo. */
const SHAPE = "polygon(0 0, 100% 0, 86% 100%, 14% 100%)";

/**
 * El balde de tu semana (168 h) llenándose por capas a medida que configurás. Lo que queda vacío
 * es tu tiempo Libre. `compact` es la versión del encabezado; la grande es la del resumen.
 */
export function BucketMeter({ fill, compact = false, unit = "week" }: { fill: BucketFill; compact?: boolean; unit?: "week" | "month" }) {
  const pct = (m: number) => (m / WEEK) * 100;
  const used = LAYERS.reduce((acc, l) => acc + fill[l.key], 0);
  const full = Math.min(100, Math.round(pct(used)));
  const factor = unit === "month" ? 30.4 / 7 : 1;
  const hours = (m: number) => `${Math.round((m * factor) / 60)} h`;
  const size = compact ? { w: 46, h: 52 } : { w: 168, h: 190 };
  let bottom = 0;

  const bucket = (
    <div className="relative shrink-0" style={{ width: size.w, height: size.h + (compact ? 8 : 26) }} aria-hidden>
      {/* Manija */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-t-full border-ink"
        style={{ top: 0, width: size.w * 0.62, height: compact ? 14 : 48, borderWidth: compact ? 2.5 : 5, borderBottomWidth: 0 }}
      />
      <div className="absolute inset-x-0 bottom-0" style={{ height: size.h }}>
        {/* Cuerpo: borde (tinta) y adentro el agua por capas. */}
        <div className="absolute inset-0 bg-ink" style={{ clipPath: SHAPE }} />
        <div className="absolute bg-surface" style={{ inset: compact ? 2.5 : 5, clipPath: SHAPE }}>
          {LAYERS.map((l) => {
            const h = pct(fill[l.key]);
            const style = { bottom: `${bottom}%`, height: `${h}%`, background: l.color };
            bottom += h;
            return <div key={l.key} className="absolute inset-x-0 transition-[height,bottom] duration-500 ease-[var(--ease-out)]" style={style} />;
          })}
        </div>
        {/* Borde de arriba */}
        <div className="absolute -inset-x-1 top-0 rounded-full bg-ink" style={{ height: compact ? 5 : 10 }} />
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3" role="img" aria-label={`Tu balde: ${full}% lleno`}>
        {bucket}
        <div className="flex flex-col leading-tight">
          <span className="text-[18px] font-semibold tabular-nums">{full}%</span>
          <span className="text-[11px] text-ink-muted">de tu semana</span>
        </div>
        <ul className="hidden flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums 2xl:flex">
          {LAYERS.filter((l) => fill[l.key] > 0).map((l) => (
            <li key={l.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: l.color }} />
              <span className="text-ink-muted">{l.label}</span>
              <span className="font-semibold">{Math.round(pct(fill[l.key]))}%</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-ink-faint" />
            <span className="text-ink-muted">Libre</span>
            <span className="font-semibold">{100 - full}%</span>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:gap-10">
      {bucket}
      <ul className="flex flex-col gap-2 text-[14px] tabular-nums">
        {LAYERS.filter((l) => fill[l.key] > 0).map((l) => (
          <li key={l.key} className="flex items-center gap-2.5">
            <span className="size-3 rounded-sm" style={{ background: l.color }} />
            <span className="w-20 text-ink-muted">{l.label}</span>
            <span className="w-16 font-semibold">{hours(fill[l.key])}</span>
            <span className="text-ink-muted">{Math.round(pct(fill[l.key]))}%</span>
          </li>
        ))}
        <li className={cn("flex items-center gap-2.5 border-t border-line pt-2")}>
          <span className="size-3 rounded-sm border border-ink-faint" />
          <span className="w-20 text-ink-muted">Libre</span>
          <span className="w-16 font-semibold">{hours(Math.max(0, WEEK - used))}</span>
          <span className="text-ink-muted">{100 - full}%</span>
        </li>
      </ul>
    </div>
  );
}
