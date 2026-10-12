"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { fromKey, startOfWeek, toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { partStyle as quadrantStyle } from "@/lib/mode";
import { usePlanner, type RoutineBlock } from "@/lib/store";
import { DAY_MINUTES, PARTS, weekMinutes, weekRangeLabel, WEEK_MINUTES, type Part } from "@/lib/week-shares";
import { SleepCard } from "./SleepMeter";
import { isLate, kindColor, TASK_KINDS } from "./TasksPanel";

const DAYS: { dow: number; short: string; name: string }[] = [
  { dow: 1, short: "L", name: "Lunes" },
  { dow: 2, short: "M", name: "Martes" },
  { dow: 3, short: "M", name: "Miércoles" },
  { dow: 4, short: "J", name: "Jueves" },
  { dow: 5, short: "V", name: "Viernes" },
  { dow: 6, short: "S", name: "Sábado" },
  { dow: 0, short: "D", name: "Domingo" },
];
/** Lo que va en el calendario día por día (Vínculos no: son momentos del mes; Libre tampoco, aplastaría al resto). */
const DAILY: Part[] = ["trabajo", "cuerpo", "mente", "alma"];

const partOf = (b: RoutineBlock): Part | null =>
  b.quadrant === "vinculos" ? "alma" : b.quadrant === "trabajo" || b.quadrant === "cuerpo" || b.quadrant === "mente" || b.quadrant === "alma" ? b.quadrant : null;
const h = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;
const color = (p: Part) => (p === "libre" ? "#aab1be" : p === "sueno" ? "var(--color-sleep)" : `var(--color-${p})`);

/**
 * Resultados: tu semana en una torta (las seis partes), el sueño, la carga de cada día en líneas,
 * lo que más tiempo te lleva, el reporte semana a semana y cómo vienen tus objetivos del año.
 */
export function Dashboard() {
  const routine = usePlanner((s) => s.routine);
  const moments = usePlanner((s) => s.moments);
  const history = usePlanner((s) => s.routineHistory);
  const tasks = usePlanner((s) => s.tasks);

  const sleep = usePlanner((s) => s.sleep);
  const minutes = weekMinutes(routine, moments, sleep);

  // Cada día: cuánto de cada parte (Libre: lo que queda de las 19 h).
  const byDay = DAYS.map((d) => {
    const parts = { trabajo: 0, cuerpo: 0, mente: 0, alma: 0, vinculos: 0, libre: 0, sueno: 0 } as Record<Part, number>;
    for (const b of routine) {
      const p = partOf(b);
      if (p && b.days.includes(d.dow)) parts[p] += b.minutes;
    }
    parts.libre = Math.max(0, DAY_MINUTES - parts.trabajo - parts.cuerpo - parts.mente - parts.alma);
    return { ...d, parts };
  });

  const byName = new Map<string, { part: Part; minutes: number }>();
  for (const b of routine) {
    const p = partOf(b);
    if (!p) continue;
    const cur = byName.get(b.name) ?? { part: p, minutes: 0 };
    cur.minutes += b.minutes * b.days.length;
    byName.set(b.name, cur);
  }
  const top = [...byName.entries()].sort((a, b) => b[1].minutes - a[1].minutes).slice(0, 5);

  // Semana a semana: un punto por semana (si en una semana hubo varios cambios, vale el último).
  const weeks = groupByWeek(history);

  const year = new Date().getFullYear();
  const today = toKey(new Date());
  const yearTasks = tasks.filter((t) => t.month.startsWith(`${year}-`));
  const done = yearTasks.filter((t) => t.done).length;
  const late = yearTasks.filter((t) => isLate(t, today)).length;
  const pending = yearTasks.length - done - late;
  const byKind = TASK_KINDS.map((k) => {
    const list = yearTasks.filter((t) => (t.kind ?? "otro") === k.id);
    return { ...k, total: list.length, done: list.filter((t) => t.done).length, late: list.filter((t) => isLate(t, today)).length };
  }).filter((k) => k.total > 0);

  return (
    <div className="flex flex-col gap-5">
      <Card title="Tu semana">
        <div className="flex items-center gap-4">
          <Pie minutes={minutes} />
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {PARTS.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5 text-[12px] tabular-nums">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color(p.id) }} />
                <span className="min-w-0 flex-1 truncate">{p.id === "libre" ? "Libre" : p.label}</span>
                <span className="text-ink-muted">{h(minutes[p.id])}</span>
                <span className="w-9 text-right font-semibold">{Math.round((minutes[p.id] / WEEK_MINUTES) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <SleepCard />

      <Card title="Carga por día">
        <DailyLines days={byDay} />
      </Card>

      <Card title="Lo que más tiempo te lleva">
        {top.length ? (
          <ul className="flex flex-col gap-1.5">
            {top.map(([name, v]) => (
              <li key={name} style={quadrantStyle(v.part)} className="flex flex-col gap-0.5">
                <span className="flex justify-between gap-2 text-[12px]">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{h(v.minutes)}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <span className="block h-full rounded-full bg-[var(--q)]" style={{ width: `${(v.minutes / top[0][1].minutes) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Armá tu semana y acá ves qué te ocupa más tiempo.</Empty>
        )}
      </Card>

      <Card title="Semana a semana">
        {weeks.length >= 2 ? (
          <>
            <Evolution weeks={weeks} />
            <WeekTable weeks={weeks} />
          </>
        ) : (
          <Empty>
            Cada semana queda guardada. Desde la segunda vas a ver acá cómo cambió cada parte y la diferencia con la semana anterior.
          </Empty>
        )}
      </Card>

      <Card title={`Objetivos ${year}`}>
        {yearTasks.length ? (
          <>
            <p className="text-[13px] text-ink-muted">
              <span className="text-[22px] leading-none font-semibold text-ink tabular-nums">{done}</span> de {yearTasks.length} propuestos cumplidos
            </p>
            {/* Una sola barra: cumplidos, no cumplidos (vencidos) y los que todavía están en camino. */}
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              {done > 0 && <span className="h-full rounded-full bg-success" style={{ width: `${(done / yearTasks.length) * 100}%` }} />}
              {late > 0 && <span className="h-full rounded-full bg-danger/80" style={{ width: `${(late / yearTasks.length) * 100}%` }} />}
              {pending > 0 && <span className="h-full rounded-full bg-ink-faint/45" style={{ width: `${(pending / yearTasks.length) * 100}%` }} />}
            </div>
            <ul className="grid grid-cols-3 gap-2">
              <Legend color="var(--color-success)" label="Cumplidos" value={done} />
              <Legend color="var(--color-danger)" label="No cumplidos" value={late} />
              <Legend color="color-mix(in oklab, var(--color-ink-faint) 60%, transparent)" label="En camino" value={pending} />
            </ul>
          </>
        ) : (
          <Empty>Cuando cargues objetivos, acá ves cuántos cumpliste de los que te propusiste.</Empty>
        )}
      </Card>

      <Card title="Objetivos por tipo">
        {byKind.length ? (
          <ul className="flex flex-col gap-1.5">
            {byKind.map((k) => (
              <li key={k.id} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[12px]">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: kindColor(k.id) }} />
                  <span className="flex-1">{k.label}</span>
                  <span className="text-ink-muted tabular-nums">
                    <span className="font-semibold text-success">{k.done}</span> / {k.total}
                    {k.late > 0 && <span className="ml-1.5 font-semibold text-danger">{k.late} vencidos</span>}
                  </span>
                </span>
                <span className="flex h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <span className="h-full bg-success" style={{ width: `${(k.done / k.total) * 100}%` }} />
                  <span className="h-full bg-danger/70" style={{ width: `${(k.late / k.total) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Cuando cargues objetivos, acá ves cómo van por tipo.</Empty>
        )}
      </Card>
    </div>
  );
}

/** Una semana por punto: si una semana tiene varios registros (antes se guardaban por día), vale el último. */
function groupByWeek(history: { date: string; shares: Partial<Record<string, number>> }[]) {
  const map = new Map<string, Partial<Record<string, number>>>();
  for (const e of [...history].sort((a, b) => a.date.localeCompare(b.date))) map.set(toKey(startOfWeek(fromKey(e.date))), e.shares);
  return [...map.entries()].map(([week, shares]) => ({ week, shares })).slice(-12);
}

/** La torta de la semana: las seis partes, cada una con su color y 2px de separación. */
function Pie({ minutes }: { minutes: Record<Part, number> }) {
  const parts = PARTS.map((p) => ({ id: p.id, v: Math.max(0, minutes[p.id]) })).filter((p) => p.v > 0);
  const total = parts.reduce((acc, p) => acc + p.v, 0) || 1;
  const r = 50;
  let angle = -Math.PI / 2;
  return (
    <svg viewBox="-52 -52 104 104" className="size-32 shrink-0" role="img" aria-label={PARTS.map((p) => `${p.label} ${Math.round((minutes[p.id] / total) * 100)}%`).join(", ")}>
      {parts.length === 1 ? (
        <circle r={r} fill={color(parts[0].id)} />
      ) : (
        parts.map((p) => {
          const a0 = angle;
          const a1 = angle + (p.v / total) * Math.PI * 2;
          angle = a1;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
          return <path key={p.id} d={d} fill={color(p.id)} stroke="var(--color-surface)" strokeWidth={2} strokeLinejoin="round" />;
        })
      )}
    </svg>
  );
}

/** La carga de cada día como líneas: una por categoría, de lunes a domingo, en horas. */
function DailyLines({ days }: { days: { dow: number; short: string; name: string; parts: Record<Part, number> }[] }) {
  const W = 290;
  const H = 120;
  const max = Math.max(60, ...days.flatMap((d) => DAILY.map((p) => d.parts[p])));
  const x = (i: number) => 14 + (i / (days.length - 1)) * (W - 24);
  const y = (m: number) => H - 14 - (m / max) * (H - 26);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label="Horas por día de cada categoría">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1="12" x2={W - 6} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-line)" strokeDasharray={f ? "3 3" : undefined} />
            <text x="0" y={y(max * f) + 3} className="fill-ink-faint text-[8px] tabular-nums">
              {Math.round((max * f) / 60)}
            </text>
          </g>
        ))}
        {DAILY.map((p) => (
          <g key={p}>
            <polyline
              fill="none"
              stroke={color(p)}
              strokeWidth={p === "libre" ? 1.5 : 2}
              strokeDasharray={p === "libre" ? "4 3" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={days.map((d, i) => `${x(i)},${y(d.parts[p])}`).join(" ")}
            />
            {days.map((d, i) => (
              <circle key={d.dow} cx={x(i)} cy={y(d.parts[p])} r="2.2" fill={color(p)}>
                <title>{`${d.name} · ${PARTS.find((q) => q.id === p)!.label}: ${h(d.parts[p])}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {days.map((d, i) => (
          <text key={d.dow} x={x(i)} y={H - 2} textAnchor="middle" className="fill-ink-muted text-[9px] font-medium">
            {d.short}
          </text>
        ))}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        {DAILY.map((p) => (
          <li key={p} className="flex items-center gap-1">
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color(p) }} />
            {PARTS.find((q) => q.id === p)!.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El % de cada parte, semana a semana (una línea por parte). */
function Evolution({ weeks }: { weeks: { week: string; shares: Partial<Record<string, number>> }[] }) {
  const W = 290;
  const H = 96;
  const lines = PARTS.filter((p) => p.id !== "libre" && p.id !== "sueno");
  const max = Math.max(10, ...weeks.flatMap((w) => lines.map((p) => w.shares[p.id] ?? 0)));
  const x = (i: number) => 4 + (i / Math.max(1, weeks.length - 1)) * (W - 8);
  const y = (v: number) => H - 4 - (v / max) * (H - 12);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label="Evolución semana a semana">
        <line x1="0" x2={W} y1={H - 4} y2={H - 4} stroke="var(--color-line)" />
        {lines.map((p) => (
          <polyline
            key={p.id}
            fill="none"
            stroke={color(p.id)}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={weeks.map((w, i) => `${x(i)},${y(w.shares[p.id] ?? 0)}`).join(" ")}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-muted tabular-nums">
        <span>{weekRangeLabel(weeks[0].week)}</span>
        <span>{weekRangeLabel(weeks[weeks.length - 1].week)}</span>
      </div>
    </div>
  );
}

/** La tabla de las últimas semanas: el % de cada parte y cuánto cambió contra la semana anterior. */
function WeekTable({ weeks }: { weeks: { week: string; shares: Partial<Record<string, number>> }[] }) {
  const rows = weeks.slice(-6).reverse();
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[300px] text-[11px] tabular-nums">
        <thead>
          <tr className="text-ink-muted">
            <th className="py-1 pl-1 text-left font-medium">Semana</th>
            {PARTS.map((p) => (
              <th key={p.id} className="px-0.5 py-1 font-medium" title={p.label}>
                <span aria-hidden className="mx-auto block size-2 rounded-full" style={{ background: color(p.id) }} />
                <span className="sr-only">{p.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const prev = weeks[weeks.findIndex((w) => w.week === r.week) - 1];
            return (
              <tr key={r.week}>
                <td className="py-1.5 pl-1 whitespace-nowrap text-ink-muted">{weekRangeLabel(r.week)}</td>
                {PARTS.map((p) => {
                  const v = r.shares[p.id] ?? 0;
                  const d = prev ? v - (prev.shares[p.id] ?? 0) : 0;
                  return (
                    <td key={p.id} className="px-0.5 py-1.5 text-center">
                      <span className="font-semibold">{v}%</span>
                      {d !== 0 && (
                        <span className={cn("ml-0.5 inline-flex items-center text-[9.5px]", d > 0 ? "text-success" : "text-danger")}>
                          {d > 0 ? <ArrowUp aria-hidden className="size-2.5" /> : <ArrowDown aria-hidden className="size-2.5" />}
                          {Math.abs(d)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[12.5px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-ink-muted">{children}</p>;
}

/** Un número con su color y su nombre (debajo de la barra de objetivos). */
function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-sunken/60 px-2 py-1.5">
      <span className="flex items-center gap-1 text-[10.5px] whitespace-nowrap text-ink-muted">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-[16px] font-semibold tabular-nums">{value}</span>
    </li>
  );
}
