"use client";

import { Repeat2 } from "lucide-react";
import { QUADRANTS, quadrantStyle } from "@/lib/quadrants";
import { usePlanner } from "@/lib/store";
import { ActivityEditor } from "./ActivityEditor";
import { QuadrantIcon } from "./QuadrantIcon";

/** Configuración de actividades por cuadrante (las mismas del arranque). */
export function ActivitiesView({ onOpenSetup }: { onOpenSetup?: () => void }) {
  const activities = usePlanner((s) => s.activities);
  const addActivity = usePlanner((s) => s.addActivity);
  const removeActivity = usePlanner((s) => s.removeActivity);

  return (
    <div className="flex flex-col gap-5">
      {onOpenSetup && (
        <button
          type="button"
          onClick={onOpenSetup}
          className="pressable card flex items-center gap-3 p-4 text-left hover:bg-surface-sunken/60"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-surface">
            <Repeat2 aria-hidden className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block type-title">Tu semana base</span>
            <span className="block text-[13px] text-ink-muted">Lo que se repite todas las semanas y los espacios que te quedan libres.</span>
          </span>
        </button>
      )}
      <p className="type-body max-w-[60ch] text-ink-muted">
        Son las opciones que ves al agregar un bloque. Quitar una no borra los bloques que ya armaste.
      </p>
      <div className="card divide-y divide-line">
        {QUADRANTS.map((q) => {
          const mine = activities.filter((a) => a.quadrant === q.id);
          return (
            <section
              key={q.id}
              aria-labelledby={`act-${q.id}`}
              className="grid gap-4 p-5 md:grid-cols-[200px_1fr] md:gap-8 md:p-6"
            >
              <div className="flex items-center gap-3 self-start" style={quadrantStyle(q.id)}>
                <span className="grid size-9 place-items-center rounded-full bg-[var(--q-soft)] text-[var(--q)]">
                  <QuadrantIcon id={q.id} className="size-4" />
                </span>
                <div>
                  <h2 id={`act-${q.id}`} className="type-title">
                    {q.name}
                  </h2>
                  <p className="type-label text-ink-muted">{q.hint}</p>
                </div>
              </div>
              <ActivityEditor
                quadrant={q.id}
                names={mine.map((a) => a.name)}
                onAdd={(name) => addActivity(q.id, name)}
                onRemove={(name) => {
                  const a = mine.find((x) => x.name === name);
                  if (a) removeActivity(a.id);
                }}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
