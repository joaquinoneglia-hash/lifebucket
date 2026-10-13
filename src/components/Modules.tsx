"use client";
import { testKey } from "@/lib/test-mode";

import { ChevronDown, ChevronsUpDown, ChevronUp, EyeOff } from "lucide-react";
import { createContext, useContext, useEffect, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { usePlanner } from "@/lib/store";

/**
 * El dashboard de vida (compu), modular: tres columnas (la del centro, la más ancha) con los paneles
 * apilados. Cada panel se mueve a otra columna o de lugar (arrastrándolo de ⠿ o desde ···), se comprime a su
 * título y se estira (el borde entre dos paneles). Si una columna queda con un solo panel, ocupa todo el alto.
 * La disposición queda guardada en este navegador.
 */
export type BaseModule = "semana" | "bucket" | "metas" | "diarios";
/** Un panel: uno de los fijos o una lista ("list:<id>"). */
export type ModuleId = BaseModule | `list:${string}`;
export type Col = "left" | "center" | "right";
export const MODULE_TITLES: Record<BaseModule, string> = {
  semana: "Tu rutina semanal",
  bucket: "Tu Balde",
  metas: "Metas anuales importantes",
  diarios: "No negociables",
};
const titleOf = (id: ModuleId) => (id.startsWith("list:") ? (usePlanner.getState().lists.find((l) => `list:${l.id}` === id)?.title ?? "Lista") : MODULE_TITLES[id as BaseModule]);
/** Mostrar u ocultar un panel desde cualquier lado (el menú de Mis listas). */
export const showModule = (id: ModuleId, show: boolean) => window.dispatchEvent(new CustomEvent("lb:module-visibility", { detail: { id, show } }));
/** Los paneles fijos que ocultaste (para mostrarlos de nuevo desde el menú). */
export function hiddenModules(): BaseModule[] {
  try {
    return ((JSON.parse(localStorage.getItem(KEY) ?? "null")?.hidden ?? []) as BaseModule[]).filter((id) => id in MODULE_TITLES);
  } catch {
    return [];
  }
}
const COLS: Col[] = ["left", "center", "right"];
type Prefs = { cols: Record<Col, ModuleId[]>; collapsed: ModuleId[]; weights: Partial<Record<ModuleId, number>>; hidden: BaseModule[] };
const DEFAULT: Prefs = {
  cols: { left: ["bucket", "metas"], center: ["semana"], right: ["diarios", "list:pendientes"] },
  collapsed: [],
  hidden: [],
  weights: { bucket: 1.25, metas: 1, semana: 3, diarios: 1.3, "list:pendientes": 1.6 },
};
const KEY = testKey("lb:board:v3");
const ALL = Object.keys(MODULE_TITLES) as BaseModule[];

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Prefs | null;
    if (!raw?.cols) return DEFAULT;
    const seen = new Set<ModuleId>();
    const cols = Object.fromEntries(COLS.map((c) => [c, (raw.cols[c] ?? []).filter((id) => (ALL.includes(id as BaseModule) || id.startsWith("list:")) && !seen.has(id) && seen.add(id))])) as Record<Col, ModuleId[]>;
    for (const id of ALL) if (!seen.has(id)) cols[(COLS.find((c) => DEFAULT.cols[c].includes(id)) ?? "right") as Col].push(id);
    return { cols, collapsed: raw.collapsed ?? [], weights: { ...DEFAULT.weights, ...raw.weights }, hidden: (raw.hidden ?? []).filter((id) => ALL.includes(id)) };
  } catch {
    return DEFAULT;
  }
}

type Ctx = { id: ModuleId; collapsed: boolean; toggle: () => void; hide: () => void; col: Col; index: number; count: number; move: (col: Col, index?: number) => void; onDragStart: (e: DragEvent) => void };
const ModuleContext = createContext<Ctx | null>(null);

/** Los controles de cada panel: el ojito para ocultarlo y ⌃ para comprimirlo. El panel se arrastra desde su encabezado. */
export function ModuleControls() {
  const m = useContext(ModuleContext);
  if (!m) return null;
  return (
    <div className="relative flex shrink-0 items-center">
      <span className={cn("flex items-center transition-opacity duration-150", "opacity-0 group-hover/panel:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100")}>
      <button
        type="button"
        aria-label={`Ocultar ${titleOf(m.id)}`}
        title="Ocultar (se vuelve a mostrar desde «Mis listas», arriba)"
        onClick={m.hide}
        className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
      >
        <EyeOff aria-hidden className="size-3.5" />
      </button>
      </span>
      <button
        type="button"
        aria-label={m.collapsed ? `Desplegar ${titleOf(m.id)}` : `Comprimir ${titleOf(m.id)}`}
        title={m.collapsed ? "Desplegar" : "Comprimir"}
        aria-expanded={!m.collapsed}
        onClick={m.toggle}
        className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
      >
        {m.collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

export function DashboardBoard({ render }: { render: (id: ModuleId) => ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  // Arrastrar un panel: se agarra desde su encabezado (no desde botones ni campos).
  const [armed, setArmed] = useState<ModuleId | null>(null);
  useEffect(() => setPrefs(load()), []);
  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  };
  const lists = usePlanner((s) => s.lists);
  const shownLists = lists.filter((l) => !l.hidden).map((l) => `list:${l.id}` as ModuleId);
  // Las listas nuevas (o que se vuelven a mostrar) entran a la derecha.
  const placed = new Set(COLS.flatMap((c) => prefs.cols[c]));
  const cols: Record<Col, ModuleId[]> = { ...prefs.cols, right: [...prefs.cols.right, ...shownLists.filter((id) => !placed.has(id))] };
  useEffect(() => {
    const onVis = (e: Event) => {
      const { id, show } = (e as CustomEvent<{ id: ModuleId; show: boolean }>).detail;
      if (id.startsWith("list:")) return usePlanner.getState().setListHidden(id.slice(5), !show);
      setPrefs((p) => {
        const next = { ...p, hidden: show ? p.hidden.filter((x) => x !== id) : [...new Set([...p.hidden, id as BaseModule])] };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener("lb:module-visibility", onVis);
    // La guía pide ver un panel: se muestra y se despliega si estaba comprimido.
    const onExpand = (e: Event) => {
      const id = (e as CustomEvent<{ id: ModuleId }>).detail.id;
      if (id.startsWith("list:")) usePlanner.getState().setListHidden(id.slice(5), false);
      setPrefs((p) => {
        const grow = (e as CustomEvent<{ grow?: number }>).detail.grow;
        const w = p.weights[id] ?? 1;
        if (!p.collapsed.includes(id) && !p.hidden.includes(id as BaseModule) && (!grow || w >= grow)) return p;
        const next = { ...p, collapsed: p.collapsed.filter((x) => x !== id), hidden: p.hidden.filter((x) => x !== id), weights: grow && w < grow ? { ...p.weights, [id]: grow } : p.weights };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener("lb:module-expand", onExpand);
    return () => {
      window.removeEventListener("lb:module-visibility", onVis);
      window.removeEventListener("lb:module-expand", onExpand);
    };
  }, []);
  const [dragging, setDragging] = useState<ModuleId | null>(null);
  const [over, setOver] = useState<{ col: Col; index: number } | null>(null);
  const isC = (id: ModuleId) => prefs.collapsed.includes(id);
  const visible = (id: ModuleId) => (id.startsWith("list:") ? shownLists.includes(id) : !prefs.hidden.includes(id as BaseModule));
  const move = (id: ModuleId, col: Col, index?: number) => {
    const next = Object.fromEntries(COLS.map((c) => [c, cols[c].filter((x) => x !== id)])) as Record<Col, ModuleId[]>;
    next[col].splice(index === undefined ? next[col].length : Math.max(0, Math.min(index, next[col].length)), 0, id);
    save({ ...prefs, cols: next });
  };
  const toggle = (id: ModuleId) => save({ ...prefs, collapsed: isC(id) ? prefs.collapsed.filter((x) => x !== id) : [...prefs.collapsed, id] });
  const weight = (id: ModuleId) => prefs.weights[id] ?? 1;

  return (
    <main id="contenido" className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6" onDragEnd={() => (setDragging(null), setOver(null))}>
      {COLS.map((col) => {
        const list = cols[col].filter(visible);
        const open = list.filter((id) => !isC(id));
        return (
          <div
            key={col}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              const items = [...e.currentTarget.querySelectorAll<HTMLElement>(":scope > [data-slot]")];
              const i = items.findIndex((el) => e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2);
              const next = { col, index: i < 0 ? items.length : i };
              if (over?.col !== next.col || over.index !== next.index) setOver(next);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/module") as ModuleId;
              if (id && over) {
                const from = cols[over.col].indexOf(id);
                move(id, over.col, from >= 0 && from < over.index ? over.index - 1 : over.index);
              }
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              "flex min-h-0 flex-col gap-3",
              col === "center" ? "min-w-[420px] flex-1" : col === "left" ? "w-[380px] shrink-0 xl:w-[410px]" : "w-80 shrink-0 xl:w-[340px]",
              !list.length && !dragging && "hidden",
              !list.length && dragging && "rounded-2xl border-2 border-dashed border-line",
            )}
          >
            {list.map((id, index) => {
              const collapsed = isC(id);
              const ctx: Ctx = {
                id,
                collapsed,
                toggle: () => toggle(id),
                hide: () => showModule(id, false),
                col,
                index,
                count: list.length,
                move: (c, i) => move(id, c, i),
                onDragStart: (e) => {
                  e.dataTransfer.setData("text/module", id);
                  e.dataTransfer.effectAllowed = "move";
                  const card = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-slot]");
                  if (card) e.dataTransfer.setDragImage(card, 24, 20);
                  setDragging(id);
                },
              };
              // El borde para estirar: entre este panel y el siguiente abierto de la columna.
              const nextOpen = open[open.indexOf(id) + 1];
              return (
                <div
                  key={id}
                  data-slot={id}
                  draggable={armed === id}
                  onPointerDown={(e) => {
                    const t = e.target as HTMLElement;
                    const head = t.closest("header, [data-collapsed-head]");
                    const control = t.closest("button, input, select, textarea, a, label, [role=separator], [role=menu]");
                    setArmed(head && !control ? id : null);
                  }}
                  onPointerUp={() => setArmed(null)}
                  onDragStart={(e) => {
                    if (armed !== id) return;
                    ctx.onDragStart(e);
                  }}
                  onDragEnd={() => setArmed(null)}
                  className={cn(
                    "group/panel relative flex min-h-0 flex-col [&_header]:cursor-grab [&_header]:active:cursor-grabbing",
                    collapsed ? "shrink-0" : "basis-0",
                    dragging === id && "opacity-40",
                    over?.col === col && over.index === index && dragging && "before:absolute before:inset-x-2 before:-top-2 before:h-0.5 before:rounded-full before:bg-ink",
                  )}
                  style={collapsed ? undefined : { flexGrow: weight(id) }}
                >
                  <ModuleContext.Provider value={ctx}>
                    {collapsed ? (
                      <section data-collapsed-head aria-label={titleOf(id)} className="card flex h-11 shrink-0 cursor-grab items-center justify-between gap-2 pr-2 pl-4">
                        <button type="button" onClick={() => toggle(id)} className="min-w-0 flex-1 truncate text-left type-title">
                          {titleOf(id)}
                        </button>
                        <ModuleControls />
                      </section>
                    ) : (
                      <div data-module={id} className="flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1">
                        {render(id)}
                      </div>
                    )}
                  </ModuleContext.Provider>
                  {!collapsed && nextOpen && (
                    <Splitter
                      label={`Ajustar el alto de ${titleOf(id)}`}
                      onReset={() => save({ ...prefs, weights: { ...prefs.weights, [id]: DEFAULT.weights[id] ?? 1, [nextOpen]: DEFAULT.weights[nextOpen] ?? 1 } })}
                      onDrag={(start, dy, done) => {
                        // Repartir el alto entre los dos paneles según cuánto se arrastró (sin cambiar la suma).
                        const total = start.a + start.b;
                        const ha = Math.max(90, Math.min(total - 90, start.a + dy));
                        const sum = start.wa + start.wb;
                        const next = { ...prefs.weights, [id]: (ha / total) * sum, [nextOpen]: ((total - ha) / total) * sum };
                        if (done) save({ ...prefs, weights: next });
                        else setPrefs({ ...prefs, weights: next });
                      }}
                      measure={(el) => ({
                        a: el.parentElement!.getBoundingClientRect().height,
                        b: el.parentElement!.parentElement!.querySelector<HTMLElement>(`[data-slot="${nextOpen}"]`)!.getBoundingClientRect().height,
                        wa: weight(id),
                        wb: weight(nextOpen),
                      })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </main>
  );
}

type Start = { a: number; b: number; wa: number; wb: number };

/** El borde para estirar (doble flecha). Doble clic: vuelve al alto de siempre. */
function Splitter({ label, onDrag, onReset, measure }: { label: string; onDrag: (start: Start, dy: number, done: boolean) => void; onReset: () => void; measure: (el: HTMLElement) => Start }) {
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
        const start = measure(e.currentTarget);
        const y0 = e.clientY;
        setActive(true);
        const move = (ev: PointerEvent) => onDrag(start, ev.clientY - y0, false);
        const up = (ev: PointerEvent) => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          setActive(false);
          onDrag(start, ev.clientY - y0, true);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      className="group/rs absolute inset-x-0 -bottom-3 z-20 flex h-3 cursor-row-resize items-center justify-center"
    >
      <span className={cn("flex h-4 items-center rounded-full bg-surface px-2 text-ink-muted opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-150 group-hover/rs:opacity-100", active && "opacity-100")}>
        <ChevronsUpDown aria-hidden className="size-3" />
      </span>
    </div>
  );
}
