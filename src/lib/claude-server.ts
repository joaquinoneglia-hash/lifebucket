import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/** Modelo para todas las funciones con IA de LifeBucket. */
export const MODEL = "claude-opus-5-5";

export const client = new Anthropic();

export const MISSING_KEY = "Falta configurar la clave de la API de Claude (ANTHROPIC_API_KEY en .env.local).";

/** Respuesta 503 si el servidor no tiene credenciales; null si está todo bien. */
export function missingKeyResponse() {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return null;
  return NextResponse.json({ error: MISSING_KEY, code: "missing_key" }, { status: 503 });
}

/** Traduce los errores del SDK a mensajes en español para la interfaz. */
export function errorResponse(error: unknown, tag: string) {
  if (error instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: "La clave de la API de Claude no es válida. Revisá .env.local." }, { status: 503 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "Hay mucha demanda ahora. Probá en un minuto." }, { status: 429 });
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`${tag} API error`, error.status, error.message);
    return NextResponse.json({ error: "La IA no está disponible ahora. Probá en un rato." }, { status: 502 });
  }
  console.error(`${tag} error`, error);
  return NextResponse.json({ error: "Algo salió mal. Probá de nuevo." }, { status: 500 });
}

export const refusalResponse = () =>
  NextResponse.json({ error: "No puedo ayudarte con ese pedido. Probá contármelo de otra forma." }, { status: 422 });

/** Parámetros comunes: respaldo automático si el modelo declina por una política. */
export const FALLBACK: { betas: Anthropic.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};
