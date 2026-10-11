"use client";

import { Keyboard, Mic, SkipForward, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { speechCtor, type SpeechRecognitionLike } from "@/lib/hooks";
import { buildRoutine, routineMinutes, routineSummary, type ActivitySpec } from "@/lib/routine";
import { interpret, weekContext, type SetupStep } from "@/lib/setup-ai";
import type { SleepSettings } from "@/lib/sleep";
import type { Job } from "@/lib/store";
import { speak, stopSpeaking } from "@/lib/speech";
import { BrandMark } from "../BrandMark";
import { Composer } from "./Composer";

const STEPS: SetupStep[] = ["name", "sleep", "work", "cuerpo", "mente", "alma"];

const QUESTION: Record<string, (name: string) => string> = {
  name: () => "Hola. Vamos a armar tu semana tal cual es hoy. ¿Cómo te llamás?",
  sleep: (n) => `${n ? `Bien, ${n}. ` : ""}¿A qué hora te acostás y a qué hora te levantás? Si el fin de semana cambia, contame.`,
  work: () => "¿Trabajás? Decime días y horarios. Si además tenés un emprendimiento, también.",
  cuerpo: () => "¿Hacés algo por tu cuerpo? Por ejemplo gimnasio, correr o yoga. ¿Cuántas veces por semana?",
  mente: () => "¿Y por tu mente? Estudiar, leer, un curso…",
  alma: () => "Última: ¿algo que te recargue? Meditar, arte, música…",
};

type Phase = "speaking" | "listening" | "thinking" | "retry" | "done";

/**
 * "Armala hablando": la app te pregunta en voz alta, te escucha y va completando lo fijo y tu
 * rutina. Entiende con IA si hay clave (si no, por reglas). Se puede escribir en vez de hablar.
 */
export function VoiceGuide({
  state,
  onName,
  onSleep,
  onJobs,
  onSpecs,
  onClose,
  onDone,
}: {
  state: { name: string; sleep: SleepSettings; jobs: Job[]; specs: ActivitySpec[] };
  onName: (n: string) => void;
  onSleep: (s: SleepSettings) => void;
  onJobs: (j: Job[]) => void;
  onSpecs: (s: ActivitySpec[]) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("speaking");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [typing, setTyping] = useState(!speechCtor());
  const latest = useRef(state);
  latest.current = state;
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      recRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const current = STEPS[step];
  const question = current ? QUESTION[current](latest.current.name) : "";

  const listen = useCallback((): Promise<string> => {
    const Ctor = speechCtor();
    if (!Ctor) return Promise.resolve("");
    return new Promise((resolve) => {
      const rec = new Ctor();
      rec.lang = "es-AR";
      rec.continuous = false;
      rec.interimResults = true;
      let finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        setHeard((finalText + interim).trim());
      };
      rec.onerror = () => undefined;
      rec.onend = () => resolve(finalText.trim());
      recRef.current = rec;
      rec.start();
    });
  }, []);

  /** Lo que respondiste (hablado o escrito): lo entiende, completa y sigue. */
  const answer = useCallback(
    async (text: string) => {
      if (!current) return;
      setPhase("thinking");
      setHeard(text);
      const s = latest.current;
      const week = buildRoutine(s.jobs, s.specs, s.sleep);
      const r = await interpret(current, question, text, s.sleep, weekContext(routineMinutes(week, s.sleep), routineSummary(week)));
      if (!alive.current) return;
      if (r.name) onName(r.name);
      if (r.sleep) onSleep(r.sleep);
      if (r.jobs) onJobs(r.jobs);
      if (r.activities.length || r.none) {
        const others = s.specs.filter((x) => !r.activities.some((a) => a.name.toLowerCase() === x.name.toLowerCase()));
        onSpecs(r.none ? others.filter((x) => x.quadrant !== current) : [...others, ...r.activities]);
      }
      const ok =
        current === "name" ? !!r.name : current === "sleep" ? !!r.sleep : current === "work" ? !!r.jobs : r.none || r.activities.length > 0;
      if (!ok) {
        setSaid("No te entendí bien. ¿Me lo repetís?");
        setPhase("retry");
        return;
      }
      setSaid(r.reply);
      setStep((i) => i + 1);
      setPhase("speaking");
    },
    [current, question, onName, onSleep, onJobs, onSpecs],
  );

  // El ciclo de cada pregunta: hablar → escuchar → entender.
  useEffect(() => {
    if (phase !== "speaking") return;
    let cancelled = false;
    (async () => {
      if (!current) {
        await speak(`${said} Listo, ya tengo tu semana.`);
        if (!cancelled) {
          setPhase("done");
          onDone();
        }
        return;
      }
      setHeard("");
      await speak(said ? `${said} ${question}` : question);
      if (cancelled || typing) return;
      setPhase("listening");
      const text = await listen();
      if (cancelled || !alive.current) return;
      if (text) answer(text);
      else {
        setSaid("No te escuché.");
        setPhase("retry");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  const retry = () => {
    setSaid("");
    setPhase("speaking");
  };
  const skip = () => {
    recRef.current?.stop();
    setSaid("");
    setStep((i) => i + 1);
    setPhase("speaking");
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Armá tu semana hablando" className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--color-canvas)_70%,transparent)] p-4 backdrop-blur-xl">
      <div className="card animate-sheet-in relative flex w-full max-w-[520px] flex-col items-center gap-6 px-6 pt-10 pb-6 text-center sm:px-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar y seguir con el formulario"
          className="pressable absolute top-3 right-3 grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>

        <div className="relative grid place-items-center">
          {phase === "listening" && <span aria-hidden className="absolute size-36 animate-ping rounded-full bg-[color-mix(in_oklab,var(--color-mente)_18%,transparent)]" />}
          <BrandMark size={96} animated={phase === "speaking" || phase === "thinking"} />
        </div>

        <ol className="flex gap-1.5" aria-label={`Pregunta ${Math.min(step + 1, STEPS.length)} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className={cn("h-1.5 w-6 rounded-full transition-colors", i < step ? "bg-ink" : i === step ? "bg-ink/50" : "bg-line")} />
          ))}
        </ol>

        <div className="flex min-h-[120px] flex-col gap-3" aria-live="polite">
          {said && phase !== "retry" && (
            <p className="flex items-start justify-center gap-1.5 text-[13px] text-ink-muted">
              <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              {said}
            </p>
          )}
          <p className="text-[19px] leading-snug font-semibold tracking-[-0.01em]">{phase === "retry" ? said : question || "Listo, ya tengo tu semana."}</p>
          <p className={cn("min-h-6 text-[15px] italic", heard ? "text-ink" : "text-ink-faint")}>
            {phase === "thinking" ? "Entendiendo…" : heard ? `“${heard}”` : phase === "listening" ? "Te escucho…" : ""}
          </p>
        </div>

        {typing ? (
          <div className="w-full text-left">
            <Composer key={step} onSend={answer} busy={phase === "thinking"} placeholder="Escribí tu respuesta" autoFocus />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {phase === "retry" ? (
              <button type="button" onClick={retry} className="pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 font-medium text-surface">
                <Mic aria-hidden className="size-4" />
                Repetir
              </button>
            ) : phase === "listening" ? (
              <button type="button" onClick={() => recRef.current?.stop()} className="pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 font-medium text-surface">
                Listo, ya respondí
              </button>
            ) : null}
            <button type="button" onClick={skip} className="pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <SkipForward aria-hidden className="size-4" />
              Saltear
            </button>
            <button
              type="button"
              onClick={() => {
                recRef.current?.stop();
                setTyping(true);
              }}
              className="pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Keyboard aria-hidden className="size-4" />
              Prefiero escribir
            </button>
          </div>
        )}
        <p className="text-[11px] text-ink-faint">La voz es de ElevenLabs (o la de tu navegador si no está disponible). Para entenderte usamos IA, si está configurada.</p>
      </div>
    </div>
  );
}
