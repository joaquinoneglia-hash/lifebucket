import "server-only";
import { NextResponse } from "next/server";
import { VOICE_ID, VOICE_MODELS, VOICE_SETTINGS } from "@/lib/voice-config";

/**
 * Texto → voz con ElevenLabs, en streaming: el audio empieza a llegar (y a sonar) apenas se genera
 * el primer pedazo. La clave vive solo en el servidor (ELEVENLABS_API_KEY en .env.local).
 * Si falla (sin clave, sin créditos, caído), responde 503 y el navegador usa su propia voz.
 */

// El modelo que ya funcionó, para no volver a probar los anteriores en cada frase.
let workingModel: string | null = null;

const unavailable = (reason: string, status = 503) => NextResponse.json({ error: reason, code: "tts_unavailable" }, { status });

/** ¿Hay voz de ElevenLabs configurada? (sin gastar créditos). */
export function GET() {
  return NextResponse.json({ enabled: !!process.env.ELEVENLABS_API_KEY });
}

export async function POST(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return unavailable("Falta ELEVENLABS_API_KEY en .env.local.");

  let text = "";
  try {
    text = String(((await request.json()) as { text?: string }).text ?? "").trim();
  } catch {
    return unavailable("No entendí el pedido.", 400);
  }
  if (!text) return unavailable("No hay texto.", 400);
  text = text.slice(0, 800);

  const models = workingModel ? [workingModel] : [...VOICE_MODELS];
  for (const model of models) {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model, voice_settings: VOICE_SETTINGS }),
    }).catch(() => null);

    if (upstream?.ok && upstream.body) {
      workingModel = model;
      return new Response(upstream.body, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Voice-Model": model },
      });
    }
    // Modelo no aceptado: probamos el siguiente. Clave inválida, sin créditos o límite: no tiene sentido seguir.
    const status = upstream?.status ?? 0;
    if (upstream) {
      const detail = await upstream.text().catch(() => "");
      console.error("tts", model, status, detail.slice(0, 300));
    }
    if (status === 401 || status === 402 || status === 429) return unavailable("ElevenLabs no está disponible (clave o créditos).");
    if (status !== 400 && status !== 404 && status !== 422) break;
  }
  return unavailable("ElevenLabs no respondió.");
}
