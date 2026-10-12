"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";

/** Hoja inferior en mobile, diálogo centrado en desktop. Usa <dialog> nativo (foco y Esc). */
export function Sheet({
  isMobile,
  onClose,
  labelledBy,
  width = "max-w-[460px]",
  side = false,
  children,
}: {
  isMobile: boolean;
  onClose: () => void;
  labelledBy: string;
  width?: string;
  /** En desktop, panel a la derecha de toda la altura en lugar de diálogo centrado. */
  side?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Cómo se abrió (hoja de celular o diálogo): lo que importa es al momento de abrir.
  const mobileAtOpen = useRef(isMobile);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // showModal mueve el foco por su cuenta; lo devolvemos al primer control útil. En el celular no se enfoca
    // un campo de texto solo: abriría el teclado y taparía media hoja.
    const first = dialog.querySelector<HTMLElement>("[data-autofocus]");
    const isField = (el: Element | null) => !!el?.matches("input, textarea, select");
    if (first && !(mobileAtOpen.current && isField(first))) first.focus();
    // En el celular, si el navegador enfocó un campo (un horario, un texto), el foco pasa a la hoja:
    // si no, se abre solo el reloj o el teclado.
    else if (mobileAtOpen.current && isField(document.activeElement)) dialog.focus({ preventScroll: true });
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={cn(
        "outline-none",
        "bg-surface p-0 text-ink backdrop:bg-ink/30",
        isMobile
          ? "animate-sheet-in mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-x-hidden overflow-y-auto rounded-t-2xl shadow-[var(--shadow-sheet)]"
          : side
            ? cn("animate-side-in my-0 mr-0 ml-auto h-dvh max-h-none w-full overflow-hidden shadow-[var(--shadow-popover)]", width)
            : cn("animate-fade-up m-auto max-h-[90dvh] w-full overflow-y-auto rounded-xl shadow-[var(--shadow-popover)]", width),
      )}
    >
      {isMobile && <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line" />}
      {children}
    </dialog>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-lg bg-surface-sunken p-1", className)}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-8 flex-1 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
              selected ? "bg-surface text-ink shadow-[0_1px_3px_rgba(37,40,54,0.1)]" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function GhostButton({
  danger,
  onClick,
  children,
  className,
}: {
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-3 font-medium hover:bg-surface-sunken",
        danger ? "text-danger" : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  type = "button",
  onClick,
  disabled,
  children,
  className,
  autoFocus,
}: {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-autofocus={autoFocus ? true : undefined}
      className={cn(
        "pressable inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-ink px-5 font-medium text-surface hover:bg-ink/90 disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-4 font-medium text-ink hover:bg-surface-sunken",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Selector nativo con la piel de la app (accesible y con la rueda del celu). */
export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-md border border-line bg-surface pr-9 pl-3 text-[13px] font-medium tabular-nums focus:border-ink focus:shadow-[0_0_0_3px_rgba(37,40,54,0.08)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </label>
  );
}
