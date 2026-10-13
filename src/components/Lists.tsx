"use client";

import { Check, Eye, EyeOff, ClipboardList, Eraser, ListPlus, MapPin, NotebookPen, Plus, RotateCcw, ShoppingCart, Trash2, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalize } from "@/lib/activities";
import { cn } from "@/lib/format";
import { cheer } from "@/lib/motivation";
import { play } from "@/lib/sfx";
import { newId, usePlanner, type ListItem, type ListType, type UserList } from "@/lib/store";
import { hiddenModules, MODULE_TITLES, ModuleControls, showModule, type BaseModule } from "./Modules";
import { PendingCard } from "./Pending";

/**
 * Listas personales, para tener todo en orden. Cinco tipos, cada uno con su formato:
 * - Súper: lo que hay que comprar, agrupado solo por sección (verdulería, almacén, limpieza…).
 * - Notas: notas sueltas, como tarjetitas.
 * - Pendientes: cosas para hacer con prioridad (alta, media, baja), ordenadas solas.
 * - Checklist para repetir: rutinas de orden ("antes de salir", "limpieza del sábado") que se reinician.
 * - ¿Dónde está?: dónde guardaste cada cosa (pasaporte → cajón del escritorio).
 */
export const LIST_TYPES: { id: ListType; name: string; hint: string; icon: LucideIcon; title: string }[] = [
  { id: "super", name: "Súper", hint: "Lo que hay que comprar, agrupado por sección.", icon: ShoppingCart, title: "Lista del súper" },
  { id: "pendientes", name: "Recordatorios", hint: "Tareas, cumpleaños, pagos, turnos y feriados, con aviso cuando se acercan.", icon: ClipboardList, title: "Recordatorios" },
  { id: "lugares", name: "¿Dónde está?", hint: "Dónde guardaste cada cosa: nunca más «¿dónde dejé el pasaporte?».", icon: MapPin, title: "¿Dónde está?" },
  { id: "notas", name: "Notas", hint: "Notas sueltas para no olvidarte de nada.", icon: NotebookPen, title: "Notas" },
];
const TYPE = Object.fromEntries(LIST_TYPES.map((t) => [t.id, t])) as Record<ListType, (typeof LIST_TYPES)[number]>;

/** Las secciones del súper y las palabras que las delatan. */
const SECTIONS: { id: string; name: string; words: string[] }[] = [
  { id: "verduleria", name: "Verdulería", words: ["tomate", "lechuga", "cebolla", "papa", "zanahoria", "banana", "manzana", "naranja", "limon", "palta", "fruta", "verdura", "zapallo", "ajo", "morron", "pera", "frutilla", "espinaca", "rucula"] },
  { id: "carniceria", name: "Carnicería y pescado", words: ["carne", "pollo", "pescado", "milanesa", "asado", "bife", "cerdo", "chorizo", "hamburguesa", "salmon", "atun"] },
  { id: "lacteos", name: "Lácteos y frescos", words: ["leche", "queso", "yogur", "manteca", "crema", "huevo", "jamon", "fiambre", "ricota"] },
  { id: "panaderia", name: "Panadería", words: ["pan", "facturas", "tostadas", "galletitas", "budin", "medialunas"] },
  { id: "almacen", name: "Almacén", words: ["arroz", "fideos", "harina", "azucar", "sal", "aceite", "vinagre", "yerba", "cafe", "te", "mermelada", "lentejas", "garbanzos", "salsa", "pure", "atun", "cereal", "avena", "galletas"] },
  { id: "bebidas", name: "Bebidas", words: ["agua", "gaseosa", "jugo", "vino", "cerveza", "soda", "coca", "fernet"] },
  { id: "limpieza", name: "Limpieza", words: ["detergente", "lavandina", "jabon en polvo", "suavizante", "esponja", "trapo", "lavavajillas", "desodorante de ambiente", "bolsas de residuo", "papel de cocina"] },
  { id: "higiene", name: "Higiene personal", words: ["shampoo", "acondicionador", "jabon", "pasta de dientes", "cepillo", "desodorante", "papel higienico", "algodon", "toallitas"] },
];
const sectionOf = (text: string) => {
  const q = normalize(text);
  return SECTIONS.find((s) => s.words.some((w) => q.includes(w)))?.id ?? "otros";
};
const PRIORITIES = [
  { id: "alta", name: "Alta", color: "#e5484d" },
  { id: "media", name: "Media", color: "#e3a008" },
  { id: "baja", name: "Baja", color: "#8e96a3" },
];

/** Una lista como panel del tablero: su ícono y nombre arriba (con los controles del panel) y su contenido. */
export function ListCard({ id, className }: { id: string; className?: string }) {
  const list = usePlanner((s) => s.lists.find((l) => l.id === id));
  if (!list || !TYPE[list.type]) return null;
  if (list.type === "pendientes") return <PendingCard list={list} className={className} />;
  const T = TYPE[list.type];
  return (
    <section aria-label={list.title} className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pr-2 pl-4">
        <h2 className="flex min-w-0 items-center gap-2 type-title">
          <T.icon aria-hidden className="size-4 shrink-0 text-ink-muted" />
          <span className="truncate">{list.title}</span>
        </h2>
        <ModuleControls />
      </header>
      <ListBody list={list} />
    </section>
  );
}

/** El contenido de una lista, según su tipo. */
function ListBody({ list }: { list: UserList }) {
  const setItems = usePlanner((s) => s.setListItems);
  const [text, setText] = useState("");
  const [meta, setMeta] = useState(list.type === "pendientes" ? "media" : "");
  const items = list.items;
  const save = (next: ListItem[]) => setItems(list.id, next);
  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (list.type === "lugares" && !meta.trim()) return;
    const m = list.type === "super" ? sectionOf(t) : list.type === "pendientes" ? meta : list.type === "lugares" ? meta.trim() : undefined;
    save([...items, { id: newId(), text: t, meta: m }]);
    play("pop");
    setText("");
    if (list.type === "lugares") setMeta("");
  };
  const toggle = (id: string) => {
    const next = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    save(next);
    const it = next.find((i) => i.id === id);
    if (it?.done) {
      if (list.type === "checklist" && next.every((i) => i.done)) cheer("allChecks", "¡Checklist completa! Todo en orden ✨");
      else play("pop");
    }
  };
  const remove = (id: string) => {
    play("delete");
    save(items.filter((i) => i.id !== id));
  };

  const row = (i: ListItem, extra?: React.ReactNode) => (
    <li key={i.id} className="group/it flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-sunken/70">
      {list.type !== "notas" && list.type !== "lugares" && (
        <button
          type="button"
          aria-pressed={!!i.done}
          aria-label={`${i.text}: ${i.done ? "hecho" : "pendiente"}`}
          onClick={() => toggle(i.id)}
          className={cn("grid size-[18px] shrink-0 place-items-center rounded-md border", i.done ? "border-success bg-success text-white" : "border-ink-faint hover:border-ink")}
        >
          {i.done && <Check aria-hidden strokeWidth={3} className="size-3" />}
        </button>
      )}
      <span className={cn("min-w-0 flex-1 text-[13px] leading-snug break-words", i.done && "text-ink-muted line-through decoration-ink/30")}>{i.text}</span>
      {extra}
      <button type="button" aria-label={`Borrar ${i.text}`} onClick={() => remove(i.id)} className="grid size-6 shrink-0 place-items-center rounded text-ink-faint opacity-0 group-hover/it:opacity-100 hover:text-danger focus-visible:opacity-100 [@media(hover:none)]:opacity-60">
        <Trash2 aria-hidden className="size-3.5" />
      </button>
    </li>
  );

  let body: React.ReactNode;
  if (list.type === "super") {
    // Agrupado por sección; lo comprado, al final de cada sección.
    const groups = [...SECTIONS, { id: "otros", name: "Otros", words: [] }].map((s) => ({ ...s, list: items.filter((i) => (i.meta ?? "otros") === s.id).sort((a, b) => Number(!!a.done) - Number(!!b.done)) })).filter((g) => g.list.length);
    body = groups.map((g) => (
      <div key={g.id} className="pb-1.5">
        <p className="px-1.5 pt-1 text-[10.5px] font-semibold tracking-wide text-ink-faint uppercase">{g.name}</p>
        <ul>{g.list.map((i) => row(i))}</ul>
      </div>
    ));
  } else if (list.type === "pendientes") {
    const order = (i: ListItem) => (i.done ? 9 : PRIORITIES.findIndex((p) => p.id === i.meta));
    body = (
      <ul>
        {[...items].sort((a, b) => order(a) - order(b)).map((i) => {
          const p = PRIORITIES.find((x) => x.id === i.meta) ?? PRIORITIES[1];
          return row(
            i,
            <button
              type="button"
              title="Cambiar la prioridad"
              onClick={() => save(items.map((x) => (x.id === i.id ? { ...x, meta: PRIORITIES[(PRIORITIES.indexOf(p) + 1) % 3].id } : x)))}
              className="shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold text-white"
              style={{ background: p.color }}
            >
              {p.name}
            </button>,
          );
        })}
      </ul>
    );
  } else if (list.type === "lugares") {
    body = (
      <ul>
        {[...items].sort((a, b) => a.text.localeCompare(b.text)).map((i) =>
          row(
            i,
            <span className="inline-flex max-w-[55%] shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2 py-px text-[11.5px] text-ink-muted">
              <MapPin aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{i.meta}</span>
            </span>,
          ),
        )}
      </ul>
    );
  } else if (list.type === "notas") {
    body = (
      <ul className="grid grid-cols-1 gap-1.5 p-1">
        {[...items].reverse().map((i) => (
          <li key={i.id} className="group/it relative rounded-xl bg-[#fff7d6] px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap text-[#4a3d00] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            {i.text}
            <button type="button" aria-label="Borrar la nota" onClick={() => remove(i.id)} className="absolute top-1 right-1 grid size-6 place-items-center rounded text-[#8a7400] opacity-0 group-hover/it:opacity-100 hover:text-danger">
              <X aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    );
  } else {
    const done = items.filter((i) => i.done).length;
    body = (
      <>
        {items.length > 0 && (
          <div className="flex items-center gap-2 px-1.5 pb-1">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span className="block h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
            </span>
            <span className="text-[11px] font-semibold text-ink-muted tabular-nums">
              {done}/{items.length}
            </span>
          </div>
        )}
        <ul>{items.map((i) => row(i))}</ul>
      </>
    );
  }

  const done = items.filter((i) => i.done).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-2 empty:hidden">
        {list.type === "checklist" && done > 0 && (
          <button type="button" title="Reiniciar (destildar todo)" aria-label="Reiniciar la checklist" onClick={() => save(items.map((i) => ({ ...i, done: false })))} className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <RotateCcw aria-hidden className="size-3.5" />
          </button>
        )}
        {(list.type === "super" || list.type === "pendientes") && done > 0 && (
          <button type="button" title="Sacar lo tachado" aria-label="Sacar lo tachado" onClick={() => save(items.filter((i) => !i.done))} className="pressable grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <Eraser aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1">
        {items.length ? body : <p className="px-2 py-3 text-[12.5px] leading-snug text-ink-muted">{TYPE[list.type].hint}</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex shrink-0 flex-col gap-1.5 border-t border-line p-2"
      >
        {list.type === "notas" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            rows={2}
            placeholder="Escribí una nota…"
            aria-label="Nueva nota"
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
        ) : (
          <div className="flex gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={list.type === "super" ? "Leche, tomates, detergente…" : list.type === "lugares" ? "Qué cosa (pasaporte, llaves de repuesto…)" : list.type === "checklist" ? "Un paso (llaves, celular, apagar la luz…)" : "Algo para hacer…"}
              aria-label="Nuevo ítem"
              enterKeyHint="done"
              className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-[13px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
            {list.type === "pendientes" && (
              <select value={meta} onChange={(e) => setMeta(e.target.value)} aria-label="Prioridad" className="h-9 rounded-full border border-line bg-surface px-2 text-[12px] focus:border-ink focus:outline-none">
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {list.type !== "lugares" && (
              <button type="submit" disabled={!text.trim()} aria-label="Sumar" className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-ink text-surface disabled:opacity-30">
                <Plus aria-hidden className="size-4" />
              </button>
            )}
          </div>
        )}
        {list.type === "lugares" && (
          <div className="flex gap-1.5">
            <input
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Dónde está (cajón del escritorio…)"
              aria-label="Dónde está"
              className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-[13px] placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
            <button type="submit" disabled={!text.trim() || !meta.trim()} aria-label="Sumar" className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-ink text-surface disabled:opacity-30">
              <Plus aria-hidden className="size-4" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * «Mis listas», arriba: al pasar el mouse (o tocarlo) se despliegan las cinco listas (una por tipo), cada una
 * con su ojito para mostrarla u ocultarla en el tablero, y los paneles que ocultaste.
 */
export function ListsMenu() {
  const lists = usePlanner((s) => s.lists);
  const [open, setOpen] = useState(false);
  const [hiddenPanels, setHiddenPanels] = useState<BaseModule[]>([]);
  const closeTimer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  const show = () => {
    window.clearTimeout(closeTimer.current);
    setHiddenPanels(hiddenModules());
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  // Mostrar una lista que todavía no existe la crea (vacía); ocultarla no borra lo que tenga.
  const toggle = (type: ListType) => {
    const l = lists.find((x) => x.type === type);
    if (!l) {
      usePlanner.getState().addList(type, TYPE[type].title);
      play("pop");
    } else showModule(`list:${l.id}`, !!l.hidden);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-expanded={open}
        className="pressable flex items-center gap-2 rounded-full bg-surface/80 px-3.5 py-2 text-[13px] font-medium whitespace-nowrap shadow-[var(--shadow-card)] hover:bg-surface"
      >
        <ListPlus aria-hidden className="size-4 text-ink-muted" />
        Mis listas
      </button>
      {open && (
        <div className="animate-fade-up absolute top-full left-0 z-[60] mt-2 w-[300px] rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-popover)]">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">Tus listas</p>
          <ul className="flex flex-col">
            {LIST_TYPES.map((t) => {
              const l = lists.find((x) => x.type === t.id);
              const shown = !!l && !l.hidden;
              const left = l ? l.items.filter((i) => !i.done).length : 0;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-label={shown ? `Ocultar ${t.name}` : `Mostrar ${t.name}`}
                    aria-pressed={shown}
                    title={t.hint}
                    className="pressable flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken/70"
                  >
                    <t.icon aria-hidden className={cn("size-4 shrink-0", shown ? "text-ink" : "text-ink-faint")} />
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", !shown && "text-ink-muted")}>{t.name}</span>
                    {t.id !== "notas" && t.id !== "lugares" && left > 0 && <span className="text-[11px] text-ink-faint tabular-nums">{left}</span>}
                    {shown ? <Eye aria-hidden className="size-4 text-ink" /> : <EyeOff aria-hidden className="size-4 text-ink-faint" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {hiddenPanels.length > 0 && (
            <>
              <p className="px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">Paneles ocultos</p>
              <ul className="flex flex-col">
                {hiddenPanels.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-label={`Mostrar ${MODULE_TITLES[id]}`}
                      onClick={() => {
                        showModule(id, true);
                        setHiddenPanels((h) => h.filter((x) => x !== id));
                      }}
                      className="pressable flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-sunken/70"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{MODULE_TITLES[id]}</span>
                      <EyeOff aria-hidden className="size-4 text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
