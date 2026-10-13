"use client";

import { BellRing, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_ALERTS, dueAlert, markAlertSeen, shouldHighlightAlerts, type AlertSettings, type DueAlert } from "@/lib/alerts";
import { addDays, toKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { useMediaQuery } from "@/lib/hooks";
import { cheer } from "@/lib/motivation";
import { play } from "@/lib/sfx";
import { usePlanner } from "@/lib/store";
import { PrimaryButton, Select, Sheet } from "./ui";

const TIMES = Array.from({ length: 36 }, (_, k) => 6 * 60 + k * 30); // 06:00 a 23:30
const DAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Lunes" },
  { value: "6", label: "Sábado" },
];

/**
 * La ruedita ⚙️ de arriba a la derecha: cuándo te recuerda la app completar tus cosas (no son los
 * recordatorios). El día siguiente a terminar la guía, si no la configuraste, se resalta.
 */
export function AlertsButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const highlight = usePlanner((s) => shouldHighlightAlerts(s));
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-tour="alertas"
        aria-label="Configurar alertas"
        title="Alertas: cuándo te aviso"
        onClick={() => {
          play("open");
          setOpen(true);
        }}
        className={cn("pressable grid place-items-center text-ink hover:bg-surface/70", compact ? "size-8" : "size-10", highlight ? "rounded-full ring-[3px] ring-[#d99a00] motion-safe:animate-pulse" : "rounded-md")}
      >
        <Settings aria-hidden className="size-4" />
      </button>
      {highlight && !compact && (
        <span className="animate-fade-up pointer-events-none absolute top-full right-0 z-[56] mt-2 w-max rounded-xl bg-[#d99a00] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[var(--shadow-popover)]">
          ↑ Configurá cuándo te aviso
        </span>
      )}
      {open && <AlertsSheet isMobile={!desktop} onClose={() => setOpen(false)} />}
    </span>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", on ? "bg-success" : "bg-ink/20")}>
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]", on && "translate-x-4")} />
    </button>
  );
}

function Row({ title, hint, on, onChange, children }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken/60 px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">{title}</p>
          <p className="text-[12px] leading-snug text-ink-muted">{hint}</p>
        </div>
        <Toggle on={on} onChange={onChange} label={title} />
      </div>
      {on && children}
    </div>
  );
}

function AlertsSheet({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const saved = usePlanner((s) => s.alerts);
  const setAlerts = usePlanner((s) => s.setAlerts);
  const [a, setA] = useState<AlertSettings>({ ...DEFAULT_ALERTS, ...saved });
  const set = (p: Partial<AlertSettings>) => setA((x) => ({ ...x, ...p }));
  const time = (v: number, onChange: (m: number) => void, label: string) => <Select label={label} value={String(v)} onChange={(x) => onChange(Number(x))} options={TIMES.map((m) => ({ value: String(m), label: formatTime(m) }))} className="w-[110px]" />;
  const save = () => {
    setAlerts({ ...a, configured: true });
    play("complete");
    cheer("setupStep", "Listo: ya sé cuándo avisarte ✓");
    onClose();
  };
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="alerts-title" width="max-w-[520px]">
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-line py-2.5 pr-2.5 pl-5">
          <h2 id="alerts-title" data-autofocus tabIndex={-1} className="flex items-center gap-2 type-title outline-none">
            <Settings aria-hidden className="size-5 text-ink-muted" />
            Alertas
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="pressable grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <p className="text-[12.5px] text-ink-muted">Cuándo te recuerdo completar tus cosas. No son tus recordatorios: son los avisos de la app. Por ahora te aviso cuando la tenés abierta.</p>

          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">No negociables</h3>
            <Row title="A la mañana, al abrir la app" hint="Te muestro los de hoy para arrancar el día." on={a.nonegMorning} onChange={(v) => set({ nonegMorning: v })} />
            <Row title="A la noche, si te faltan" hint="Para que los marques antes de dormir." on={a.nonegNight} onChange={(v) => set({ nonegNight: v })}>
              <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">A partir de las {time(a.nonegNightAt, (m) => set({ nonegNightAt: m }), "Hora del aviso de la noche")}</div>
            </Row>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">Rutina semanal</h3>
            <Row title="Reconfirmar la semana" hint="Repetís la misma semana o la modificás." on={a.routine} onChange={(v) => set({ routine: v })}>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">
                <Select label="Día" value={String(a.routineDay)} onChange={(x) => set({ routineDay: Number(x) })} options={DAYS} className="w-[130px]" />
                a las {time(a.routineAt, (m) => set({ routineAt: m }), "Hora de reconfirmar la rutina")}
              </div>
            </Row>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">Cómo venís</h3>
            <Row title="Avisos de progreso" hint="A mitad de semana, cómo viene tu balde y qué le falta; y tus metas del mes, si se atrasan." on={a.progress} onChange={(v) => set({ progress: v })} />
          </section>
        </div>
        <footer className="flex justify-end border-t border-line p-3">
          <PrimaryButton type="button" onClick={save}>
            Guardar
          </PrimaryButton>
        </footer>
      </div>
    </Sheet>
  );
}

/** Ir a un módulo (en el celular, a su pestaña) y dejarlo abierto. */
function goTo(id: "diarios" | "semana" | "metas", tab: string) {
  window.dispatchEvent(new CustomEvent("lb:go-tab", { detail: tab }));
  window.dispatchEvent(new CustomEvent("lb:module-expand", { detail: { id } }));
  window.setTimeout(() => document.querySelector(`[data-module="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 120);
}

/**
 * Las alertas que tocan: una por vez, en una tarjeta arriba a la derecha (debajo de la ruedita). Se revisa al
 * abrir la app y cada minuto. Cada una se muestra una sola vez.
 */
export function AlertsRunner() {
  const setupDone = usePlanner((s) => s.setupDone);
  const [alert, setAlert] = useState<DueAlert | null>(null);
  useEffect(() => {
    if (!setupDone) return;
    const check = () => {
      if (document.querySelector("dialog[open]")) return;
      setAlert((cur) => cur ?? dueAlert(usePlanner.getState()));
    };
    const first = window.setTimeout(check, 1500);
    const t = window.setInterval(check, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [setupDone]);
  useEffect(() => {
    if (alert) play("open");
  }, [alert?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!alert) return null;
  const done = () => {
    markAlertSeen(alert.id);
    setAlert(null);
  };
  type Act = { label: string; run: () => void; primary?: boolean };
  const acts: Act[] =
    alert.kind === "noneg-am" || alert.kind === "noneg-pm"
      ? [{ label: "Ir a marcarlos", run: () => goTo("diarios", "objetivos"), primary: true }]
      : alert.kind === "rutina"
        ? [
            { label: "Repetir la misma semana", run: () => cheer("routine", "Listo: tu semana sigue igual ✓"), primary: true },
            { label: "Modificarla", run: () => goTo("semana", "semana") },
          ]
        : alert.kind === "balde"
          ? [
              {
                label: "Sumar un rato",
                primary: true,
                run: () => {
                  goTo("semana", "semana");
                  const day = addDays(new Date(), 1).getDay();
                  window.setTimeout(() => window.dispatchEvent(new CustomEvent("lb:add-block", { detail: { name: "", quadrant: alert.part ?? "cuerpo", days: [day], start: 19 * 60, minutes: 60 } })), 200);
                },
              },
            ]
          : [
              {
                label: "Pasarlas al mes siguiente",
                primary: true,
                run: () => {
                  const st = usePlanner.getState();
                  const month = toKey(new Date()).slice(0, 7);
                  const [y, m] = month.split("-").map(Number);
                  const next = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, "0")}`;
                  for (const t of st.tasks.filter((x) => x.month === month && !x.done)) st.moveTask(t.id, next);
                  cheer("goalPostponed");
                },
              },
              { label: "Todavía tengo tiempo", run: () => {} },
            ];
  return (
    <div role="status" className="animate-fade-up fixed top-[68px] right-3 left-3 z-[65] rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-popover)] sm:left-auto sm:w-[360px]">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-success">
          <BellRing aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug font-semibold">{alert.title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{alert.body}</p>
        </div>
        <button type="button" aria-label="Cerrar" onClick={done} className="pressable -mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
        {acts.map((x) => (
          <button
            key={x.label}
            type="button"
            onClick={() => {
              x.run();
              done();
            }}
            className={cn("pressable h-8 rounded-full px-3.5 text-[12.5px] font-semibold", x.primary ? "bg-ink text-surface hover:bg-ink/90" : "ring-1 ring-line hover:bg-surface-sunken")}
          >
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}
