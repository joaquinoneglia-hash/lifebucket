"use client";

import { useEffect } from "react";
import { startZen, zenWanted } from "@/lib/zen";

/**
 * La música zen está siempre (en el login, la bienvenida y la app), salvo que la apagues con el botón.
 * El navegador no deja sonar nada antes de que toques algo: se intenta al abrir y, si no puede, arranca en el
 * primer toque o tecla.
 */
export function ZenAutoplay() {
  useEffect(() => {
    if (!zenWanted()) return;
    const go = () => {
      if (zenWanted()) void startZen();
    };
    go();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);
  return null;
}
