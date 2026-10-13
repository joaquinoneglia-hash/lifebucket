/**
 * Modo prueba: la app con datos aparte (vacíos al entrar), en este navegador y sin tocar la nube. Sirve para
 * hacer la guía o probar cambios sin perder lo tuyo. Al salir, vuelven tus datos tal como estaban.
 */
const FLAG = "lb:modo-prueba";

export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

/** La clave de guardado de algo: en modo prueba, una aparte. */
export const testKey = (key: string) => (isTestMode() ? `${key}:prueba` : key);

/** Entrar: datos de prueba vacíos (arranca la guía) y se recarga. */
export function enterTestMode() {
  try {
    for (const k of Object.keys(localStorage)) if (k.endsWith(":prueba")) localStorage.removeItem(k);
    localStorage.setItem(FLAG, "1");
  } catch {}
  window.location.reload();
}

/** Volver a la cuenta de verdad: se borran los datos de prueba y se recarga. */
export function exitTestMode() {
  try {
    for (const k of Object.keys(localStorage)) if (k.endsWith(":prueba")) localStorage.removeItem(k);
    localStorage.removeItem(FLAG);
  } catch {}
  window.location.reload();
}
