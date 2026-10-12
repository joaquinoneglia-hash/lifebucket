"use client";

import { useEffect } from "react";

/** ¿Este elemento (o alguno de arriba) tiene contenido propio para deslizar en vertical? */
function scrollableAncestor(el: Element | null): HTMLElement | null {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === "auto" || overflowY === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

/**
 * La app no se mueve: sin scroll de página, sin rebote, sin "tirar para recargar" y sin zoom.
 * Solo se desliza el contenido de adentro de una tarjeta u hoja cuando es más largo que su lugar.
 */
export function ScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("lb-locked");
    const stop = (e: TouchEvent) => {
      if (!e.cancelable) return;
      if (e.touches.length > 1 || !scrollableAncestor(e.target as Element)) e.preventDefault();
    };
    document.addEventListener("touchmove", stop, { passive: false });
    return () => {
      root.classList.remove("lb-locked");
      document.removeEventListener("touchmove", stop);
    };
  }, []);
  return null;
}
