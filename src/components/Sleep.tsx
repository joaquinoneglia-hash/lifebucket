"use client";

import { Moon } from "lucide-react";
import { useState } from "react";
import { dayLabel, fromKey, type DateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/format";
import { awakeWindow, sleepMinutes, type NightResult, type SleepSettings, type SleepWindow } from "@/lib/sleep";
import { usePlanner } from "@/lib/store";
import { formatTime } from "@/lib/time";
import { GhostButton, PrimaryButton, Select, Sheet } from "./ui";

const BED_OPTIONS = Array.from({ length: 14 }, (_, i) => 20 * 60 + i * 30); // 20:00 a 02:30
const WAKE_OPTIONS = Array.from({ length: 15 }, (_, i) => 4 * 60 + i * 30); // 04:00 a 11:00

/** Tu horario de sueño: uno para lunes a viernes y otro para el fin de semana. */
export function SleepEditor({ value, onChange }: { value: SleepSettings; onChange: (s: SleepSettings) => void }) {
  const row = (key: "weekday" | "weekend", label: string, hint: string) => {
    const w = value[key];
    const set = (patch: Partial<SleepWindow>) => onChange({ ...value, [key]: { ...w, ...patch } });
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken/70 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold">{label}</span>
          <span className="text-[12px] text-ink-muted tabular-nums">{formatMinutes(sleepMinutes(w))} de sueño</span>
        </div>
        <p className="-mt-1 text-[11px] text-ink-muted">{hint}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-muted">Me acuesto</span>
            <Select
              label={`Hora de acostarte (${label})`}
              value={String(w.bed)}
              onChange={(v) => set({ bed: Number(v) })}
              options={BED_OPTIONS.map((m) => ({ value: String(m), label: formatTime(m) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-muted">Me levanto</span>
            <Select
              label={`Hora de levantarte (${label})`}
              value={String(w.wake)}
              onChange={(v) => set({ wake: Number(v) })}
              options={WAKE_OPTIONS.map((m) => ({ value: String(m), label: formatTime(m) }))}
            />
          </label>
        </div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {row("weekday", "Lunes a viernes", "Te acostás de domingo a jueves y te levantás de lunes a viernes.")}
      {row("weekend", "Fin de semana", "Te acostás viernes y sábado y te levantás sábado y domingo.")}
    </div>
  );
}

const RESULTS: { id: NightResult; label: string }[] = [
  { id: "ok", label: "En horario" },
  { id: "late", label: "Me acosté tarde" },
  { id: "short", label: "Dormí poco" },
];

export function sleepSummary(days: DateKey[], log: Record<DateKey, NightResult>) {
  const marked = days.filter((d) => log[d]);
  return {
    total: days.length,
    marked: marked.length,
    ok: marked.filter((d) => log[d] === "ok").length,
    late: marked.filter((d) => log[d] === "late").length,
    short: marked.filter((d) => log[d] === "short").length,
  };
}

/** Noche por noche: ¿respetaste el horario? Un toque por noche. */
export function NightsCheck({ days }: { days: DateKey[] }) {
  const sleep = usePlanner((s) => s.sleep);
  const log = usePlanner((s) => s.sleepLog);
  const logNight = usePlanner((s) => s.logNight);
  const sum = sleepSummary(days, log);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {days.map((d) => {
          const { bed } = awakeWindow(d, sleep);
          const current = log[d];
          return (
            <li key={d} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken/60 px-3 py-2">
              <Moon aria-hidden className="size-3.5 shrink-0 text-[var(--color-sleep)]" />
              <span className="min-w-[120px] flex-1 text-[13px] first-letter:uppercase">
                {dayLabel(d)} <span className="text-ink-muted tabular-nums">· {formatTime(bed)}</span>
              </span>
              <div role="radiogroup" aria-label={`Noche del ${dayLabel(d)}`} className="flex gap-1">
                {RESULTS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={current === r.id}
                    onClick={() => logNight(d, current === r.id ? null : r.id)}
                    className={cn(
                      "pressable h-8 rounded-md px-2.5 text-[12px] font-medium",
                      current === r.id ? "bg-[var(--color-sleep)] text-surface" : "bg-surface text-ink-muted hover:text-ink",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-ink-muted tabular-nums" role="status">
        {sum.marked === 0
          ? "Tocá cómo fue cada noche. Si no te acordás, dejala sin marcar."
          : `${sum.ok} de ${sum.marked} noches en horario.`}
      </p>
    </div>
  );
}

/** Si venís acostándote tarde, propone un horario más realista (o mantener el que tenés). */
export function sleepSuggestion(days: DateKey[], log: Record<DateKey, NightResult>, sleep: SleepSettings) {
  const sum = sleepSummary(days, log);
  if (sum.late < 3) return null;
  const next = Math.min(sleep.weekday.bed + 30, 26 * 60);
  return { late: sum.late, from: sleep.weekday.bed, to: next };
}

/** Tarjeta de sueño en Balance: tu horario y cómo lo venís respetando. */
export function SleepCard({ days }: { days: DateKey[] }) {
  const sleep = usePlanner((s) => s.sleep);
  const setSleep = usePlanner((s) => s.setSleep);
  const log = usePlanner((s) => s.sleepLog);
  const [editing, setEditing] = useState<SleepSettings | null>(null);
  const sum = sleepSummary(days, log);
  const suggestion = sleepSuggestion(days, log, sleep);

  return (
    <section className="card flex flex-col gap-3 p-5" aria-labelledby="sleep-title">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-sleep-soft)] text-[var(--color-sleep)]">
          <Moon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sleep-title" className="type-title">
            Tu sueño
          </h2>
          <p className="text-[12px] text-ink-muted tabular-nums">
            Semana {formatTime(sleep.weekday.bed)}–{formatTime(sleep.weekday.wake)} · Finde {formatTime(sleep.weekend.bed)}–
            {formatTime(sleep.weekend.wake)}
          </p>
        </div>
        {!editing && (
          <GhostButton className="h-8 px-2 text-[12px]" onClick={() => setEditing(sleep)}>
            Cambiar
          </GhostButton>
        )}
      </div>

      {editing ? (
        <>
          <SleepEditor value={editing} onChange={setEditing} />
          <div className="flex justify-end gap-2">
            <GhostButton className="h-9" onClick={() => setEditing(null)}>
              Cancelar
            </GhostButton>
            <PrimaryButton
              className="h-9"
              onClick={() => {
                setSleep(editing);
                setEditing(null);
              }}
            >
              Guardar horario
            </PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-1" aria-label="Noches del período">
            {days.slice(-14).map((d) => (
              <span
                key={d}
                title={`${dayLabel(d)}: ${log[d] === "ok" ? "en horario" : log[d] === "late" ? "tarde" : log[d] === "short" ? "dormí poco" : "sin marcar"}`}
                className={cn(
                  "h-6 flex-1 rounded",
                  log[d] === "ok" ? "bg-[var(--color-sleep)]" : log[d] ? "bg-[color-mix(in_oklab,var(--color-sleep)_35%,white)]" : "bg-surface-sunken",
                )}
              />
            ))}
          </div>
          <p className="text-[13px] text-ink-muted tabular-nums">
            {sum.marked ? `${sum.ok} de ${sum.marked} noches en horario. El sueño no entra en tu balance: es el marco del día.` : "Marcá tus noches en el ritual del domingo para verlo acá."}
          </p>
          {suggestion && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken/70 p-3 text-[13px]">
              <span>
                Te acostaste tarde {suggestion.late} noches. ¿Pasamos tu hora a las {formatTime(suggestion.to)}?
              </span>
              <button
                type="button"
                onClick={() => setSleep({ ...sleep, weekday: { ...sleep.weekday, bed: suggestion.to } })}
                className="pressable h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-medium hover:bg-surface-sunken"
              >
                Ajustar
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Cambiar el sueño de un día puntual (o de todos los días de ese tipo), desde la franja de la grilla. */
export function DaySleepSheet({ date, isMobile, onClose }: { date: DateKey; isMobile: boolean; onClose: () => void }) {
  const sleep = usePlanner((s) => s.sleep);
  const setSleep = usePlanner((s) => s.setSleep);
  const setDaySleep = usePlanner((s) => s.setDaySleep);
  const habitual = awakeWindow(date, { ...sleep, overrides: undefined });
  const current = awakeWindow(date, sleep);
  const custom = !!sleep.overrides?.[date];
  const [wake, setWake] = useState(current.wake);
  const [bed, setBed] = useState(current.bed);
  const [scope, setScope] = useState<"day" | "all">("day");

  // De qué horario sale cada parte: levantarse (finde si es sáb/dom) y acostarse (finde si es vie/sáb).
  const dow = fromKey(date).getDay();
  const wakeKind = dow === 0 || dow === 6 ? "weekend" : "weekday";
  const bedKind = dow === 5 || dow === 6 ? "weekend" : "weekday";
  const allLabel =
    wakeKind === bedKind ? (wakeKind === "weekend" ? "Todos los fines de semana" : "Todos los días de semana") : "Mi horario habitual";

  const save = () => {
    if (scope === "day") setDaySleep(date, { wake, bed });
    else {
      setSleep({ ...sleep, [wakeKind]: { ...sleep[wakeKind], wake }, [bedKind]: { ...sleep[bedKind], bed } } as SleepSettings);
      setDaySleep(date, null);
    }
    onClose();
  };

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="day-sleep-title" width="max-w-[420px]">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[var(--color-sleep-soft)] text-[var(--color-sleep)]">
            <Moon aria-hidden className="size-4" />
          </span>
          <div>
            <h2 id="day-sleep-title" className="type-headline first-letter:uppercase">
              Sueño · {dayLabel(date)}
            </h2>
            <p className="text-[12px] text-ink-muted tabular-nums">
              {formatMinutes(Math.max(0, 24 * 60 - (bed - wake)))} de sueño
              {custom && " · horario especial para este día"}
            </p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-muted">Me levanto</span>
            <Select
              label="Hora de levantarte"
              value={String(wake)}
              onChange={(v) => setWake(Number(v))}
              options={WAKE_OPTIONS.map((m) => ({ value: String(m), label: formatTime(m) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-muted">Me acuesto</span>
            <Select
              label="Hora de acostarte"
              value={String(bed)}
              onChange={(v) => setBed(Number(v))}
              options={BED_OPTIONS.map((m) => ({ value: String(m), label: formatTime(m) }))}
            />
          </label>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-[11px] text-ink-muted">Aplicar a</legend>
          {(
            [
              ["day", "Solo este día"],
              ["all", allLabel],
            ] as const
          ).map(([id, label]) => (
            <label
              key={id}
              className={cn(
                "flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors duration-150",
                scope === id ? "bg-surface-sunken" : "hover:bg-surface-sunken/60",
              )}
            >
              <input
                type="radio"
                name="sleep-scope"
                checked={scope === id}
                onChange={() => setScope(id)}
                className="size-4 accent-[var(--color-ink)]"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </fieldset>
        <footer className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "items-center justify-between")}>
          {custom ? (
            <GhostButton
              onClick={() => {
                setDaySleep(date, null);
                onClose();
              }}
            >
              Volver a {formatTime(habitual.bed)}–{formatTime(habitual.wake)}
            </GhostButton>
          ) : (
            <GhostButton onClick={onClose}>Cancelar</GhostButton>
          )}
          <PrimaryButton autoFocus className={isMobile ? "h-12" : ""} onClick={save}>
            Guardar
          </PrimaryButton>
        </footer>
      </div>
    </Sheet>
  );
}

/** El horario general de sueño, a mano desde la semana. */
export function SleepDialog({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const sleep = usePlanner((s) => s.sleep);
  const setSleep = usePlanner((s) => s.setSleep);
  const [draft, setDraft] = useState(sleep);
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="sleep-dialog-title" width="max-w-[440px]">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header>
          <h2 id="sleep-dialog-title" className="type-headline">
            Tu horario de sueño
          </h2>
          <p className="type-body mt-1 text-ink-muted">
            Es el marco de tu día: no se agenda nada encima y no entra en tu balance. Para cambiar un día puntual, tocá su
            franja de sueño en el calendario.
          </p>
        </header>
        <SleepEditor value={draft} onChange={setDraft} />
        <footer className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton
            onClick={() => {
              setSleep(draft);
              onClose();
            }}
          >
            Guardar horario
          </PrimaryButton>
        </footer>
      </div>
    </Sheet>
  );
}
