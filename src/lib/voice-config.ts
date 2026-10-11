/**
 * La voz de LifeBucket (ElevenLabs). Para cambiarla, cambiá solo esta constante:
 * el id sale de la Voice Library de ElevenLabs (o del MCP: "buscá voces en español rioplatense").
 */
export const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/**
 * Modelos en orden de preferencia: el multilingüe más nuevo y rápido primero; si la cuenta o el
 * endpoint no lo aceptan, el siguiente. Todos hablan bien español.
 */
export const VOICE_MODELS = ["eleven_v4_turbo", "eleven_flash_v2_5"] as const;

/** Cómo suena: un poco más estable que el default, a velocidad normal. */
export const VOICE_SETTINGS = { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 1 };
