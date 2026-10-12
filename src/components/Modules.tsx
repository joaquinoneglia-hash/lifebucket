"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * El dashboard de vida (compu), con una disposición fija:
 *   - a la izquierda: Tu Balde (con el resumen) arriba y tus metas importantes abajo;
 *   - al centro, a todo lo alto: tu rutina semanal;
 *   - a la derecha: los no negociables a lo largo y, abajo, tu diario personal.
 * Cada panel se comprime a su título y los bordes entre paneles se arrastran para ajustar el alto.
 * Lo que elegís queda guardado en este navegador.
 */
export type ModuleId = "semana" | "bucket" | "metas" | "diarios" | "diario";
export const MODULE_TITLES: Record<ModuleId, string> = {
  semana: "Tu rutina semanal",
  bucket: "Tu Balde",
  metas: "Metas importantes",
  diarios: "No negociables",
  diario: "Mi diario personal",
};
type Prefs = { collapsed: ModuleId[]; bucket: number; diary: number };
const DEFAULT: Prefs = { collapsed: [], bucket: 380, diary: 210 };
const KEY = "lb:dash:v3";

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    return { ...DEFAULT, ...raw, collapsed: (raw?.collapsed ?? []).filter((id) => id in MODULE_TITLES) };
  } catch {
    return DEFAULT;
  }
}

type Ctx = { id: ModuleId; collapsed: boolean; toggle: () => void };
const ModuleContext = createContext<Ctx | null>(null);

/** El botón de comprimir/desplegar del encabezado de cada panel (fuera del dashboard de compu, nada). */
export function ModuleControls() {
  const m = useContext(ModuleContext);
  if (!m) return null;
  return (
    <button
      type="button"
      aria-label={m.collapsed ? `Desplegar ${MODULE_TITLES[m.id]}` : `Comprimir ${MODULE_TITLES[m.id]}`}
      title={m.collapsed ? "Desplegar" : "Comprimir"}
      aria-expanded={!m.collapsed}
      onClick={m.toggle}
      className="pressable grid size-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      {m.collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
    </button>
  );
}

/** La barra para ajustar el alto arrastrando (doble flecha). Doble clic: vuelve a su alto. */
function Splitter({ label, onDrag, onReset }: { label: string; onDrag: (dy: number, done: boolean) => void; onReset: () => void }) {
  const [active, setActive] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      title="Arrastrá para ajustar el alto · doble clic para volver"
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const y0 = e.clientY;
        setActive(true);
        const move = (ev: PointerEvent) => onDrag(ev.clientY - y0, false);
        const up = (ev: PointerEvent) => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          setActive(false);
          onDrag(ev.clientY - y0, true);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      className="group/rs relative z-20 -my-3 flex h-3 shrink-0 cursor-row-resize items-center justify-center"
    >
      <span className={cn("flex h-4 items-center rounded-full bg-surface px-2 text-ink-muted opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-150 group-hover/rs:opacity-100", active && "opacity-100")}>
        <ChevronsUpDown aria-hidden className="size-3" />
      </span>
    </div>
  );
}

export function DashboardBoard({ render }: { render: (id: ModuleId) => ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  useEffect(() => setPrefs(load()), []);
  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  };
  const [live, setLive] = useState<Partial<Pick<Prefs, "bucket" | "diary">>>({});
  const isC = (id: ModuleId) => prefs.collapsed.includes(id);
  const toggle = (id: ModuleId) => save({ ...prefs, collapsed: isC(id) ? prefs.collapsed.filter((x) => x !== id) : [...prefs.collapsed, id] });

  const slot = (id: ModuleId, className?: string, style?: CSSProperties) => (
    <ModuleContext.Provider value={{ id, collapsed: isC(id), toggle: () => toggle(id) }}>
      {isC(id) ? (
        <section aria-label={MODULE_TITLES[id]} className={cn("card flex h-11 shrink-0 items-center justify-between gap-2 pr-2 pl-4", className)}>
          <button type="button" onClick={() => toggle(id)} className="min-w-0 flex-1 truncate text-left type-title">
            {MODULE_TITLES[id]}
          </button>
          <ModuleControls />
        </section>
      ) : (
        <div data-module={id} style={style} className={cn("flex min-h-0 flex-col [&>*]:min-h-0 [&>*]:flex-1", className)}>
          {render(id)}
        </div>
      )}
    </ModuleContext.Provider>
  );

  const bucket = live.bucket ?? prefs.bucket;
  const diary = live.diary ?? prefs.diary;
  /** Arrastrar el borde: hacia abajo agranda el de arriba (`grow`) o achica el de abajo. */
  const drag = (key: "bucket" | "diary", start: number, min: number, max: number, grow: boolean) => (dy: number, done: boolean) => {
    const v = Math.max(min, Math.min(max, grow ? start + dy : start - dy));
    if (done) {
      setLive({});
      save({ ...prefs, [key]: v });
    } else setLive({ [key]: v });
  };

  return (
    <main id="contenido" className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6">
      {/* Izquierda: tu balde (con el resumen) arriba y tus metas abajo. */}
      <div className="flex w-[390px] shrink-0 flex-col gap-3 xl:w-[420px]">
        {slot("bucket", isC("bucket") ? undefined : "shrink-0", !isC("bucket") && !isC("metas") ? { height: bucket } : undefined)}
        {!isC("bucket") && !isC("metas") && <Splitter label="Ajustar el alto del balde" onReset={() => save({ ...prefs, bucket: DEFAULT.bucket })} onDrag={drag("bucket", prefs.bucket, 260, 640, true)} />}
        {slot("metas", isC("metas") ? undefined : "flex-1")}
      </div>
      {/* Centro: la rutina, a todo lo alto. */}
      <div className="flex min-w-0 flex-1 flex-col">{slot("semana", isC("semana") ? undefined : "flex-1")}</div>
      {/* Derecha: los no negociables a lo largo y el diario abajo. */}
      <div className="flex w-80 shrink-0 flex-col gap-3 xl:w-[340px]">
        {slot("diarios", isC("diarios") ? undefined : "flex-1")}
        {!isC("diarios") && !isC("diario") && <Splitter label="Ajustar el alto del diario" onReset={() => save({ ...prefs, diary: DEFAULT.diary })} onDrag={drag("diary", prefs.diary, 150, 560, false)} />}
        {slot("diario", isC("diario") ? undefined : isC("diarios") ? "flex-1" : "shrink-0", !isC("diarios") && !isC("diario") ? { height: diary } : undefined)}
      </div>
    </main>
  );
}
