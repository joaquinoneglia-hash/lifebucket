"use client";

import { ArrowRight, ArrowUp, Check, Mic, MicOff, Pencil, Plus, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AssistantTurn, Plan } from "@/lib/assistant-schema";
import { applyPlan, buildContext, firstDayOfPlan, resolvePlan, type ResolvedAction } from "@/lib/assistant";
import { aiEnabled } from "@/lib/coach";
import type { DateKey } from "@/lib/dates";
import { cn } from "@/lib/format";
import { useDictation } from "@/lib/hooks";
import { quadrantStyle } from "@/lib/quadrants";
import { QuadrantIcon } from "./QuadrantIcon";
import { GhostButton, PrimaryButton, Sheet } from "./ui";

type Entry =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; plan: ResolvedAction[]; state: "pending" | "applied" | "discarded"; applied?: number }
  | { role: "error"; text: string };

const SUGGESTIONS = [
  "Gimnasio lunes, miércoles y viernes a las 7, una hora",
  "Esta semana quiero más tiempo para Alma",
  "Se me complicó el jueves: pasá lo de la tarde al viernes",
];

const KIND_ICON: Record<string, LucideIcon> = {
  add: Plus,
  move: ArrowRight,
  update: Pencil,
  remove: Trash2,
  mark: Check,
};

interface AssistantPanelProps {
  isMobile: boolean;
  onClose: () => void;
  /** Para mostrar la semana donde quedaron los cambios. */
  onApplied: (firstDay: DateKey | undefined) => void;
}

/** Le contás qué querés (escrito o hablado) y te propone cambios en la semana para que los confirmes. */
export function AssistantPanel({ isMobile, onClose, onApplied }: AssistantPanelProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // null mientras consultamos; false si el servidor no tiene la clave de Claude.
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  useEffect(() => {
    aiEnabled().then(setAiOn);
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation(setInput);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, loading]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;
    dictation.stop();
    setInput("");

    // El historial para el modelo: lo que dijo cada uno, con un resumen de lo propuesto.
    const turns: AssistantTurn[] = [];
    for (const e of entries) {
      if (e.role === "user") turns.push({ role: "user", text: e.text });
      else if (e.role === "assistant") {
        const plan = e.plan.map((p) => `- ${p.action.summary}`).join("\n");
        const outcome = e.state === "applied" ? "(el usuario aplicó estos cambios)" : e.state === "discarded" ? "(el usuario los descartó)" : "";
        turns.push({ role: "assistant", text: [e.text, plan, outcome].filter(Boolean).join("\n") });
      }
    }
    turns.push({ role: "user", text: clean });
    setEntries((es) => [...es, { role: "user", text: clean }]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns, context: buildContext() }),
      });
      const data = (await res.json()) as Plan | { error: string };
      if (!res.ok || "error" in data) {
        setEntries((es) => [...es, { role: "error", text: "error" in data ? data.error : "Algo salió mal." }]);
        return;
      }
      setEntries((es) => [...es, { role: "assistant", text: data.reply, plan: resolvePlan(data.actions), state: "pending" }]);
    } catch {
      setEntries((es) => [...es, { role: "error", text: "No me pude conectar. Revisá tu conexión y probá de nuevo." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const decide = (index: number, apply: boolean) => {
    const entry = entries[index];
    if (entry?.role !== "assistant" || entry.state !== "pending") return;
    // Los cambios se aplican acá, una sola vez; el actualizador de estado tiene que ser puro.
    const applied = apply ? applyPlan(entry.plan) : 0;
    if (apply) onApplied(firstDayOfPlan(entry.plan));
    setEntries((es) =>
      es.map((e, i) =>
        i === index && e.role === "assistant"
          ? { ...e, state: apply ? "applied" : "discarded", applied }
          : e,
      ),
    );
  };

  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="assistant-title" width="max-w-[440px]" side>
      <div className={cn("flex flex-col", isMobile ? "h-[86dvh]" : "h-dvh")}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-ink text-surface">
              <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 id="assistant-title" className="type-title">
                Asistente
              </h2>
              <p className="text-[12px] text-ink-muted">Te armo la semana. Vos confirmás.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="pressable grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div ref={listRef} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5" aria-live="polite">
          {aiOn === false && (
            <div className="rounded-lg bg-surface-sunken p-4 text-[13px] leading-snug">
              <p className="font-semibold">Falta un paso para usar el asistente</p>
              <p className="mt-1 text-ink-muted">
                Necesita la clave de la API de Claude. Copiá <code className="font-mono text-[12px]">.env.example</code> como{" "}
                <code className="font-mono text-[12px]">.env.local</code>, pegá tu clave en{" "}
                <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> y reiniciá la app.
              </p>
            </div>
          )}

          {aiOn !== false && entries.length === 0 && !loading && (
            <div className="flex flex-col gap-4">
              <p className="type-body text-ink-muted">
                Contame qué querés hacer, como te salga: qué actividades, qué días, qué te cambió. Yo propongo los
                bloques y vos decidís si los agrego.
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="pressable rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left text-[13px] text-ink hover:bg-surface-sunken"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map((e, i) =>
            e.role === "user" ? (
              <p
                key={i}
                className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[14px] leading-snug text-surface"
              >
                {e.text}
              </p>
            ) : e.role === "error" ? (
              <p key={i} role="alert" className="rounded-lg bg-surface-sunken px-3.5 py-2.5 text-[13px] text-ink">
                {e.text}
              </p>
            ) : (
              <div key={i} className="animate-fade-up flex flex-col gap-3">
                <p className="text-[14px] leading-snug text-ink">{e.text}</p>
                {e.plan.length > 0 && (
                  <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
                    <ul className="flex flex-col gap-1.5">
                      {e.plan.map((p, j) => {
                        const Icon = KIND_ICON[p.action.kind] ?? Plus;
                        return (
                          <li
                            key={j}
                            style={quadrantStyle(p.quadrant)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg bg-[var(--q-soft)] px-2.5 py-2",
                              e.state === "discarded" && "opacity-50",
                            )}
                          >
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface/80 text-[var(--q)]">
                              <QuadrantIcon id={p.quadrant} className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">{p.label}</p>
                              <p className="line-clamp-2 text-[12px] leading-snug text-[color-mix(in_oklab,var(--q)_55%,var(--color-ink))] tabular-nums">
                                {p.detail}
                              </p>
                            </div>
                            <Icon aria-label={p.action.kind} className="size-3.5 shrink-0 text-ink-muted" />
                          </li>
                        );
                      })}
                    </ul>
                    {e.state === "pending" ? (
                      <div className="flex items-center justify-end gap-1">
                        <GhostButton className="h-9" onClick={() => decide(i, false)}>
                          Descartar
                        </GhostButton>
                        <PrimaryButton className="h-9 px-4" onClick={() => decide(i, true)}>
                          {e.plan.length === 1 ? "Aplicar cambio" : `Aplicar ${e.plan.length} cambios`}
                        </PrimaryButton>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                        {e.state === "applied" ? (
                          <>
                            <Check aria-hidden className="size-3.5" />
                            {e.applied === 1 ? "Listo, apliqué 1 cambio." : `Listo, apliqué ${e.applied} cambios.`}
                          </>
                        ) : (
                          "Descartado. No cambié nada."
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {loading && (
            <p className="flex items-center gap-2 text-[13px] text-ink-muted" role="status">
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <span key={d} className="animate-typing size-1.5 rounded-full bg-ink-muted" style={{ animationDelay: `${d * 160}ms` }} />
                ))}
              </span>
              Armando tu semana…
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        >
          {dictation.error && <p className="mb-2 px-1 text-[12px] text-danger">{dictation.error}</p>}
          <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(37,40,54,0.08)]">
            <label htmlFor="assistant-input" className="sr-only">
              Tu pedido
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              data-autofocus
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={dictation.listening ? "Te escucho…" : "Escribí o dictá qué querés hacer"}
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-snug placeholder:text-ink-muted/80 focus:outline-none [field-sizing:content]"
            />
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.listening ? dictation.stop : dictation.start}
                aria-label={dictation.listening ? "Dejar de dictar" : "Dictar por voz"}
                aria-pressed={dictation.listening}
                className={cn(
                  "pressable grid size-9 shrink-0 place-items-center rounded-lg",
                  dictation.listening ? "bg-ink text-surface" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {dictation.listening ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || loading || aiOn === false}
              aria-label="Enviar"
              className="pressable grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-surface disabled:opacity-30"
            >
              <ArrowUp aria-hidden className="size-4" />
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}
