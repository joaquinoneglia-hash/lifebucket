"use client";

import { BookOpen, ListChecks, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toKey } from "@/lib/dates";
import { greeting } from "@/lib/motivation";
import { play } from "@/lib/sfx";
import { goalsFor, usePlanner } from "@/lib/store";

const SESSION = "lb:reminded";

/**
 * El recordatorio dentro de la app: según lo que elegiste (cada vez que abrís, o desde una hora a la mañana,
 * al mediodía o a la noche), te recibe con tu día: tus no negociables, tu diario y tus metas del mes.
 * Una vez por día (o por visita, si elegiste "cada vez que abro").
 */
export function Reminder({ onGo }: { onGo: (where: "diarios" | "diario" | "metas") => void }) {
  const reminder = usePlanner((s) => s.reminder);
  const setupDone = usePlanner((s) => s.setupDone);
  const last = usePlanner((s) => s.lastReminder);
  const setLast = usePlanner((s) => s.setLastReminder);
  const checks = usePlanner((s) => s.dailyChecks);
  const allGoals = usePlanner((s) => s.dailyGoals);
  const goalMonths = usePlanner((s) => s.goalMonths);
  const tasks = usePlanner((s) => s.tasks);
  const [open, setOpen] = useState(false);
  const today = toKey(new Date());

  useEffect(() => {
    if (!setupDone || !reminder) return;
    const t = window.setTimeout(() => {
      let due = false;
      if (reminder.when === "abrir") {
        try {
          due = sessionStorage.getItem(SESSION) !== today;
        } catch {
          due = last !== today;
        }
      } else due = last !== today && new Date().getHours() >= reminder.hour;
      if (!due) return;
      try {
        sessionStorage.setItem(SESSION, today);
      } catch {}
      setLast(today);
      play("open");
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [setupDone, reminder]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const goals = goalsFor({ dailyGoals: allGoals, goalMonths }, today.slice(0, 7));
  const done = (checks[today] ?? []).filter((id) => goals.some((g) => g.id === id)).length;
  const pending = tasks.filter((t) => t.month === today.slice(0, 7) && !t.done).length;
  const go = (w: "diarios" | "diario" | "metas") => {
    setOpen(false);
    onGo(w);
  };
  const item = "pressable flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left hover:bg-surface-sunken";

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-ink/35 p-4 backdrop-blur-[2px]" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-labelledby="reminder-title" className="animate-fade-up relative flex w-full max-w-[440px] flex-col gap-3 rounded-3xl bg-surface p-6 shadow-[var(--shadow-popover)]">
        <button type="button" aria-label="Ahora no" onClick={() => setOpen(false)} className="pressable absolute top-3 right-3 grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken">
          <X aria-hidden className="size-4" />
        </button>
        <h2 id="reminder-title" className="text-[22px] leading-tight font-semibold tracking-tight">
          {greeting()}. ¿Cómo viene tu día?
        </h2>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">Un minuto para vos: tildá lo que cumpliste y contá qué hiciste. Sin presión.</p>
        <button type="button" className={item} onClick={() => go("diarios")}>
          <ListChecks aria-hidden className="size-5 shrink-0" />
          <span className="flex-1">
            <b className="block text-[14px] font-semibold">Mis no negociables</b>
            <span className="text-[12.5px] text-ink-muted tabular-nums">{goals.length ? `${done} de ${goals.length} hoy` : "Elegí los tuyos"}</span>
          </span>
        </button>
        <button type="button" className={item} onClick={() => go("diario")}>
          <BookOpen aria-hidden className="size-5 shrink-0" />
          <span className="flex-1">
            <b className="block text-[14px] font-semibold">Mi diario</b>
            <span className="text-[12.5px] text-ink-muted">¿Qué hiciste hoy fuera de tu rutina?</span>
          </span>
        </button>
        <button type="button" className={item} onClick={() => go("metas")}>
          <Target aria-hidden className="size-5 shrink-0" />
          <span className="flex-1">
            <b className="block text-[14px] font-semibold">Mis metas del mes</b>
            <span className="text-[12.5px] text-ink-muted tabular-nums">{pending ? `${pending} en camino` : "Sumá una meta para este mes"}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
