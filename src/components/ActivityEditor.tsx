"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { SUGGESTED_ACTIVITIES } from "@/lib/activities";
import { cn } from "@/lib/format";
import { QUADRANT_BY_ID, quadrantStyle, type QuadrantId } from "@/lib/quadrants";

interface ActivityEditorProps {
  quadrant: QuadrantId;
  names: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

/** Actividades elegidas (con quitar) + sugerencias para sumar + una propia. */
export function ActivityEditor({ quadrant, names, onAdd, onRemove }: ActivityEditorProps) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const suggestions = SUGGESTED_ACTIVITIES[quadrant].filter((s) => !lower.has(s.toLowerCase()));
  const qName = QUADRANT_BY_ID[quadrant].name;

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    if (!lower.has(name.toLowerCase())) onAdd(name);
    setDraft("");
  };

  return (
    <div style={quadrantStyle(quadrant)} className="flex flex-col gap-4">
      <ul aria-label={`Tus actividades de ${qName}`} className="flex min-h-9 flex-wrap gap-1.5">
        {names.length === 0 && (
          <li className="type-body flex items-center text-ink-muted">Todavía no elegiste ninguna.</li>
        )}
        {names.map((name) => (
          <li key={name}>
            <span className="inline-flex h-9 items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--q)_35%,transparent)] bg-[var(--q-soft)] pr-1 pl-3.5 text-[13px] font-medium">
              {name}
              <button
                type="button"
                onClick={() => onRemove(name)}
                aria-label={`Quitar ${name}`}
                className="pressable grid size-7 place-items-center rounded-full text-[color-mix(in_oklab,var(--q)_60%,var(--color-ink))] hover:bg-surface/70"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="type-label text-ink-muted">Sugerencias</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAdd(s)}
                className="pressable inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] text-ink-muted hover:border-[var(--q)] hover:text-ink"
              >
                <Plus aria-hidden className="size-3.5" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No es un <form>: el onboarding ya envuelve todo en uno y no se pueden anidar. */}
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Otra actividad de {qName}
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Otra actividad…"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-[13px] placeholder:text-ink-muted/80 focus:border-ink focus:shadow-[0_0_0_3px_rgba(37,40,54,0.08)] focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className={cn(
            "pressable h-10 rounded-md border border-line bg-surface px-3.5 text-[13px] font-medium hover:bg-surface-sunken",
            "disabled:opacity-40",
          )}
        >
          Sumar
        </button>
      </div>
    </div>
  );
}
