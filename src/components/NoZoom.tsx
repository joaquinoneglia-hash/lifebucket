"use client";

import { useEffect } from "react";

/**
 * La app no se agranda: ni con dos dedos ni con doble toque. Safari de iPhone ignora el `user-scalable=no`
 * del viewport, así que además se frenan sus gestos de zoom acá (el resto lo hace `touch-action` en el CSS).
 */
export function NoZoom() {
  useEffect(() => {
    const stopGesture = (e: Event) => e.preventDefault();
    const stopPinch = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };
    document.addEventListener("gesturestart", stopGesture);
    document.addEventListener("gesturechange", stopGesture);
    document.addEventListener("touchmove", stopPinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
      document.removeEventListener("touchmove", stopPinch);
    };
  }, []);
  return null;
}
