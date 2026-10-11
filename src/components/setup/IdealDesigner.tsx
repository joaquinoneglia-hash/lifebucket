"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { QUADRANT_BY_ID, type QuadrantId, type QuadrantRecord } from "@/lib/quadrants";
import { WHO_ACTIVITY_MINUTES } from "@/lib/benchmarks";
import { placeActivity, routineMinutes, routineSummary, type RoutineBlock } from "@/lib/routine";
import { editIdeal, weekContext } from "@/lib/setup-ai";
import type { SleepSettings } from "@/lib/sleep";
import { Insight } from "../Insight";
import { Composer } from "./Composer";
import { WeekCompare } from "./WeekCompare";
import { WeekTemplateGrid } from "./WeekTemplateGrid";

const h = (m: number) => `${Math.round(m / 30) / 2} h`.replace(".", ",");

/** Lo que cambió entre tu semana de hoy y la ideal, en una frase (se actualiza en vivo). */
function liveTip(before: QuadrantRecord<number>, after: QuadrantRecord<number>): string {
  const life: QuadrantId[] = ["cuerpo", "mente", "alma", "vinculos"];
  const deltas = life.map((id) => ({ id, d: after[id] - before[id] })).sort((a, b) => b.d - a.d);
  const up = deltas[0];
  const libreDrop = before.libre - after.libre;
  if (up.d <= 0 && libreDrop < 180) {
    return "Tocá un hueco del calendario para sumar algo, o pedímelo: \"quiero entrenar dos veces por semana a la mañana\".";
  }
  const parts: string[] = [];
  if (up.d > 0) parts.push(`Sumaste ${h(up.d)} de ${QUADRANT_BY_ID[up.id].name} por semana.`);
  if (before.cuerpo < WHO_ACTIVITY_MINUTES && after.cuerpo >= WHO_ACTIVITY_MINUTES) parts.push("Con esto llegás a lo que recomienda la OMS para tu cuerpo.");
  else if (after.cuerpo < WHO_ACTIVITY_MINUTES) parts.push(`Tu cuerpo sigue en ${h(after.cuerpo)}: la OMS recomienda 2 h 30.`);
  const missing = life.filter((id) => id !== "vinculos" && after[id] === 0).map((id) => QUADRANT_BY_ID[id].name);
  if (missing.length) parts.push(`¿Y ${missing.join(" y ")}? Hoy no tienen ni un minuto.`);
  if (libreDrop >= 180) parts.push(`Tu tiempo libre baja de ${h(before.libre)} a ${h(after.libre)}: ¿te alcanza para descansar?`);
  return parts.slice(0, 2).join(" ");
}

type Message = { role: "me" | "guide"; text: string; ai?: boolean };

/**
 * "¿Cómo querés tu semana?": el mismo calendario con tu semana de hoy como fantasma detrás.
 * Sumás, movés o sacás bloques (tocando, o pidiéndoselo al asistente) y a la derecha ves en vivo
 * cómo cambia tu distribución contra la de hoy.
 */
export function IdealDesigner({
  baseline,
  template,
  onChange,
  sleep,
  gridHeight = 560,
}: {
  baseline: RoutineBlock[];
  template: RoutineBlock[];
  onChange: (t: RoutineBlock[]) => void;
  sleep: SleepSettings;
  gridHeight?: number;
}) {
  const before = routineMinutes(baseline, sleep);
  const after = routineMinutes(template, sleep);
  const [messages, setMessages] = useState<Message[]>([
    { role: "guide", text: "Contame qué te gustaría cambiar. Por ejemplo: \"quiero entrenar dos veces por semana\", \"sumá una salida con amigos el sábado\" o \"sacá el curso\"." },
  ]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (text: string) => {
    setMessages((m) => [...m, { role: "me", text }]);
    setBusy(true);
    const r = await editIdeal(text, template, weekContext(after, routineSummary(template), `Semana de hoy: ${routineSummary(baseline)}`));
    setBusy(false);
    let next = template.filter((b) => !r.remove.some((n) => n.toLowerCase() === b.name.toLowerCase()));
    const added: string[] = [];
    const missing: string[] = [];
    for (const spec of r.add) {
      // "Más" de algo que ya está: se reemplaza por la nueva cantidad.
      next = next.filter((b) => !(b.quadrant === spec.quadrant && b.name.toLowerCase() === spec.name.toLowerCase()));
      const placed = placeActivity(next, sleep, spec);
      if (!placed.length) missing.push(spec.name.toLowerCase());
      added.push(...placed.map((b) => b.id));
      next = [...next, ...placed];
    }
    setFresh(added);
    onChange(next);
    const note = missing.length ? ` Ojo: ${missing.join(" y ")} no entra en tu semana tal como está; probá con menos tiempo o liberá un hueco.` : "";
    setMessages((m) => [...m, { role: "guide", text: r.reply + note, ai: r.source === "ai" }]);
  };

  return (
    <div className="@container">
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <WeekTemplateGrid template={template} ghost={baseline} sleep={sleep} onChange={onChange} height={gridHeight} highlight={fresh} />
          <p className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-muted">
            <span aria-hidden className="h-3 w-5 rounded-[4px] border border-dashed border-ink-faint" />
            Punteado: tu semana de hoy. Tocá un hueco para sumar, o un bloque para cambiarlo.
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <WeekCompare mine={after} other={before} mineLabel="Ideal" otherLabel="Hoy" variant="before" />
          <Insight>{liveTip(before, after)}</Insight>

          <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5">
            <div ref={listRef} className="flex max-h-48 flex-col gap-2 overflow-y-auto" aria-live="polite">
              {messages.map((m, i) => (
                <p
                  key={i}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-snug",
                    m.role === "guide" ? "self-start rounded-bl-md bg-surface-sunken" : "self-end rounded-br-md bg-ink text-surface",
                  )}
                >
                  {m.ai && <Sparkles aria-label="Con IA" className="mr-1 inline size-3 -translate-y-px text-ink-muted" strokeWidth={1.75} />}
                  {m.text}
                </p>
              ))}
              {busy && (
                <span className="flex gap-1 self-start rounded-2xl bg-surface-sunken px-3 py-2.5" role="status" aria-label="Pensando">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="animate-typing size-1.5 rounded-full bg-ink-muted" style={{ animationDelay: `${d * 160}ms` }} />
                  ))}
                </span>
              )}
            </div>
            <Composer onSend={ask} busy={busy} placeholder="Ej: quiero meditar todas las mañanas" />
          </div>
        </aside>
      </div>
    </div>
  );
}
