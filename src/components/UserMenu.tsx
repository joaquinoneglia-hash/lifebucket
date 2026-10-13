"use client";

import { getPalette, setPalette, type Palette } from "@/lib/palette";
import { Cloud, CloudOff, FlaskConical, Loader2, LogOut, Volume2, VolumeX } from "lucide-react";
import { flushCloud, stopCloudSync, useSync } from "@/lib/cloud-sync";
import { cn } from "@/lib/format";
import { isMuted, play, setMuted } from "@/lib/sfx";
import { useEffect, useRef, useState } from "react";
import { enterTestMode, exitTestMode, isTestMode } from "@/lib/test-mode";
import { supabaseBrowser } from "@/lib/supabase/client";
import { authConfigured } from "@/lib/supabase/config";
import { useUser } from "@/lib/supabase/use-user";

/** Pide volver a mostrar la guía (la escucha SimpleApp). */
export const TOUR_EVENT = "lb:tour";

/** La cuenta en el encabezado: la inicial (o la foto de Google) y, al tocarla, el email, la guía y "Salir". */
export function UserMenu({ withSound }: { withSound?: boolean }) {
  const who = useUser();
  const [open, setOpen] = useState(false);
  // En el celular el botón de sonido vive acá (en el encabezado no entra).
  const [mute, setMute] = useState(isMuted);
  // Las versiones de prueba solo aparecen para las cuentas habilitadas (lo decide el servidor).
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
    if (isTestMode()) return exitTestMode();
    // Primero se sube lo pendiente; después se borran los datos de este navegador (quedan en la nube).
    await flushCloud();
    stopCloudSync(true);
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
          {authConfigured && <SyncLine />}
          <button
            type="button"
            onClick={() => (isTestMode() ? exitTestMode() : enterTestMode())}
            className="pressable flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <FlaskConical aria-hidden className="size-4" />
            {isTestMode() ? "Salir del modo prueba (volver a mis datos)" : "Modo prueba (sin tocar mis datos)"}
          </button>
          {withSound && (
            <button
              type="button"
              onClick={() => {
                setMuted(!mute);
                setMute(!mute);
                if (mute) play("pop");
              }}
              aria-pressed={!mute}
              className="pressable flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {mute ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
              {mute ? "Activar sonidos" : "Silenciar sonidos"}
            </button>
          )}
          {authConfigured && (
            <button
              type="button"
              onClick={signOut}
              className="pressable flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
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

/** Si tus datos están guardados en la nube. */
function SyncLine() {
  const status = useSync((s) => s.status);
  const text: Record<string, string> = {
    idle: "Conectando con tu cuenta…",
    loading: "Trayendo tus datos…",
    saving: "Guardando…",
    saved: "Guardado en tu cuenta",
    offline: "Sin conexión: se guarda cuando vuelva",
    error: "No se pudo guardar. Se reintenta solo.",
  };
  const Icon = status === "saving" || status === "loading" ? Loader2 : status === "offline" || status === "error" ? CloudOff : Cloud;
  return (
    <p className={cn("mx-2.5 mb-1 flex items-center gap-1.5 border-b border-line pb-2 text-[11.5px]", status === "error" ? "text-danger" : "text-ink-muted")}>
      <Icon aria-hidden className={cn("size-3.5", (status === "saving" || status === "loading") && "animate-spin")} />
      {text[status]}
    </p>
  );
}


/**
 * Los colores de la app, arriba: un interruptor (prendido, a color; apagado, blanco y negro). La perilla se
 * desliza y se pinta con los colores de la app.
 */
export function PaletteSwitch({ compact }: { compact?: boolean }) {
  const [p, setP] = useState<Palette>("pastel");
  useEffect(() => setP(getPalette()), []);
  const color = p !== "neutro";
  const toggle = () => {
    const next: Palette = color ? "neutro" : "pastel";
    setP(next);
    setPalette(next);
    play("pop");
  };
  return (
    <span className="inline-flex">
      <button
        type="button"
        role="switch"
        aria-checked={color}
        onClick={toggle}
        aria-label={color ? "Colores: a color (tocá para blanco y negro)" : "Colores: blanco y negro (tocá para color)"}
        title={color ? "A color · tocá para blanco y negro" : "Blanco y negro · tocá para color"}
        className={cn("pressable inline-flex items-center gap-1.5 rounded-full", compact ? "px-1" : "h-9 bg-surface/80 pr-1.5 pl-3 text-[12px] font-medium shadow-[var(--shadow-card)] hover:bg-surface")}
      >
        {!compact && <span className="w-[54px] text-left">{color ? "Color" : "B y N"}</span>}
        <span className={cn("relative h-5 w-9 rounded-full transition-colors duration-200", color ? "bg-[linear-gradient(90deg,#96bef5,#c4b0f5,#faaacd,#ffc8aa)]" : "bg-ink/20")}>
          <span
            className={cn("absolute top-0.5 left-0.5 grid size-4 place-items-center rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]", color && "translate-x-4")}
          >
            <span className={cn("size-2 rounded-full transition-colors duration-200", color ? "bg-[conic-gradient(#5b8def,#9b7bf0,#ec6fa5,#f5a36b,#5b8def)]" : "bg-ink/50")} />
          </span>
        </span>
      </button>
    </span>
  );
}
