"use client";

import { ArrowUp, CalendarPlus, Check, ListChecks, Loader2, Mic, Pencil, Sparkles, Square, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks";
import { play } from "@/lib/sfx";
import { speak, stopSpeaking } from "@/lib/speech";
import { usePlanner } from "@/lib/store";
import { applyWeekActions, buildContext } from "@/lib/week-ai";
import type { WeekAction, WeekPlan } from "@/lib/week-ai-schema";
import { Sheet } from "./ui";

/** Lo mínimo del reconocimiento de voz del navegador (Chrome/Safari lo traen con prefijo). */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const recognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const EXAMPLES = ["Gimnasio lunes, miércoles y viernes de 7 a 8", "Pasá el almuerzo del viernes a las 14", "Hoy medité 20 minutos y cené con amigos", "Sacá el descanso del sábado"];

const ICON: Record<WeekAction["kind"], LucideIcon> = {
  add_block: CalendarPlus,
  update_block: Pencil,
  remove_block: Trash2,
  clear_week: Trash2,
  add_logro: Trophy,
  add_task: ListChecks,
};

/**
 * El asistente: un botón flotante que abre una hoja para pedirle cambios a tu semana hablando o escribiendo
 * ("sumá yoga los martes a las 19"). Propone y vos confirmás.
 */
export function AssistantFab({ raised }: { raised?: boolean }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-tour="asistente"
        onClick={() => {
          play("open");
          setOpen(true);
        }}
        aria-label="Asistente: pedile cambios a tu semana"
        title="Asistente"
        className={cn(
          "pressable fixed right-4 z-40 grid size-12 place-items-center rounded-full bg-ink text-surface shadow-[var(--shadow-lifted)] transition-[bottom] duration-300 hover:bg-ink/90",
          desktop ? "bottom-6" : raised ? "bottom-[146px]" : "bottom-[78px]",
        )}
      >
        <Sparkles aria-hidden className="size-5" />
      </button>
      {open && <AssistantSheet isMobile={!desktop} onClose={() => setOpen(false)} />}
    </>
  );
}

function AssistantSheet({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const routine = usePlanner((s) => s.routine);
  const setRoutine = usePlanner((s) => s.setRoutine);
  const addLogro = usePlanner((s) => s.addLogro);
  const addTask = usePlanner((s) => s.addTask);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [applied, setApplied] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const history = useRef<{ role: "user" | "assistant"; text: string }[]>([]);
  const rec = useRef<Recognition | null>(null);
  const voiceUsed = useRef(false);
  const canListen = !!recognitionCtor();

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
    return () => {
      rec.current?.stop();
      stopSpeaking();
    };
  }, []);

  const send = async (said?: string) => {
    const ask = (said ?? text).trim();
    if (!ask || loading) return;
    setLoading(true);
    setError("");
    setPlan(null);
    setApplied(false);
    try {
      const res = await fetch("/api/week-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ask, context: buildContext(routine, usePlanner.getState().sleep), history: history.current }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<WeekPlan> & { error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "No pude entender el pedido. Probá de nuevo.");
      const result = { reply: data.reply, actions: data.actions ?? [] };
      history.current = [...history.current, { role: "user" as const, text: ask }, { role: "assistant" as const, text: result.reply }].slice(-8);
      setPlan(result);
      setText("");
      play("pop");
      if (voiceUsed.current) void speak(result.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setLoading(false);
      voiceUsed.current = false;
    }
  };

  const listen = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    stopSpeaking();
    const r = new Ctor();
    r.lang = "es-AR";
    r.interimResults = true;
    r.continuous = false;
    let said = "";
    r.onresult = (e) => {
      said = Array.from(e.results, (x) => x[0].transcript).join(" ");
      setText(said);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Necesito permiso para usar el micrófono.");
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      // Cuando terminás de hablar, se manda solo.
      if (said.trim()) {
        voiceUsed.current = true;
        void send(said);
      }
    };
    rec.current = r;
    setError("");
    setListening(true);
    play("click");
    r.start();
  };

  const apply = () => {
    if (!plan) return;
    const next = applyWeekActions(usePlanner.getState().routine, plan.actions, { addLogro, addTask });
    setRoutine(next, []);
    setApplied(true);
    play("complete");
  };

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="assistant-title" width="max-w-[480px]">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-surface">
            <Sparkles aria-hidden className="size-5" />
          </span>
          <div>
            <h2 id="assistant-title" className="type-headline">
              Asistente
            </h2>
            <p className="text-[13px] leading-snug text-ink-muted">Decime qué querés cambiar en tu semana. Te muestro la propuesta y vos la aplicás.</p>
          </div>
        </div>

        {enabled === false && (
          <p role="status" className="rounded-lg bg-surface-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-muted">
            El asistente todavía no está activado: falta la clave de Claude en el servidor (ANTHROPIC_API_KEY).
          </p>
        )}

        {!plan && !loading && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText(ex)} className="pressable rounded-full bg-surface-sunken px-3 py-1.5 text-left text-[12px] text-ink-muted hover:text-ink">
                {ex}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p className="flex items-center gap-2 text-[13px] text-ink-muted" role="status">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Pensando…
          </p>
        )}

        {plan && (
          <div className="animate-fade-up flex flex-col gap-3 rounded-xl bg-surface-sunken/70 p-3">
            <p className="text-[14px] leading-snug">{plan.reply}</p>
            {plan.actions.length > 0 && (
              <>
                <ul className="flex flex-col gap-1.5">
                  {plan.actions.map((a, i) => {
                    const Icon = ICON[a.kind];
                    return (
                      <li key={i} className={cn("flex items-start gap-2 text-[13px]", (a.kind === "remove_block" || a.kind === "clear_week") && "text-danger")}>
                        <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                        {a.summary}
                      </li>
                    );
                  })}
                </ul>
                {applied ? (
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                    <Check aria-hidden className="size-4" />
                    Listo, ya está en tu semana.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={apply} className="pressable h-10 flex-1 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-surface hover:bg-ink/90">
                      Aplicar cambios
                    </button>
                    <button type="button" onClick={() => setPlan(null)} className="pressable h-10 rounded-full px-4 text-[13.5px] font-medium text-ink-muted hover:bg-surface hover:text-ink">
                      Descartar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-[13px] leading-snug text-danger">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={listening ? "Te escucho…" : "Escribí o tocá el micrófono"}
            aria-label="Pedido para el asistente"
            enterKeyHint="send"
            className="min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug focus:border-ink focus:outline-none"
          />
          {canListen && (
            <button
              type="button"
              onClick={listen}
              aria-label={listening ? "Dejar de escuchar" : "Hablar"}
              aria-pressed={listening}
              className={cn(
                "pressable relative grid size-11 shrink-0 place-items-center rounded-full",
                listening ? "bg-danger text-white" : "bg-surface-sunken text-ink hover:bg-line",
              )}
            >
              {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
              {listening ? <Square aria-hidden className="relative size-4" /> : <Mic aria-hidden className="size-5" />}
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim() || loading}
            aria-label="Enviar"
            className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-ink text-surface hover:bg-ink/90 disabled:opacity-30"
          >
            <ArrowUp aria-hidden className="size-5" />
          </button>
        </form>
      </div>
    </Sheet>
  );
}
