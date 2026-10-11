import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Vuelta de Google (o del mail de confirmación): abre la sesión, registra el ingreso y entra a la app. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const failed = url.searchParams.get("error_description");
  if (failed || !code) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  const proveedor = data.user.app_metadata?.provider === "google" ? "google" : "email";
  await supabase.rpc("registrar_ingreso", { proveedor, navegador: request.headers.get("user-agent") ?? "" });

  return NextResponse.redirect(new URL("/", url.origin));
}
