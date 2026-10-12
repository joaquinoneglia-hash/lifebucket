"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Heart, Home, PanelRightClose, PartyPopper, Plus, Trash2, Users, type LucideIcon } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks";
import { useState, type CSSProperties, type DragEvent } from "react";
import { BOND_HOURS, hoursOf } from "@/lib/bonds";
import { cn } from "@/lib/format";
import { play } from "@/lib/sfx";
import { usePlanner, type Moment, type MomentKind } from "@/lib/store";

/** Cada tipo de momento con su color (lo llevan las tarjetas). */
export const MOMENT_STYLE: Record<MomentKind, { label: string; icon: LucideIcon; color: string; soft: string }> = {
  amor: { label: "Amor", icon: Heart, color: "#e8508a", soft: "#fde8f1" },
  familia: { label: "Familia", icon: Home, color: "#f08c2e", soft: "#feefdf" },
  amigos: { label: "Amigos", icon: Users, color: "#14a89a", soft: "#ddf5f2" },
  disfrute: { label: "Disfrute", icon: PartyPopper, color: "var(--color-alma)", soft: "var(--color-alma-soft)" },
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
};
const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
const HOURS = [1, 2, 3, 4, 5, 6];
const hoursText = (h: number) => `${String(h).replace(".", ",")} h`;

/**
 * Momentos del mes: lo que no es rutina y no va en el calendario. Vínculos arriba y Disfrute abajo,
 * cada grupo se comprime. Al sumar, un submenú pregunta con quién (en Vínculos) y cuánto duró.
 */
export function MomentsPanel({
  className,
  onCollapse,
  onHeaderDragStart,
}: {
  className?: string;
  onCollapse?: () => void;
  onHeaderDragStart?: (e: DragEvent) => void;
}) {
  const moments = usePlanner((s) => s.moments);
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const inMonth = moments.filter((m) => m.month === month);
  const desktop = useMediaQuery("(min-width: 1024px)");

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <header
        data-section-header
        draggable={!!onHeaderDragStart}
        onDragStart={onHeaderDragStart}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 select-none [-webkit-touch-callout:none]",
          onHeaderDragStart && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex items-center gap-1.5">
          {onHeaderDragStart && <GripVertical aria-hidden className="size-4 text-ink-faint" />}
          <div>
            <h2 className="type-title">Momentos</h2>
            <p className="text-[11.5px] text-ink-muted tabular-nums">
              {inMonth.length ? `${inMonth.length} en ${monthName(month)} · ${hoursText(inMonth.reduce((acc, m) => acc + hoursOf(m), 0))}` : "Lo que no es rutina"}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <button type="button" aria-label="Mes anterior" onClick={() => setMonth((m) => shift(m, -1))} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="w-[70px] text-center text-[12px] font-semibold">
            {month === thisMonth ? "Este mes" : monthName(month).replace(/^./, (c) => c.toUpperCase())}
          </span>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMonth((m) => shift(m, 1))} className="pressable grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <ChevronRight aria-hidden className="size-4" />
          </button>
          {onCollapse && (
            <button
              type="button"
              aria-label="Comprimir momentos"
              title="Comprimir"
              onClick={onCollapse}
              className="pressable ml-1 grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {desktop ? <PanelRightClose aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Uno arriba del otro; si se llena, scroll. */}
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-line overflow-y-auto">
        <Group title="Vínculos" accent="var(--color-vinculos)" kinds={["amor", "familia", "amigos"]} month={month} list={inMonth.filter((m) => m.kind !== "disfrute")} placeholder="Cena, cita, visita…" />
        <Group title="Disfrute" accent="var(--color-alma)" kinds={["disfrute"]} month={month} list={inMonth.filter((m) => m.kind === "disfrute")} placeholder="Bailar, un bar, un recital…" />
      </div>
    </div>
  );
}

/** Un grupo comprimible: la línea para sumar y sus tarjetas del mes (la más nueva primero). */
function Group({
  title,
  accent,
  kinds,
  month,
  list,
  placeholder,
}: {
  title: string;
  accent: string;
  kinds: MomentKind[];
  month: string;
  list: Moment[];
  placeholder: string;
}) {
  const addMoment = usePlanner((s) => s.addMoment);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [hours, setHours] = useState(BOND_HOURS[kinds[0]]);
  const add = (kind: MomentKind) => {
    addMoment({ kind, month, text: text.trim() || MOMENT_STYLE[kind].label, hours });
    play("pop");
    setText("");
    setMenu(false);
  };
  const total = list.reduce((acc, m) => acc + hoursOf(m), 0);

  return (
    <section aria-label={title} className="flex flex-col gap-2 px-3 py-2.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-left">
        <ChevronDown aria-hidden className={cn("size-4 text-ink-muted transition-transform duration-200", !open && "-rotate-90")} />
        <span className="flex-1 text-[13px] font-semibold">{title}</span>
        <span className="text-[11.5px] text-ink-muted tabular-nums">{total ? hoursText(total) : ""}</span>
        <span className="min-w-6 text-right text-[18px] leading-none font-semibold tabular-nums" style={{ color: accent }}>
          {list.length}
        </span>
      </button>

      {open && (
        <>
          {/* La línea para sumar: escribís (o no) y el "+" abre el submenú. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMenu(true);
            }}
            className="relative flex gap-1"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              aria-label={`Nuevo momento de ${title.toLowerCase()}`}
              className="h-8 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-[12.5px] focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              aria-label={`Sumar a ${title.toLowerCase()}`}
              aria-expanded={menu}
              className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-ink text-surface shadow-sm hover:bg-ink/90"
            >
              <Plus aria-hidden className={cn("size-4 transition-transform duration-200", menu && "rotate-45")} />
            </button>

            {menu && (
              <div className="animate-fade-up absolute top-full right-0 left-0 z-20 mt-1.5 flex flex-col gap-2.5 rounded-xl bg-surface p-3 shadow-[var(--shadow-popover)]">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-ink-muted">¿Cuánto duró?</span>
                  <div role="radiogroup" aria-label="Horas" className="flex gap-1">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        role="radio"
                        aria-checked={hours === h}
                        aria-label={`${h} horas`}
                        onClick={() => setHours(h)}
                        className={cn(
                          "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold tabular-nums transition-colors",
                          hours === h ? "bg-ink text-surface" : "bg-surface-sunken text-ink-muted hover:text-ink",
                        )}
                      >
                        <ClockFace hours={h} />
                        {h === 6 ? "6+" : h} h
                      </button>
                    ))}
                  </div>
                </div>
                {kinds.length > 1 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-ink-muted">¿Con quién?</span>
                    <div className="flex gap-1">
                      {kinds.map((k) => {
                        const st = MOMENT_STYLE[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => add(k)}
                            style={{ "--k": st.color, "--k-soft": st.soft } as CSSProperties}
                            className="pressable flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--k-soft)] py-2 text-[12px] font-semibold text-[var(--k)] hover:bg-[var(--k)] hover:text-white"
                          >
                            <st.icon aria-hidden className="size-3.5" />
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => add(kinds[0])}
                    style={{ background: accent }}
                    className="pressable h-8 rounded-lg text-[12.5px] font-semibold text-white"
                  >
                    Sumar
                  </button>
                )}
              </div>
            )}
          </form>

          <ul className="flex flex-col gap-1.5">
            {list.length === 0 && <li className="text-[11.5px] text-ink-faint">Nada este mes todavía.</li>}
            {[...list].reverse().map((m) => (
              <MomentCard key={m.id} moment={m} kinds={kinds} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Una tarjeta de momento: el tachito siempre a la vista; al tocarla se abre para cambiar el texto,
 * las horas y (en Vínculos) con quién.
 */
function MomentCard({ moment: m, kinds }: { moment: Moment; kinds: MomentKind[] }) {
  const removeMoment = usePlanner((s) => s.removeMoment);
  const updateMoment = usePlanner((s) => s.updateMoment);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text);
  const [hours, setHours] = useState(hoursOf(m));
  const [kind, setKind] = useState<MomentKind>(m.kind);
  const st = MOMENT_STYLE[editing ? kind : m.kind];
  const style = { "--k": st.color, "--k-soft": st.soft } as CSSProperties;

  const remove = () => {
    play("delete");
    removeMoment(m.id);
  };
  const open = () => {
    setText(m.text);
    setHours(hoursOf(m));
    setKind(m.kind);
    setEditing(true);
  };
  const save = () => {
    updateMoment(m.id, { text: text.trim() || MOMENT_STYLE[kind].label, hours, kind });
    play("pop");
    setEditing(false);
  };

  if (editing) {
    return (
      <li style={style} className="animate-fade-up rounded-xl bg-[var(--k-soft)] p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-2.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Qué fue"
            autoFocus
            className="h-9 rounded-lg border border-line bg-surface px-3 text-[13px] focus:border-ink focus:outline-none"
          />
          <div role="radiogroup" aria-label="Horas" className="flex gap-1">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={hours === h}
                aria-label={`${h} horas`}
                onClick={() => setHours(h)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold tabular-nums transition-colors",
                  hours === h ? "bg-ink text-surface" : "bg-surface text-ink-muted hover:text-ink",
                )}
              >
                <ClockFace hours={h} />
                {h === 6 ? "6+" : h} h
              </button>
            ))}
          </div>
          {kinds.length > 1 && (
            <div role="radiogroup" aria-label="Con quién" className="flex gap-1">
              {kinds.map((k) => {
                const ks = MOMENT_STYLE[k];
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    style={{ "--k": ks.color } as CSSProperties}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[12px] font-semibold transition-colors",
                      kind === k ? "bg-[var(--k)] text-white" : "bg-surface text-[var(--k)]",
                    )}
                  >
                    <ks.icon aria-hidden className="size-3.5" />
                    {ks.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={remove} aria-label={`Borrar ${m.text}`} className="pressable grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-danger">
              <Trash2 aria-hidden className="size-4" />
            </button>
            <span className="flex-1" />
            <button type="button" onClick={() => setEditing(false)} className="pressable h-9 rounded-lg px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface hover:text-ink">
              Cancelar
            </button>
            <button type="submit" className="pressable inline-flex h-9 items-center gap-1 rounded-lg bg-ink px-3.5 text-[12.5px] font-semibold text-surface hover:bg-ink/90">
              <Check aria-hidden className="size-3.5" />
              Guardar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li style={style} className="animate-fade-up flex items-center gap-1 rounded-xl bg-[var(--k-soft)] py-1 pr-1 pl-2">
      <button type="button" onClick={open} aria-label={`Editar ${m.text}`} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--k)] text-white">
          <st.icon aria-hidden className="size-3" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="line-clamp-2 block text-[12.5px] font-semibold break-words">{m.text}</span>
          <span className="block text-[10.5px] font-medium text-[var(--k)]">{st.label}</span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-ink-muted tabular-nums">{hoursText(hoursOf(m))}</span>
      </button>
      <button
        type="button"
        aria-label={`Borrar ${m.text}`}
        title="Borrar"
        onClick={remove}
        className="pressable grid size-8 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-surface hover:text-danger"
      >
        <Trash2 aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}

/** Un relojito: la aguja marca las horas (1 h = una hora de reloj). */
function ClockFace({ hours }: { hours: number }) {
  const angle = (Math.min(hours, 6) / 12) * 360;
  const r = 7;
  const x = 9 + r * Math.sin((angle * Math.PI) / 180);
  const y = 9 - r * Math.cos((angle * Math.PI) / 180);
  const large = angle > 180 ? 1 : 0;
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-[18px]">
      <circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d={`M9 9 L9 2 A${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill="currentColor" fillOpacity="0.45" />
      <line x1="9" y1="9" x2={x} y2={y} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
