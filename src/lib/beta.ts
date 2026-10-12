import "server-only";
import { authConfigured } from "./supabase/config";
import { supabaseServer } from "./supabase/server";

/**
 * Quiénes ven las versiones de prueba (por ahora, "LifeBucket en pasos"). Se puede cambiar sin tocar
 * el código con la variable BETA_EMAILS (separados por coma). Vive en el servidor: no viaja al navegador.
 */
const BETA_EMAILS = (process.env.BETA_EMAILS ?? "joaquinoneglia@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** ¿La persona logueada puede ver la versión de prueba? Sin login configurado (desarrollo local), sí. */
export async function isBetaUser(): Promise<boolean> {
  if (!authConfigured) return process.env.NODE_ENV !== "production";
  const { data } = await (await supabaseServer()).auth.getUser();
  const email = data.user?.email?.toLowerCase();
  return !!email && BETA_EMAILS.includes(email);
}
