"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/format";
import { logIngreso, supabaseBrowser } from "@/lib/supabase/client";
import { authConfigured } from "@/lib/supabase/config";

type Mode = "entrar" | "crear";

/** Los errores de Supabase, en criollo. */
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "El email o la contraseña no coinciden.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya hay una cuenta con ese email. Entrá con tu contraseña.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu email. Revisá tu casilla (y el spam).";
  if (m.includes("password should be") || m.includes("at least")) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (m.includes("invalid") && m.includes("email")) return "Ese email no parece válido.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Esperá un minuto y probá de nuevo.";
  return "Algo falló. Probá de nuevo en un momento.";
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) setError("No pudimos completar la entrada. Probá de nuevo.");
  }, []);

  const google = async () => {
    setError("");
    setBusy("google");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(explain(error.message));
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy("email");
    const auth = supabaseBrowser().auth;
    const { data, error } =
      mode === "entrar"
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      setError(explain(error.message));
      setBusy(null);
      return;
    }
    if (!data.session) {
      // Cuenta nueva con confirmación por mail.
      setNotice(`Te mandamos un mail a ${email}. Confirmalo y entrás directo.`);
      setBusy(null);
      return;
    }
    await logIngreso("email");
    window.location.replace("/");
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-[380px] flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size={52} />
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">LifeBucket</h1>
            <p className="mt-1 text-[14px] text-ink-muted">Mirá con qué estás llenando tu semana.</p>
          </div>
        </div>

        <div className="card flex w-full flex-col gap-4 p-5 sm:p-6">
          {!authConfigured && (
            <p role="status" className="rounded-md bg-surface-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-muted">
              Falta configurar Supabase (<code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>), así que el login todavía no funciona.
            </p>
          )}

          <button
            type="button"
            onClick={google}
            disabled={busy !== null || !authConfigured}
            className="pressable inline-flex h-11 items-center justify-center gap-2.5 rounded-md border border-line bg-surface px-4 font-medium text-ink hover:bg-surface-sunken disabled:opacity-50"
          >
            <GoogleIcon />
            {busy === "google" ? "Abriendo Google…" : "Seguir con Google"}
          </button>

          <div className="flex items-center gap-3 text-[12px] text-ink-faint" aria-hidden>
            <span className="h-px flex-1 bg-line" />o con tu email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-md border border-line bg-surface px-3 text-[15px] outline-none focus:border-ink/40"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">Contraseña</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-md border border-line bg-surface px-3 text-[15px] outline-none focus:border-ink/40"
              />
              {mode === "crear" && <span className="text-[11.5px] text-ink-faint">Al menos 6 caracteres.</span>}
            </label>

            {error && (
              <p role="alert" className="text-[13px] leading-snug text-danger">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-[13px] leading-snug text-success">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy !== null || !authConfigured}
              className="pressable mt-1 inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 font-medium text-surface hover:bg-ink/90 disabled:opacity-50"
            >
              {busy === "email" ? "Un segundo…" : mode === "entrar" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-[13.5px] text-ink-muted">
          {mode === "entrar" ? "¿Primera vez?" : "¿Ya tenés cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "entrar" ? "crear" : "entrar");
              setError("");
              setNotice("");
            }}
            className={cn("font-medium text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink")}
          >
            {mode === "entrar" ? "Creá tu cuenta" : "Entrá"}
          </button>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-[18px]">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
