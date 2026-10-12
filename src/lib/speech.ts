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

/** La velocidad de lectura (1 = normal). Se puede cambiar mientras habla. */
let rate = 1;
export function setSpeechRate(r: number) {
  rate = r;
  if (current.audio) current.audio.playbackRate = r;
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
  audio.playbackRate = rate;
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
        audio.playbackRate = rate;
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

/**
 * La mejor voz en español del navegador: primero las "naturales" (neuronales: las de Edge, las de Google en
 * Chrome, las mejoradas de Apple), y entre ellas, rioplatense, latina y después cualquier español.
 */
function bestVoice(voices: SpeechSynthesisVoice[]) {
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural|online/.test(n)) s += 100;
    if (/google/.test(n)) s += 60;
    if (/premium|enhanced|mejorad/.test(n)) s += 50;
    if (v.lang === "es-AR") s += 30;
    else if (/es-(419|us|mx|uy|cl|co)/i.test(v.lang)) s += 20;
    else if (v.lang === "es-ES") s += 10;
    if (!v.localService) s += 5;
    return s;
  };
  return es.sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Las voces tardan en cargar la primera vez (Chrome): se espera un momento. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 800);
  });
}

/** La voz del navegador (respaldo): la más humana en español que haya. */
function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const synth = window.speechSynthesis;
    void loadVoices().then((voices) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = bestVoice(voices);
    u.lang = u.voice?.lang ?? "es-AR";
    u.rate = 1.02 * rate;
    const fallback = setTimeout(resolve, 1200 + (text.length * 75) / rate);
    u.onend = u.onerror = () => {
      clearTimeout(fallback);
      resolve();
    };
    synth.speak(u);
    });
  });
}
