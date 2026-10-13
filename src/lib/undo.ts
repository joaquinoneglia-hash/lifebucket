import { usePlanner } from "./store";

/**
 * Deshacer: guarda cómo estaban tus datos antes de cada cambio (los cambios seguidos, como escribir, cuentan
 * como uno solo) y permite volver atrás. Solo en esta pestaña; se pierde al recargar.
 */
type Snapshot = ReturnType<typeof usePlanner.getState>;
const MAX = 40;
const GROUP_MS = 800;
const past: Snapshot[] = [];
let lastAt = 0;
let restoring = false;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function startUndo() {
  if (started) return;
  started = true;
  usePlanner.subscribe((_, prev) => {
    if (restoring) return;
    const now = Date.now();
    // Varios cambios seguidos (tipear, arrastrar) se deshacen juntos.
    if (now - lastAt > GROUP_MS || !past.length) {
      past.push(prev);
      if (past.length > MAX) past.shift();
      notify();
    }
    lastAt = now;
  });
}

export const canUndo = () => past.length > 0;

export function undo() {
  const prev = past.pop();
  if (!prev) return false;
  restoring = true;
  // Solo los datos: las funciones del store quedan como están.
  const data = Object.fromEntries(Object.entries(prev).filter(([, v]) => typeof v !== "function"));
  usePlanner.setState(data as Partial<Snapshot>);
  restoring = false;
  lastAt = 0;
  notify();
  return true;
}

export function onUndoChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
