"use client";

import { useState } from "react";
import { applyRoutine, type RoutineBlock } from "@/lib/routine";
import { usePlanner } from "@/lib/store";
import { IdealDesigner } from "./setup/IdealDesigner";
import { GhostButton, PrimaryButton, Sheet } from "./ui";

/** Tu rutina guardada; si todavía no hay (cuentas de antes), sale de lo que ya se repite. */
export function currentRoutine(): RoutineBlock[] {
  const { routine, series } = usePlanner.getState();
  if (routine.length) return routine;
  return series
    .filter((s) => !s.until)
    .map((s) => ({ id: s.id, quadrant: s.quadrant, name: s.title, days: [...s.days], start: s.start, minutes: s.minutes }));
}

/**
 * Tu semana ideal dentro de la app: el mismo diseñador del arranque, con tu semana de cuando
 * empezaste como fantasma. Al guardar, pasa a ser tu rutina y su % tu objetivo.
 */
export function IdealWeekPanel({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const baseline = usePlanner((s) => s.baseline);
  const sleep = usePlanner((s) => s.sleep);
  const [draft, setDraft] = useState<RoutineBlock[]>(currentRoutine);

  return (
    <div className="flex flex-col gap-5">
      <IdealDesigner baseline={baseline.length ? baseline : currentRoutine()} template={draft} onChange={setDraft} sleep={sleep} gridHeight={520} />
      <footer className="flex items-center justify-end gap-2">
        {onCancel && <GhostButton onClick={onCancel}>Cancelar</GhostButton>}
        <PrimaryButton
          onClick={() => {
            applyRoutine(draft, sleep);
            onSaved?.();
          }}
        >
          Guardar mi semana
        </PrimaryButton>
      </footer>
    </div>
  );
}

export function TargetsDialog({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  return (
    <Sheet isMobile={isMobile} onClose={onClose} labelledBy="targets-title" width="max-w-[1100px]">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header>
          <h2 id="targets-title" className="type-headline">
            Tu semana ideal
          </h2>
          <p className="type-body mt-1 text-ink-muted">
            Lo que se repite cada semana. Punteada, tu semana de cuando empezaste. El % de cada parte es tu objetivo.
          </p>
        </header>
        <IdealWeekPanel onCancel={onClose} onSaved={onClose} />
      </div>
    </Sheet>
  );
}
