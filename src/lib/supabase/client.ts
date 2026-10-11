import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Cliente de Supabase para el navegador (la sesión vive en cookies). */
export function supabaseBrowser() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** Deja asentado un ingreso en el registro (tabla `ingresos`). Si falla, no frena la entrada. */
export async function logIngreso(proveedor: "google" | "email") {
  try {
    await supabaseBrowser().rpc("registrar_ingreso", { proveedor, navegador: navigator.userAgent });
  } catch {
    // El registro es secundario: el usuario entra igual.
  }
}
