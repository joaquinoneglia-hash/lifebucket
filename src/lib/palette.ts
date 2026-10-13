/** La paleta de colores de la app: pastel (por defecto), neutra o intensa. Se recuerda en este navegador. */
export type Palette = "neutro" | "pastel" | "intenso";
const KEY = "lb:palette";

export function getPalette(): Palette {
  try {
    const v = localStorage.getItem(KEY);
    return v === "neutro" || v === "intenso" ? v : "pastel";
  } catch {
    return "pastel";
  }
}

export function setPalette(p: Palette) {
  try {
    localStorage.setItem(KEY, p);
  } catch {}
  applyPalette(p);
}

export function applyPalette(p: Palette = getPalette()) {
  if (typeof document === "undefined") return;
  if (p === "pastel") document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", p);
}
