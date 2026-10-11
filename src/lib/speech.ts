/**
 * La voz de la app. Primero ElevenLabs (vía /api/tts, en streaming: suena apenas llega el primer
 * pedazo); si no está disponible, la voz del navegador. Si ElevenLabs falla una vez por clave o
 * créditos, no se vuelve a intentar en esta sesión.
 */

let remoteOff = false;
let remoteStatus: Promise<boolean> | null = null;
const remoteEnabled = () =>
  (remoteStatus ??= fetch("/api/tts")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => !!d.enabled)
    .catch(() => false));
let current: { audio?: HTMLAudioElement; abort?: AbortController } = {};

export function stopSpeaking() {
  current.abort?.abort();
  if (current.audio) {
    current.audio.pause();
    current.audio.removeAttribute("src");
  }
  current = {};
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Habla y resuelve cuando termina (o si se corta). */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  if (!text.trim()) return;
  if (!remoteOff && (await remoteEnabled())) {
    try {
      const played = await speakRemote(text);
      if (played) return;
    } catch {
      // Si algo falla a mitad de camino, seguimos con la voz del navegador.
    }
  }
  return speakBrowser(text);
}

async function speakRemote(text: string): Promise<boolean> {
  const abort = new AbortController();
  current.abort = abort;
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: abort.signal,
  });
  if (!res.ok || !res.body) {
    if (res.status === 503) remoteOff = true;
    return false;
  }

  const audio = new Audio();
  current.audio = audio;
  const ended = new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    abort.signal.addEventListener("abort", () => resolve());
  });

  // Streaming: el MP3 se va sumando a medida que llega y empieza a sonar con el primer pedazo.
  if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")) {
    const source = new MediaSource();
    audio.src = URL.createObjectURL(source);
    await new Promise((r) => source.addEventListener("sourceopen", r, { once: true }));
    const buffer = source.addSourceBuffer("audio/mpeg");
    const reader = res.body.getReader();
    const append = (chunk: Uint8Array) =>
      new Promise<void>((r) => {
        buffer.addEventListener("updateend", () => r(), { once: true });
        buffer.appendBuffer(chunk as BufferSource);
      });
    let started = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await append(value);
      if (!started) {
        started = true;
        audio.play().catch(() => undefined);
      }
    }
    if (source.readyState === "open") source.endOfStream();
    if (!started) return false;
  } else {
    // Sin MediaSource (Safari viejo): se baja entero y suena.
    const blob = await res.blob();
    audio.src = URL.createObjectURL(blob);
    await audio.play();
  }
  await ended;
  return true;
}

/** La voz del navegador (respaldo): una en español si hay. */
function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    u.voice =
      voices.find((v) => v.lang === "es-AR") ??
      voices.find((v) => v.lang.startsWith("es-4") || v.lang === "es-US") ??
      voices.find((v) => v.lang.startsWith("es")) ??
      null;
    u.lang = u.voice?.lang ?? "es-AR";
    u.rate = 1.05;
    const fallback = setTimeout(resolve, 1200 + text.length * 75);
    u.onend = u.onerror = () => {
      clearTimeout(fallback);
      resolve();
    };
    synth.speak(u);
  });
}
