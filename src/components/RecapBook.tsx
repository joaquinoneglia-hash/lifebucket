"use client";

import { CalendarRange, Check, Loader2, Moon, Pause, Sparkles, Telescope, Volume2, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fromKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { buildRecap, partName, type Range, type Recap } from "@/lib/recap";
import type { Summary, SummaryRequest } from "@/lib/summary-schema";
import { setSpeechRate, speak, stopSpeaking } from "@/lib/speech";
import { usePlanner } from "@/lib/store";
import { ACTIVE_PARTS, partColor, type Part } from "@/lib/week-shares";
import { QuadrantIcon } from "./QuadrantIcon";
import { Sheet } from "./ui";

const h = (m: number) => `${(m >= 6000 ? Math.round(m / 60) : Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;
const dayShort = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" });
const MONTH_SHORT = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const SPEEDS = [1, 1.25, 1.5, 1.75];
const FICHAS: { id: "mes" | "anio"; label: string; sub: string; icon: LucideIcon }[] = [
  { id: "mes", label: "Tu mes", sub: "cómo viene", icon: CalendarRange },
  { id: "anio", label: "Tu año", sub: "si seguís igual", icon: Telescope },
];

/** Los datos del período, en texto, para que la IA escriba el resumen (solo lo necesario). */
function recapContext(recap: Recap) {
  const h = (m: number) => Math.round((m / 60) * 10) / 10;
  return JSON.stringify({
    periodo: recap.period,
    balde_horas: Object.fromEntries(Object.entries(recap.minutes).map(([k, v]) => [k === "alma" ? "hobbies" : k === "mente" ? "habilidades" : k === "interior" ? "mente_y_alma" : k === "cuerpo" ? "deporte" : k, h(v)])),
    para_vos: { horas: h(recap.stats.mine), porcentaje: recap.stats.minePct },
    no_negociables: recap.goalCount
      ? { cumplimiento: recap.goals.pct, dias: recap.goals.days, por_habito: recap.goals.perGoal.map((g) => ({ nombre: g.goal.name, porcentaje: g.pct })) }
      : "todavía no eligió",
    diario: recap.entries.slice(-30).map((l) => ({ fecha: l.date, texto: l.text, categoria: l.category, horas: l.minutes ? h(l.minutes) : 0 })),
    metas: {
      propuestas: recap.tasks.proposed.map((t) => ({ meta: t.title, mes: t.month, cumplida: t.done, postergada_veces: t.history?.length ?? 0 })),
      cumplidas: recap.tasks.done.length,
      no_cumplidas: recap.tasks.notDone.length,
      postergadas: recap.tasks.proposed.filter((t) => (t.history?.length ?? 0) > 0).length,
      en_camino: recap.tasks.pending.length,
    },
    sueno_por_noche: recap.sleep,
    recomendaciones_de_la_app: recap.tips,
  });
}

/** El resumen general en un pop-up grande en el centro (en el celular, una hoja). */
export function RecapBook({ range, isMobile, onClose }: { range: Range; isMobile: boolean; onClose: () => void }) {
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="recap-title" width="max-w-[920px]">
      <Book initial={range} onClose={onClose} className={isMobile ? "h-[88dvh]" : "h-[min(780px,90dvh)]"} />
    </Sheet>
  );
}

/**
 * El libro: arriba, tres fichas (tu semana, tu mes y la proyección de tu año); abajo, una sola lectura
 * vertical, capítulo tras capítulo, cada uno con su texto y su gráfico. Se puede escuchar (con velocidad a
 * elección): la voz va leyendo y la página baja sola hasta el capítulo que suena.
 */
export function Book({ initial = "mes", onClose, className }: { initial?: Range; onClose?: () => void; className?: string }) {
  const data = usePlanner();
  const [range, setRange] = useState<"mes" | "anio">(initial === "anio" ? "anio" : "mes");
  const [reading, setReading] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const token = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recap = buildRecap(data, range);
  const all = FICHAS.map((f) => buildRecap(data, f.id));
  // La IA escribe el relato (una vez por período abierto); mientras tanto, o si no hay IA, el texto de la app.
  const [ai, setAi] = useState<Partial<Record<"mes" | "anio", Summary | "error" | "loading">>>({});
  const story = ai[range];
  useEffect(() => {
    if (ai[range]) return;
    setAi((a) => ({ ...a, [range]: "loading" }));
    const body: SummaryRequest = { range, context: recapContext(recap) };
    fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((res) => (res.ok ? (res.json() as Promise<Summary>) : Promise.reject(res.status)))
      .then((sum) => setAi((a) => ({ ...a, [range]: sum })))
      .catch(() => setAi((a) => ({ ...a, [range]: "error" })));
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps
  const written = typeof story === "object" ? story : null;
  const chapters = recap.chapters.map((ch) => {
    const w = written?.chapters.find((c) => c.id === ch.id);
    return w ? { ...ch, title: w.title, text: w.text } : ch;
  });

  const stop = () => {
    token.current++;
    stopSpeaking();
    setReading(null);
  };
  /** Lleva la lectura al capítulo i (dentro del libro, sin mover la página de atrás). */
  const show = (i: number) => {
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-chapter="${i}"]`);
    if (box && el) box.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  };
  const read = async () => {
    const my = ++token.current;
    for (let i = 0; i < chapters.length; i++) {
      if (token.current !== my) return;
      setReading(i);
      show(i);
      await speak(`${chapters[i].title}. ${chapters[i].text}`);
    }
    if (token.current === my) setReading(null);
  };
  useEffect(
    () => () => {
      token.current++;
      stopSpeaking();
    },
    [],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
        <h2 id="recap-title" data-autofocus tabIndex={-1} className="type-title outline-none">
          Resumen general
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
              setSpeed(next);
              setSpeechRate(next);
            }}
            title="Velocidad de lectura"
            aria-label={`Velocidad de lectura: ${speed}x`}
            className="pressable h-9 min-w-12 rounded-full bg-surface-sunken px-2.5 text-[12.5px] font-semibold tabular-nums hover:bg-ink/10"
          >
            {speed.toLocaleString("es-AR")}x
          </button>
          <button
            type="button"
            onClick={reading !== null ? stop : read}
            aria-pressed={reading !== null}
            className="pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-surface hover:bg-ink/90"
          >
            {reading !== null ? <Pause aria-hidden className="size-3.5" /> : <Volume2 aria-hidden className="size-3.5" />}
            {reading !== null ? "Pausar" : "Escuchar"}
          </button>
          {onClose && (
            <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* Las fichas: qué querés leer. */}
        <div role="tablist" aria-label="Período" className="mx-auto grid max-w-[640px] grid-cols-2 gap-2 px-6 pt-6 sm:px-10">
          {FICHAS.map((f, i) => {
            const on = range === f.id;
            const r = all[i];
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  stop();
                  setRange(f.id);
                  scrollRef.current?.scrollTo({ top: 0 });
                }}
                className={cn(
                  "pressable flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors duration-150",
                  on ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:bg-surface-sunken/60",
                )}
              >
                <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", on ? "text-surface/70" : "text-ink-muted")}>
                  <f.icon aria-hidden className="size-3.5" />
                  {f.sub}
                </span>
                <span className="text-[15px] leading-tight font-semibold">{f.label}</span>
                <span className={cn("text-[11.5px] tabular-nums", on ? "text-surface/70" : "text-ink-muted")}>{r.stats.minePct}% para vos</span>
              </button>
            );
          })}
        </div>

        {/* Todo en una sola lectura, como las páginas de un libro. */}
        <article key={range} className="animate-fade-up mx-auto flex max-w-[640px] flex-col px-6 pt-6 pb-16 sm:px-10">
          <p className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.18em] text-ink-faint uppercase">
            {recap.period}
            {story === "loading" && (
              <span className="inline-flex items-center gap-1.5 tracking-normal normal-case">
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Escribiendo tu historia…
              </span>
            )}
            {written && (
              <span className="inline-flex items-center gap-1 tracking-normal normal-case">
                <Sparkles aria-hidden className="size-3.5" />
                Escrito con IA
              </span>
            )}
          </p>
          {story === "error" && <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-[12px] text-ink-muted">Este resumen lo armó la app (la IA no está disponible ahora).</p>}
          {chapters.map((ch, i) => (
            <section
              key={ch.id}
              data-chapter={i}
              aria-current={reading === i || undefined}
              className={cn("flex flex-col gap-4 border-line py-8 transition-opacity duration-300", i > 0 && "border-t", reading !== null && reading !== i && "opacity-45")}
            >
              {i > 0 && <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-faint uppercase tabular-nums">Capítulo {i}</p>}
              <h3 className={cn("leading-tight font-semibold tracking-tight", i === 0 ? "text-[30px]" : "text-[22px]")}>{ch.title}</h3>
              <p className={cn("text-[16px] leading-[1.75] text-ink/85 transition-opacity duration-500", story === "loading" && "opacity-50")}>{i === 0 && written ? <b className="mb-1 block text-[13px] font-semibold tracking-wide text-ink-muted uppercase">{written.title}</b> : null}{ch.text}</p>
              <div className="pt-2">
                <Visual id={ch.id} recap={recap} />
              </div>
            </section>
          ))}
          {written && written.tips.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-line pt-8">
              <h3 className="text-[22px] leading-tight font-semibold tracking-tight">Para lo que viene</h3>
              <ul className="flex flex-col gap-2">
                {written.tips.map((tip, k) => (
                  <li key={k} className="flex gap-3 rounded-xl bg-surface-sunken/70 px-3.5 py-3 text-[13.5px] leading-snug">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-surface tabular-nums">{k + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="pt-6 text-center text-[12px] text-ink-faint">Fin {range === "mes" ? "de tu mes" : "de tu año"}.</p>
        </article>
      </div>
    </div>
  );
}

/** El gráfico de cada capítulo. */
function Visual({ id, recap }: { id: Recap["chapters"][number]["id"]; recap: Recap }) {
  const { minutes, total } = recap;
  const pct = (m: number) => Math.round((m / total) * 100);
  const parts: Part[] = [...ACTIVE_PARTS, "trabajo", "sueno"];
  const sorted = [...parts].sort((a, b) => minutes[b] - minutes[a]);

  if (id === "portada")
    return recap.range === "anio" ? (
      <ul className="grid grid-cols-3 gap-2.5">
        <Stat value={h(minutes.sueno)} label="durmiendo" sub={`${Math.round(minutes.sueno / 1440)} días enteros`} />
        <Stat value={h(minutes.trabajo)} label="trabajando" sub={`${Math.round(minutes.trabajo / 1440)} días enteros`} />
        <Stat value={h(recap.stats.mine)} label="para vos" sub={`${recap.stats.minePct}% del tiempo`} />
      </ul>
    ) : (
      <ul className="grid grid-cols-3 gap-2.5">
        <Stat value={h(recap.stats.mine)} label="para vos" sub={`${recap.stats.minePct}% del tiempo`} />
        <Stat value={recap.stats.goalsPct === null ? "–" : `${recap.stats.goalsPct}%`} label="no negociables" sub="cumplidos" />
        <Stat value={String(recap.stats.entries)} label="cosas que hiciste" sub={recap.stats.entries === 1 ? "anotada" : "anotadas"} />
      </ul>
    );

  if (id === "balde") {
    // En la proyección del año: 100 cuadraditos, cada uno es el 1% de tu año.
    if (recap.range === "anio") {
      const cells: Part[] = [];
      const exact = sorted.map((p) => ({ p, v: (minutes[p] / total) * 100 }));
      const base = exact.map((x) => ({ ...x, n: Math.floor(x.v) }));
      let left = 100 - base.reduce((acc, x) => acc + x.n, 0);
      for (const x of [...base].sort((a, b) => b.v - b.n - (a.v - a.n))) if (left-- > 0) x.n++;
      for (const x of base) for (let i = 0; i < x.n; i++) cells.push(x.p);
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]" role="img" aria-label="Tu año en 100 cuadraditos">
            {cells.map((p, i) => (
              <span key={i} className="aspect-square rounded-[3px]" style={{ background: partColor(p) }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {sorted.map((p) => (
              <li key={p} className={cn("flex items-center gap-1.5 text-[12.5px] tabular-nums", minutes[p] === 0 && "opacity-40")}>
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: partColor(p) }} />
                <span className="flex-1">{partName(p)}</span>
                <span className="text-ink-muted">{h(minutes[p])}</span>
                <span className="w-9 text-right font-semibold">{pct(minutes[p])}%</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    const r = 42;
    const c = 2 * Math.PI * r;
    let at = 0;
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <svg viewBox="0 0 100 100" className="size-36 shrink-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="13" />
          {sorted
            .filter((p) => minutes[p] > 0)
            .map((p) => {
              const len = (minutes[p] / total) * c;
              const el = <circle key={p} cx="50" cy="50" r={r} fill="none" stroke={partColor(p)} strokeWidth="13" strokeDasharray={`${Math.max(0, len - 1)} ${c}`} strokeDashoffset={-at} />;
              at += len;
              return el;
            })}
        </svg>
        <ul className="flex w-full min-w-0 flex-col gap-1.5">
          {sorted.map((p) => (
            <li key={p} className={cn("flex flex-col gap-0.5", minutes[p] === 0 && "opacity-40")}>
              <span className="flex items-center gap-1.5 text-[12.5px] tabular-nums">
                <span aria-hidden className="size-2 rounded-full" style={{ background: partColor(p) }} />
                <span className="flex-1">{partName(p)}</span>
                <span className="text-ink-muted">{h(minutes[p])}</span>
                <span className="w-9 text-right font-semibold">{pct(minutes[p])}%</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct(minutes[p]))}%`, background: partColor(p) }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (id === "diarios") {
    const g = recap.goals;
    if (!recap.goalCount) return <Empty />;
    // Muchos días (el año): una barra por mes con su % cumplido.
    const bars =
      g.perDay.length > 31
        ? Object.values(
            g.perDay.reduce<Record<string, { key: string; label: string; sum: number; n: number }>>((acc, d) => {
              const m = d.date.slice(0, 7);
              acc[m] ??= { key: m, label: MONTH_SHORT[Number(m.slice(5)) - 1], sum: 0, n: 0 };
              if (d.score !== null) {
                acc[m].sum += d.score;
                acc[m].n++;
              }
              return acc;
            }, {}),
          ).map((m) => ({ key: m.key, label: m.label, v: m.n ? m.sum / (m.n * recap.goalCount) : null }))
        : g.perDay.map((d) => ({ key: d.date, label: g.perDay.length <= 7 ? dayShort.format(fromKey(d.date)).replace(".", "") : "", v: d.score === null ? null : d.score / recap.goalCount }));
    return (
      <div className="flex flex-col gap-4">
        <div className="flex h-28 items-end gap-1" aria-hidden>
          {bars.map((b) => (
            <span key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
              <span className="flex w-full flex-1 items-end rounded-md bg-surface-sunken">
                {b.v !== null && b.v > 0 && <span className={cn("w-full rounded-md", b.v >= 1 ? "bg-success" : "bg-ink/70")} style={{ height: `${b.v * 100}%` }} />}
              </span>
              {b.label && <span className="text-[10.5px] text-ink-muted">{b.label}</span>}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {[...g.perGoal]
            .sort((a, b) => b.pct - a.pct)
            .map(({ goal, done, pct: p }) => (
              <li key={goal.id} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{goal.name}</span>
                  <span className="text-ink-muted tabular-nums">
                    {done}/{g.days} · <b className="font-semibold text-ink">{p}%</b>
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <span className="block h-full rounded-full bg-success" style={{ width: `${p}%` }} />
                </span>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  if (id === "diario") {
    if (!recap.entries.length) return <Empty />;
    return (
      <ul className="flex flex-col gap-1.5">
        {recap.entries.slice(-8).map((l) => {
          const cat = l.category && l.minutes > 0 ? l.category : null;
          return (
            <li key={l.id} className="flex items-center gap-2.5 rounded-xl bg-surface-sunken/70 px-2.5 py-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ background: cat ? partColor(cat) : "var(--color-ink-faint)" }}>
                {cat ? <QuadrantIcon id={cat} className="size-3.5" /> : <Sparkles aria-hidden className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug">{l.text}</span>
              <span className="shrink-0 text-[11px] text-ink-muted">{dayShort.format(fromKey(l.date)).replace(".", "")}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (id === "metas") {
    const t = recap.tasks;
    if (!t.proposed.length) return <Empty />;
    const n = t.proposed.length;
    const seg = [
      { k: "Cumplidas", v: t.done.length, c: "var(--color-success)" },
      { k: "No cumplidas", v: t.notDone.length, c: "var(--color-danger)" },
      { k: "Postergadas", v: t.postponed.length, c: "#d99a00" },
      { k: "En camino", v: t.pending.length, c: "color-mix(in oklab, var(--color-ink-faint) 60%, transparent)" },
    ];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          {seg.map((s) => s.v > 0 && <span key={s.k} className="h-full" style={{ width: `${(s.v / n) * 100}%`, background: s.c }} />)}
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {seg.map((s) => (
            <li key={s.k} className="flex flex-col gap-0.5 rounded-xl bg-surface-sunken/70 px-3 py-2">
              <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                <span aria-hidden className="size-2 rounded-full" style={{ background: s.c }} />
                {s.k}
              </span>
              <span className="text-[20px] font-semibold tabular-nums">{s.v}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-1">
          {t.proposed.map((x) => (
            <li key={x.id} className="flex items-center gap-2 text-[13px]">
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", x.done ? "border-success bg-success text-white" : "border-line")}>{x.done && <Check aria-hidden strokeWidth={3} className="size-3" />}</span>
              <span className={cn("min-w-0 flex-1", x.done && "text-ink-muted line-through")}>{x.title}</span>
              {(x.history?.length ?? 0) > 0 && <span className="shrink-0 text-[11px] font-medium text-[#b07d00]">postergada ×{x.history!.length}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (recap.range === "anio")
    return (
      <ul className="flex flex-col gap-2">
        {recap.tips.map((tip, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-surface-sunken/70 px-3.5 py-3 text-[13.5px] leading-snug">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-surface tabular-nums">{i + 1}</span>
            {tip}
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-[color-mix(in_oklab,var(--color-sleep)_15%,transparent)] text-[var(--color-sleep)]">
        <Moon aria-hidden className="size-7" />
      </span>
      <p className="text-[28px] font-semibold tabular-nums">{recap.sleep.toLocaleString("es-AR")} h</p>
      <p className="text-[12.5px] text-ink-muted">por noche</p>
    </div>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-xl bg-surface-sunken/70 px-3 py-3">
      <span className="text-[22px] leading-none font-semibold tabular-nums">{value}</span>
      <span className="text-[12px] font-medium">{label}</span>
      <span className="text-[11px] text-ink-muted">{sub}</span>
    </li>
  );
}

function Empty() {
  return (
    <div className="grid h-24 place-items-center rounded-xl border border-dashed border-line text-[12.5px] text-ink-faint">
      <Sparkles aria-hidden className="size-5" />
    </div>
  );
}
