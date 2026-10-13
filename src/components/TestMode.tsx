"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { enterTestMode, exitTestMode, isTestMode } from "@/lib/test-mode";

/** En modo prueba, siempre a la vista: que se note y que se pueda salir (o reiniciar) en un toque. */
export function TestModeBadge() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isTestMode()), []);
  if (!on) return null;
  return (
    <div className="fixed bottom-3 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#7c3aed] py-1 pr-1 pl-3 text-[12px] font-semibold text-white shadow-[var(--shadow-popover)]">
      <FlaskConical aria-hidden className="size-3.5" />
      <span className="mr-1">Modo prueba · tus datos no se tocan</span>
      <button type="button" onClick={enterTestMode} className="pressable h-7 rounded-full bg-white/15 px-2.5 hover:bg-white/25">
        Reiniciar
      </button>
      <button type="button" onClick={exitTestMode} className="pressable h-7 rounded-full bg-white px-2.5 text-[#7c3aed] hover:bg-white/90">
        Salir
      </button>
    </div>
  );
}
