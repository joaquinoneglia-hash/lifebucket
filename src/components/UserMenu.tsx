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

/** Los colores de la app: neutro (minimalista), pastel o intenso. */
const PALETTES: { id: Palette; label: string; dots: string[] }[] = [
  { id: "pastel", label: "Color", dots: ["#2e9e63", "#8a5cf0", "#e5508a"] },
  { id: "neutro", label: "Blanco y negro", dots: ["#111", "#6b6b6b", "#c4c4c4"] },
];

/** Los colores de la app, arriba: cada clic pasa a la paleta siguiente (pastel → intenso → neutro). */
export function PaletteSwitch() {
  const [p, setP] = useState<Palette>("pastel");
  useEffect(() => setP(getPalette()), []);
  const i = Math.max(0, PALETTES.findIndex((o) => o.id === p));
  const cur = PALETTES[i];
  const next = PALETTES[(i + 1) % PALETTES.length];
  return (
    <button
      type="button"
      onClick={() => {
        setP(next.id);
        setPalette(next.id);
        play("pop");
      }}
      aria-label={`Colores: ${cur.label}. Cambiar a ${next.label}`}
      title={`Colores: ${cur.label} (clic para ${next.label.toLowerCase()})`}
      className="pressable grid size-10 place-items-center rounded-md hover:bg-surface/70"
    >
      <span className="flex -space-x-1">
        {cur.dots.map((d) => (
          <span key={d} className="size-2.5 rounded-full ring-2 ring-[var(--color-canvas,#f4f4f6)] transition-colors duration-200" style={{ background: d }} />
        ))}
      </span>
    </button>
  );
}
