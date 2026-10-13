"use client";

import { useEffect } from "react";
import { applyPalette } from "@/lib/palette";
import { isZenPlaying, startZen, zenWanted } from "@/lib/zen";

/**
 * La música zen está siempre (en el login, la bienvenida y la app), salvo que la apagues con el botón.
 * El navegador no deja sonar nada antes de que toques algo: arranca en el primer toque o tecla (menos si ese
 * toque es justo el botón de la música, que decide solo).
 */
export function ZenAutoplay() {
  // La paleta de colores elegida (se aplica apenas carga).
  useEffect(() => applyPalette(), []);
  useEffect(() => {
    const go = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-zen-toggle]")) return;
      if (!zenWanted() || isZenPlaying()) return off();
      void startZen().then(() => isZenPlaying() && off());
    };
    const off = () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return off;
  }, []);
  return null;
}
