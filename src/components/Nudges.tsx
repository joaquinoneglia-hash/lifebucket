"use client";

import { Bell, BookOpen, CalendarDays, ListChecks, Moon, PieChart, Target, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { computeNudges, type Nudge, type NudgeIcon, type NudgeTarget } from "@/lib/nudges";
import { play } from "@/lib/sfx";
import { usePlanner } from "@/lib/store";

export type { NudgeTarget };
export type GoNudge = (where: NudgeTarget, nudge?: Nudge) => void;
const ICONS: Record<NudgeIcon, LucideIcon> = { rutina: CalendarDays, noneg: ListChecks, metas: Target, diario: BookOpen, balde: PieChart, sueno: Moon };
const LOG = "lb:nudge-log";
const dismissKey = (id: string) => `lb:nudge:${id}`;

/** Los avisos de ahora (se recalculan con cada cambio). */
function useNudges() {
  const routine = usePlanner((s) => s.routine);
  const dailyGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const dailyChecks = usePlanner((s) => s.dailyChecks);
  const tasks = usePlanner((s) => s.tasks);
  const logros = usePlanner((s) => s.logros);
  const sleep = usePlanner((s) => s.sleep);
  const startedAt = usePlanner((s) => s.startedAt);
  const idealHours = usePlanner((s) => s.idealHours);
  return computeNudges({ routine, dailyGoals, goalMonths, dailyChecks, tasks, logros, sleep, startedAt, idealHours });
}

/**
 * El aviso que salta solo: uno por visita, unos segundos después de abrir (nunca encima de otro cartel).
 * "Ahora no" lo calla por hoy; igual queda en la campanita.
 */
export function Nudges({ onGo }: { onGo: GoNudge }) {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    const tryShow = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour < 8 || hour >= 22) return;
      if (document.querySelector("dialog[open], [aria-labelledby='reminder-title'], [aria-labelledby='setup-title'], [aria-labelledby='nudge-title']")) return;
      const today = toKey(now);
      let log: { day: string; times: number[]; ids: string[] } = { day: today, times: [], ids: [] };
      try {
        const raw = JSON.parse(localStorage.getItem(LOG) ?? "null");
        if (raw?.day === today) log = raw;
      } catch {}
      if (log.times.length >= 3) return;
      if (log.times.length && Date.now() - log.times[log.times.length - 1] < 3.5 * 60 * 60 * 1000) return;
      const pick = computeNudges(usePlanner.getState()).find((n) => {
        if (log.ids.includes(n.id)) return false;
        try {
          return localStorage.getItem(dismissKey(n.id)) !== today;
        } catch {
          return true;
        }
      });
      if (!pick) return;
      log = { day: today, times: [...log.times, Date.now()], ids: [...log.ids, pick.id] };
      try {
        localStorage.setItem(LOG, JSON.stringify(log));
      } catch {}
      play("pop");
      setNudge(pick);
    };
    const first = window.setTimeout(tryShow, 6000);
    const every = window.setInterval(tryShow, 10 * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  if (!nudge) return null;
  const Icon = ICONS[nudge.icon];
  const close = () => {
    try {
      localStorage.setItem(dismissKey(nudge.id), toKey(new Date()));
    } catch {}
    setNudge(null);
  };
  return (
    <div role="alertdialog" aria-labelledby="nudge-title" className="animate-sheet-in fixed right-4 bottom-[96px] left-4 z-[72] mx-auto max-w-[400px] rounded-3xl bg-surface p-5 shadow-[var(--shadow-popover)] sm:left-auto lg:right-6 lg:bottom-24">
      <button type="button" aria-label="Ahora no" onClick={close} className="pressable absolute top-3 right-3 grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken">
        <X aria-hidden className="size-4" />
      </button>
      <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_oklab,#d99a00_16%,transparent)] text-[#8a6200]">
        <Icon aria-hidden className="size-5" />
      </span>
      <h2 id="nudge-title" className="mt-3 pr-6 text-[17px] leading-tight font-semibold tracking-tight">
        {nudge.title}
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{nudge.body}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={close} className="pressable h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
          Ahora no
        </button>
        <button
          type="button"
          onClick={() => {
            setNudge(null);
            onGo(nudge.go, nudge);
          }}
          className="pressable h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface hover:bg-ink/90"
        >
          {nudge.cta}
        </button>
      </div>
    </div>
  );
}

/**
 * Recomendaciones y recordatorios: la campanita del encabezado, con cuántos avisos hay. Al tocarla, todos
 * juntos: primero lo que falta (recordatorios) y después las sugerencias para llenar mejor tu balde.
 */
export function NudgeCenter({ onGo, compact }: { onGo: GoNudge; compact?: boolean }) {
  const list = useNudges();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const groups = [
    { k: "recordatorio" as const, title: "Recordatorios" },
    { k: "recomendacion" as const, title: "Recomendaciones" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Recomendaciones y recordatorios${list.length ? `: ${list.length}` : ""}`}
        aria-expanded={open}
        title="Recomendaciones y recordatorios"
        onClick={() => {
          play(open ? "close" : "open");
          setOpen(!open);
        }}
        className={cn("pressable relative grid place-items-center rounded-md text-ink-muted hover:bg-surface/70 hover:text-ink", compact ? "size-9" : "size-10")}
      >
        <Bell aria-hidden className="size-4" />
        {list.length > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d99a00] px-1 text-[10px] leading-none font-bold text-white tabular-nums">{list.length}</span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Recomendaciones y recordatorios" className="animate-fade-up z-[60] flex max-h-[min(560px,80dvh)] flex-col max-sm:fixed max-sm:inset-x-3 max-sm:top-16 sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:w-[380px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-popover)]">
          <p className="border-b border-line px-4 py-3 text-[14px] font-semibold">Recomendaciones y recordatorios</p>
          <div className="min-h-0 overflow-y-auto p-2">
            {list.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ink-muted">¡Todo al día! No hay nada pendiente. 🎉</p>}
            {groups.map((g) => {
              const items = list.filter((n) => n.kind === g.k);
              if (!items.length) return null;
              return (
                <section key={g.k} className="pb-2">
                  <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-[0.14em] text-ink-faint uppercase">{g.title}</p>
                  <ul className="flex flex-col gap-1">
                    {items.map((n) => {
                      const Icon = ICONS[n.icon];
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onGo(n.go, n);
                            }}
                            className="pressable flex w-full gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-surface-sunken"
                          >
                            <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", n.kind === "recordatorio" ? "bg-[color-mix(in_oklab,#d99a00_16%,transparent)] text-[#8a6200]" : "bg-surface-sunken text-ink-muted")}>
                              <Icon aria-hidden className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <b className="block text-[13px] leading-snug font-semibold">{n.title}</b>
                              <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{n.body}</span>
                              <span className="mt-1 block text-[12px] font-semibold text-ink">{n.cta} →</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
