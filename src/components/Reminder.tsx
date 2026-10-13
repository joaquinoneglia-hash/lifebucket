"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { cheer, greeting } from "@/lib/motivation";
import { play } from "@/lib/sfx";
import { goalsFor, usePlanner } from "@/lib/store";
import { DiaryComposer } from "./Diary";

const SESSION = "lb:reminded";
const SNOOZE = "lb:reminder-snooze";

/**
 * El recordatorio dentro de la app: según lo que elegiste (al abrir, o desde una hora a la mañana, al
 * mediodía o a la noche), te recibe con tu día para completarlo ahí mismo: 1) tildar tus no negociables y
 * 2) escribir algo en tu diario. Se puede saltear por hoy o pedir que te lo vuelva a recordar más tarde.
 */
export function Reminder({ onGo }: { onGo: (where: "diarios" | "diario" | "metas") => void }) {
  const reminder = usePlanner((s) => s.reminder);
  const setupDone = usePlanner((s) => s.setupDone);
  const last = usePlanner((s) => s.lastReminder);
  const setLast = usePlanner((s) => s.setLastReminder);
  const checks = usePlanner((s) => s.dailyChecks);
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const toggle = usePlanner((s) => s.toggleDailyCheck);
  const logros = usePlanner((s) => s.logros);
  const [open, setOpen] = useState(false);
  const today = toKey(new Date());

  useEffect(() => {
    if (!setupDone || !reminder) return;
    const t = window.setTimeout(() => {
      try {
        // "Más tarde": no vuelve a aparecer hasta que pase una hora.
        if (Number(localStorage.getItem(SNOOZE) ?? 0) > Date.now()) return;
      } catch {}
      let due = false;
      if (reminder.when === "abrir") {
        try {
          due = sessionStorage.getItem(SESSION) !== today && last !== today;
        } catch {
          due = last !== today;
        }
      } else due = last !== today && new Date().getHours() >= reminder.hour;
      if (!due) return;
      try {
        sessionStorage.setItem(SESSION, today);
      } catch {}
      play("open");
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [setupDone, reminder]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, today.slice(0, 7));
  const done = new Set(checks[today] ?? []);
  const wroteToday = logros.some((l) => l.date === today);
  /** Listo o salteado por hoy: no vuelve a aparecer hasta mañana. */
  const finish = () => {
    setLast(today);
    setOpen(false);
  };
  const later = () => {
    try {
      localStorage.setItem(SNOOZE, String(Date.now() + 60 * 60 * 1000));
    } catch {}
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-labelledby="reminder-title" className="animate-fade-up relative flex w-full max-w-[480px] flex-col gap-4 rounded-3xl bg-surface p-6 shadow-[var(--shadow-popover)]">
        <button type="button" aria-label="Más tarde" onClick={later} className="pressable absolute top-3 right-3 grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken">
          <X aria-hidden className="size-4" />
        </button>
        <div>
          <h2 id="reminder-title" className="pr-8 text-[22px] leading-tight font-semibold tracking-tight">
            {greeting()}. ¿Cómo viene tu día?
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">Un minuto para vos, sin presión.</p>
        </div>

        {/* 1. Los no negociables, para tildar acá mismo. */}
        <section className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-surface">1</span>
            Tildá tus no negociables de hoy
            <span className="ml-auto text-[12px] font-medium text-ink-muted tabular-nums">
              {[...done].filter((id) => goals.some((g) => g.id === id)).length}/{goals.length}
            </span>
          </p>
          {goals.length ? (
            <ul className="flex flex-col gap-1">
              {goals.map((g) => {
                const on = done.has(g.id);
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        if (!on) cheer(done.size + 1 === goals.length ? "allChecks" : "check");
                        toggle(today, g.id);
                      }}
                      className={cn("pressable flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[13.5px]", on ? "border-ink bg-ink/[0.05]" : "border-line hover:bg-surface-sunken")}
                    >
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-ink bg-ink text-surface" : "border-ink-faint")}>{on && <Check aria-hidden strokeWidth={3} className="size-3" />}</span>
                      <span className={cn("flex-1", on && "text-ink-muted line-through decoration-ink/30")}>{g.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <button type="button" onClick={() => (setOpen(false), onGo("diarios"))} className="pressable self-start text-[13px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink">
              Todavía no elegiste tus no negociables: elegilos
            </button>
          )}
        </section>

        {/* 2. El diario, para escribir acá mismo. */}
        <section className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-surface">2</span>
            Escribí algo en tu diario
            {wroteToday && <Check aria-hidden strokeWidth={3} className="size-4 text-success" />}
          </p>
          <DiaryComposer compact />
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={finish} className="pressable h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
            Saltear por hoy
          </button>
          <button type="button" onClick={later} className="pressable h-10 rounded-full border border-line px-4 text-[13px] font-medium hover:bg-surface-sunken">
            Recordarme más tarde
          </button>
          <button type="button" onClick={finish} className="pressable h-10 rounded-full bg-ink px-5 text-[13px] font-semibold text-surface hover:bg-ink/90">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
