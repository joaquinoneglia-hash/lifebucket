"use client";

import { LogOut, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { authConfigured } from "@/lib/supabase/config";
import { useUser } from "@/lib/supabase/use-user";

/** Pide volver a mostrar la guía (la escucha SimpleApp). */
export const TOUR_EVENT = "lb:tour";

/** La cuenta en el encabezado: la inicial (o la foto de Google) y, al tocarla, el email, la guía y "Salir". */
export function UserMenu() {
  const who = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!who) return null;
  const initial = (who.name || who.email || "L").trim()[0]?.toUpperCase();

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.replace("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Tu cuenta"
        className="pressable grid size-9 place-items-center overflow-hidden rounded-full bg-ink text-[13px] font-semibold text-surface"
      >
        {who.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={who.avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-60 rounded-xl bg-surface p-1.5 shadow-[var(--shadow-popover)]">
          {(who.name || who.email) && (
            <div className="px-2.5 py-2">
              {who.name && <p className="truncate text-[13px] font-medium">{who.name}</p>}
              {who.email && <p className="truncate text-[12px] text-ink-muted">{who.email}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(TOUR_EVENT));
            }}
            className="pressable flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Sparkles aria-hidden className="size-4" />
            Ver la guía otra vez
          </button>
          {authConfigured && (
            <button
              type="button"
              onClick={signOut}
              className="pressable flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <LogOut aria-hidden className="size-4" />
              Salir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
