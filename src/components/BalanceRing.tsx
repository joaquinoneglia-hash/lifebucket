import type { ReactNode } from "react";
import { CHART_ORDER, type QuadrantId, type QuadrantRecord } from "@/lib/quadrants";

const GAP = 2;

interface Segment {
  id: QuadrantId;
  dash: number;
  offset: number;
}

function segments(values: QuadrantRecord<number>, circumference: number): Segment[] {
  const total = CHART_ORDER.reduce((acc, id) => acc + values[id], 0);
  const active = CHART_ORDER.filter((id) => values[id] > 0).length;
  const gap = active > 1 ? GAP : 0;
  let start = 0;
  return CHART_ORDER.map((id) => {
    const len = total > 0 ? (values[id] / total) * circumference : 0;
    const seg = { id, dash: Math.max(len - gap, 0), offset: -(start + gap / 2) };
    start += len;
    return seg;
  });
}

interface BalanceRingProps {
  /** Minutos agendados por cuadrante: definen el tamaño de cada tramo (la distribución). */
  planned: QuadrantRecord<number>;
  /** Minutos cumplidos: llenan cada tramo con color pleno. */
  done: QuadrantRecord<number>;
  /** El objetivo: aro exterior fino. */
  targets: QuadrantRecord<number>;
  size: number;
  thickness: number;
  label: string;
  focused?: QuadrantId | null;
  /** Sin aro de objetivo (para el isotipo). */
  hideTargets?: boolean;
  /** Sobre fondo oscuro. */
  dark?: boolean;
  children?: ReactNode;
}

/**
 * Tres capas en un anillo:
 * - aro exterior fino: tu objetivo;
 * - aro grueso en color suave: lo que agendaste (cómo repartiste tu 100%);
 * - el mismo tramo en color pleno: la parte que ya cumpliste.
 */
export function BalanceRing({
  planned,
  done,
  targets,
  size,
  thickness,
  label,
  focused = null,
  hideTargets = false,
  dark = false,
  children,
}: BalanceRingProps) {
  const c = size / 2;
  const outerR = c - 1;
  const innerR = hideTargets ? c - thickness / 2 : outerR - Math.max(3, thickness * 0.3) - thickness / 2;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;
  const planSegs = segments(planned, innerC);
  const dim = (id: QuadrantId) => (focused && focused !== id ? 0.3 : 1);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role={label ? "img" : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
      >
        <g transform={`rotate(-90 ${c} ${c})`} fill="none">
          {!hideTargets &&
            segments(targets, outerC).map((s) => (
              <circle
                key={`t-${s.id}`}
                className="ring-seg"
                cx={c}
                cy={c}
                r={outerR}
                stroke={`var(--color-${s.id})`}
                strokeOpacity={dark ? 0.6 : 0.45}
                strokeWidth={2}
                strokeDasharray={`${s.dash} ${outerC}`}
                strokeDashoffset={s.offset}
              />
            ))}
          <circle
            cx={c}
            cy={c}
            r={innerR}
            stroke={dark ? "rgba(255,255,255,0.08)" : "var(--color-surface-sunken)"}
            strokeWidth={thickness}
          />
          {/* Lo agendado: color suave. */}
          {planSegs.map((s) => (
            <circle
              key={`p-${s.id}`}
              className="ring-seg"
              cx={c}
              cy={c}
              r={innerR}
              stroke={`color-mix(in oklab, var(--color-${s.id}) ${dark ? 42 : 30}%, ${dark ? "var(--color-ink)" : "white"})`}
              strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${innerC}`}
              strokeDashoffset={s.offset}
              opacity={dim(s.id)}
            />
          ))}
          {/* Lo cumplido: llena el mismo tramo desde su inicio. */}
          {planSegs.map((s) => {
            const fill = planned[s.id] > 0 ? Math.min(1, done[s.id] / planned[s.id]) : 0;
            return (
              <circle
                key={`d-${s.id}`}
                className="ring-seg"
                cx={c}
                cy={c}
                r={innerR}
                stroke={`var(--color-${s.id})`}
                strokeWidth={thickness}
                strokeDasharray={`${s.dash * fill} ${innerC}`}
                strokeDashoffset={s.offset}
                opacity={dim(s.id)}
              />
            );
          })}
        </g>
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
      )}
    </div>
  );
}
