"use client";

import { Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import { play } from "@/lib/sfx";
import { canUndo, onUndoChange, startUndo, undo } from "@/lib/undo";

/** Volver atrás el último cambio (también con Ctrl/⌘+Z, fuera de los campos de texto). */
export function UndoButton({ className }: { className?: string }) {
  const [can, setCan] = useState(false);
  useEffect(() => {
    // Arranca después de que se cargan tus datos (de este navegador y de la nube): eso no se deshace.
    const t0 = window.setTimeout(startUndo, 4000);
    setCan(canUndo());
    const off = onUndoChange(() => setCan(canUndo()));
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      if (undo()) play("click");
    };
    window.addEventListener("keydown", key);
    return () => {
      off();
      window.clearTimeout(t0);
      window.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <button
      type="button"
      disabled={!can}
      onClick={() => undo() && play("click")}
      aria-label="Deshacer el último cambio"
      title="Deshacer el último cambio (Ctrl+Z)"
      className={cn("pressable grid size-10 place-items-center rounded-md text-ink hover:bg-surface/70 disabled:text-ink-faint disabled:opacity-50", className)}
    >
      <Undo2 aria-hidden className="size-4" />
    </button>
  );
}
