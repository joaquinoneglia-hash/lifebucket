"use client";

import { TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { toKey } from "@/lib/dates";
import { monthDays } from "@/lib/daily-goals";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { play } from "@/lib/sfx";
import { goalsFor, usePlanner } from "@/lib/store";
import { ACTIVE_PARTS, monthMinutes } from "@/lib/week-shares";
import { Sheet } from "./ui";

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const GOOD = ["feliz", "tranquilo", "agradecido", "energia"];

/** «Mi Progreso», arriba: la evolución del año, mes a mes, de cada parte de tu LifeBucket. */
export function ProgressButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <>
      <button
        type="button"
        data-tour="mi-progreso"
        onClick={() => {
          play("open");
          setOpen(true);
        }}
        aria-label={compact ? "Mi Progreso" : undefined}
        className={cn(
          "pressable flex items-center gap-2 rounded-full whitespace-nowrap",
          compact
            ? "size-8 justify-center"
            : "bg-surface/80 px-3.5 py-2 text-[13px] font-medium shadow-[var(--shadow-card)] hover:bg-surface",
        )}
      >
        <TrendingUp aria-hidden className="size-4 text-ink-muted" />
        {!compact && "Mi Progreso"}
      </button>
      {open && (
        <ProgressView isMobile={!desktop} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

type Series = {
  title: string;
  hint: string;
  color: string;
  values: (number | null)[];
  unit: string;
  max?: number;
};

function ProgressView({
  isMobile,
  onClose,
}: {
  isMobile: boolean;
  onClose: () => void;
}) {
  const s = usePlanner.getState();
  const today = toKey(new Date());
  const year = Number(today.slice(0, 4));
  const thisMonth = today.slice(0, 7);
  const months = MONTHS.map(
    (_, k) => `${year}-${String(k + 1).padStart(2, "0")}`,
  );
  const started = (s.startedAt || today).slice(0, 7);
  const active = (m: string) => m >= started && m <= thisMonth;

  // Tu balde: qué parte del mes fue para vos (con la rutina que tenías ese mes).
  const routineFor = (m: string) => {
    const weeks = Object.keys(s.weekRoutines)
      .filter((k) => k.slice(0, 7) === m)
      .sort();
    return weeks.length ? s.weekRoutines[weeks[weeks.length - 1]] : s.routine;
  };
  const balde = months.map((m) => {
    if (!active(m)) return null;
    const last = toKey(
      new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0),
    );
    const { minutes } = monthMinutes(
      routineFor(m),
      s.logros,
      s.sleep,
      m,
      "",
      last > today ? last : last,
    );
    const mine = ACTIVE_PARTS.reduce((acc, p) => acc + minutes[p], 0);
    const all = minutes.sueno + minutes.trabajo + minutes.libre + mine;
    return all ? Math.round((mine / all) * 100) : 0;
  });
  // No negociables: casillas tildadas sobre el total del mes.
  const noneg = months.map((m) => {
    if (!active(m)) return null;
    const goals = goalsFor(s, m);
    const days = monthDays(m).filter((d) => d <= today);
    const boxes = goals.length * days.length;
    if (!boxes) return null;
    const ticked = days.reduce(
      (acc, d) =>
        acc +
        goals.filter((g) => (s.dailyChecks[d] ?? []).includes(g.id)).length,
      0,
    );
    return Math.round((ticked / boxes) * 100);
  });
  // Metas: cumplidas sobre las de cada mes.
  const metas = months.map((m) => {
    const list = s.tasks.filter((t) => t.month === m);
    if (!list.length) return active(m) ? 0 : null;
    return Math.round((list.filter((t) => t.done).length / list.length) * 100);
  });
  // Recordatorios: cuántos completaste cada mes.
  const pending = s.lists.find((l) => l.type === "pendientes");
  const recs = months.map((m) =>
    active(m)
      ? (pending?.items.filter((i) => i.done && i.doneAt?.startsWith(m))
          .length ?? 0)
      : null,
  );
  // Cómo te sentiste: qué parte de tus días anotados fueron buenos.
  const animo = months.map((m) => {
    const days = s.moods.filter(
      (x) => x.date.startsWith(m) && x.feelings.length,
    );
    if (!days.length) return active(m) ? null : null;
    return Math.round(
      (days.filter((x) => x.feelings.some((f) => GOOD.includes(f))).length /
        days.length) *
        100,
    );
  });
  const series: Series[] = [
    {
      title: "Tu balde: tiempo para vos",
      hint: "Qué parte de tu mes fue para vos",
      color: "var(--color-success)",
      values: balde,
      unit: "%",
      max: 100,
    },
    {
      title: "No negociables",
      hint: "Cuánto cumpliste de tus no negociables",
      color: "#2563eb",
      values: noneg,
      unit: "%",
      max: 100,
    },
    {
      title: "Metas anuales",
      hint: "Qué parte de las metas de cada mes cumpliste",
      color: "#8a5cf0",
      values: metas,
      unit: "%",
      max: 100,
    },
    {
      title: "Recordatorios",
      hint: "Cuántos completaste cada mes",
      color: "#e3a008",
      values: recs,
      unit: "",
    },
    {
      title: "Cómo te sentiste",
      hint: "Qué parte de tus días anotados fueron buenos",
      color: "#e5508a",
      values: animo,
      unit: "%",
      max: 100,
    },
  ];

  return (
    <Sheet
      isMobile={isMobile}
      onClose={onClose}
      labelledBy="progress-title"
      width="max-w-[980px]"
    >
      <div
        className={cn(
          "flex flex-col",
          isMobile ? "h-[90dvh]" : "h-[min(800px,90dvh)]",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2
            id="progress-title"
            data-autofocus
            tabIndex={-1}
            className="type-title flex items-center gap-2 outline-none"
          >
            <TrendingUp aria-hidden className="size-5 text-ink-muted" />
            Mi Progreso · {year}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {series.map((x) => (
            <Chart
              key={x.title}
              s={x}
              thisMonth={Number(thisMonth.slice(5)) - 1}
            />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** Una tarjeta: el valor de este mes y las barras de cada mes del año. */
function Chart({ s, thisMonth }: { s: Series; thisMonth: number }) {
  const max = s.max ?? Math.max(1, ...s.values.map((v) => v ?? 0));
  const now = s.values[thisMonth];
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface-sunken/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold">{s.title}</h3>
          <p className="text-[11.5px] text-ink-muted">{s.hint}</p>
        </div>
        <span
          className="text-[24px] leading-none font-semibold tabular-nums"
          style={{ color: s.color }}
        >
          {now === null || now === undefined ? "–" : `${now}${s.unit}`}
        </span>
      </div>
      <div className="flex h-28 items-end gap-1.5">
        {s.values.map((v, k) => (
          <div
            key={k}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            title={v === null ? "Sin datos" : `${MONTHS[k]}: ${v}${s.unit}`}
          >
            <span className="text-[9.5px] font-semibold text-ink-muted tabular-nums">
              {v === null ? "" : `${v}${s.unit}`}
            </span>
            <span
              className={cn(
                "w-full rounded-t-md transition-[height] duration-500",
                v === null && "bg-ink/5",
              )}
              style={{
                height: v === null ? 4 : `${Math.max(4, (v / max) * 80)}%`,
                background: v === null ? undefined : s.color,
                opacity: k === thisMonth ? 1 : 0.55,
              }}
            />
            <span
              className={cn(
                "text-[10px] tabular-nums",
                k === thisMonth ? "font-semibold text-ink" : "text-ink-faint",
              )}
            >
              {MONTHS[k]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
