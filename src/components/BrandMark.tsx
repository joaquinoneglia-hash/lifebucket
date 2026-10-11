import { useId } from "react";
import { cn } from "@/lib/format";

/** Capas de agua desde el fondo del balde: cada parte de tu vida suma su color. */
const LAYERS = ["vinculos", "alma", "mente", "cuerpo"] as const;

/**
 * Isotipo de LifeBucket: un balde con agua en capas de colores (tus cuadrantes)
 * y una ola arriba. Grande, la ola se mueve despacio (se frena con reduced motion).
 */
export function BrandMark({ size = 32, animated = false }: { size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, "");
  const band = 5.2;
  const floor = 43;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 48 48" className="inline-block shrink-0">
      <defs>
        <clipPath id={`bucket-${id}`}>
          <path d="M9.5 17 H38.5 L35.4 40.6 Q35 43.5 32 43.5 H16 Q13 43.5 12.6 40.6 Z" />
        </clipPath>
      </defs>
      {/* Manija */}
      <path d="M13 17 C13 6.5, 35 6.5, 35 17" fill="none" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" />
      {/* Cuerpo del balde */}
      <path d="M9.5 17 H38.5 L35.4 40.6 Q35 43.5 32 43.5 H16 Q13 43.5 12.6 40.6 Z" fill="var(--color-surface)" />
      <g clipPath={`url(#bucket-${id})`}>
        {LAYERS.map((q, i) => (
          <rect key={q} x="0" y={floor - band * (i + 1)} width="48" height={band + 0.6} fill={`var(--color-${q})`} />
        ))}
        {/* La ola de arriba del agua */}
        <path
          className={cn(animated && "bucket-wave")}
          d={`M-24 ${floor - band * LAYERS.length} q6 -2.4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 v3 h-84 z`}
          fill="var(--color-cuerpo)"
        />
      </g>
      <path
        d="M9.5 17 H38.5 L35.4 40.6 Q35 43.5 32 43.5 H16 Q13 43.5 12.6 40.6 Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* Borde del balde */}
      <rect x="7.5" y="14.6" width="33" height="4" rx="2" fill="var(--color-ink)" />
    </svg>
  );
}
