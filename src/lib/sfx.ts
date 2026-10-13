/**
 * Sonidos de la app, sintetizados con Web Audio (sin archivos): cortos, suaves y con volumen bajo.
 * Se pueden silenciar (se recuerda en este navegador).
 */

export type Sfx = "click" | "pop" | "bubble" | "complete" | "delete" | "open" | "close" | "paper" | "fanfare";

const MUTE_KEY = "lb:muted";
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {}
}

/** El audio del navegador (o null si no hay: entonces la app sigue, sin sonido). */
function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Un tono con envolvente rápida: sube en milisegundos y se apaga suave. */
function tone(a: AudioContext, { freq, to, start = 0, dur, type = "sine", gain = 0.12 }: { freq: number; to?: number; start?: number; dur: number; type?: OscillatorType; gain?: number }) {
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function play(name: Sfx) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  switch (name) {
    case "click":
      tone(a, { freq: 1800, to: 1200, dur: 0.03, type: "triangle", gain: 0.04 });
      break;
    case "pop":
      // Gota que sube: el "pop" de algo que aparece.
      tone(a, { freq: 420, to: 980, dur: 0.09, gain: 0.14 });
      break;
    case "bubble":
      tone(a, { freq: 520, to: 760, dur: 0.07, gain: 0.1 });
      tone(a, { freq: 700, to: 1050, start: 0.055, dur: 0.07, gain: 0.08 });
      break;
    case "complete":
      // Dos notas que suben (do–mi–sol corto).
      tone(a, { freq: 523.25, dur: 0.12, type: "triangle", gain: 0.1 });
      tone(a, { freq: 659.25, start: 0.07, dur: 0.12, type: "triangle", gain: 0.1 });
      tone(a, { freq: 783.99, start: 0.14, dur: 0.22, type: "triangle", gain: 0.1 });
      break;
    case "delete":
      tone(a, { freq: 300, to: 120, dur: 0.14, gain: 0.12 });
      break;
    case "open":
      tone(a, { freq: 600, to: 900, dur: 0.06, type: "triangle", gain: 0.05 });
      break;
    case "close":
      tone(a, { freq: 900, to: 600, dur: 0.06, type: "triangle", gain: 0.05 });
      break;
    case "paper":
      paper(a);
      break;
    case "fanfare":
      // Día completo: un arpegio que sube (do–mi–sol–do) y un acorde brillante con destellos arriba.
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(a, { freq: f, start: i * 0.07, dur: 0.18, type: "triangle", gain: 0.11 }));
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(a, { freq: f, start: 0.32, dur: 0.7, type: "sine", gain: 0.06 }));
      [2093, 2637, 3136].forEach((f, i) => tone(a, { freq: f, start: 0.36 + i * 0.09, dur: 0.12, type: "sine", gain: 0.035 }));
      break;
  }
}

/** El roce de una hoja: ruido que pasa por un filtro que barre, en dos tiempos (como dar vuelta una página). */
function paper(a: AudioContext) {
  const len = Math.floor(a.sampleRate * 0.45);
  const buffer = a.createBuffer(1, len, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 90));
  for (const [start, from, to, gain] of [
    [0, 1800, 5200, 0.09],
    [0.16, 3600, 1400, 0.06],
  ] as const) {
    const src = a.createBufferSource();
    src.buffer = buffer;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    const t = a.currentTime + start;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + 0.22);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
    src.stop(t + 0.3);
  }
}

/**
 * Un escalón de la escalerita: suena cada vez que un bloque crece (o se mueve) media hora mientras lo
 * arrastrás. Cuanto más largo, más agudo (una escala mayor que sube); si se achica, baja.
 */
const SCALE = [0, 2, 4, 5, 7, 9, 11];
let lastStep = 0;
export function step(n: number) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  // Sin metralleta: como mucho un escalón cada 35 ms.
  const now = performance.now();
  if (now - lastStep < 35) return;
  lastStep = now;
  const i = Math.max(0, Math.min(28, n));
  const semis = Math.floor(i / 7) * 12 + SCALE[i % 7];
  const freq = 392 * Math.pow(2, semis / 12);
  tone(a, { freq, to: freq * 1.04, dur: 0.05, type: "triangle", gain: 0.05 });
}

/**
 * La intro de la bienvenida (~4 s): un acorde que se abre despacio (Fa mayor con novena, filtro que
 * se va abriendo), un bajo suave y unas notas de cristal arriba con eco. Devuelve false si el navegador
 * todavía no deja sonar (hace falta un toque del usuario): en ese caso conviene llamarla en el primer clic.
 */
export async function playIntro(): Promise<boolean> {
  if (isMuted()) return true;
  const a = audio();
  if (!a) return false;
  try {
    await a.resume();
  } catch {}
  if (a.state !== "running") return false;

  const t0 = a.currentTime + 0.05;
  const master = a.createGain();
  master.gain.value = 0.9;
  master.connect(a.destination);

  // Eco: le da aire, como una sala.
  const delay = a.createDelay(1);
  delay.delayTime.value = 0.29;
  const feedback = a.createGain();
  feedback.gain.value = 0.38;
  const damp = a.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2600;
  const wet = a.createGain();
  wet.gain.value = 0.32;
  delay.connect(damp).connect(feedback).connect(delay);
  damp.connect(wet).connect(master);

  // El acorde: arranca oscuro y se abre.
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(320, t0);
  filter.frequency.exponentialRampToValueAtTime(3400, t0 + 1.4);
  filter.connect(master);
  filter.connect(delay);

  const pad = (freq: number, gain: number) => {
    for (const [type, cents] of [
      ["sine", -7],
      ["triangle", 7],
    ] as const) {
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.9);
      g.gain.setValueAtTime(gain, t0 + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.2);
      osc.connect(g).connect(filter);
      osc.start(t0);
      osc.stop(t0 + 4.3);
    }
  };
  pad(87.31, 0.05); // Fa grave
  for (const f of [174.61, 261.63, 329.63, 392.0, 440.0]) pad(f, 0.022); // Fa, Do, Mi, Sol, La

  // Notas de cristal que suben (Do–Mi–Sol–Do) cuando el acorde ya se abrió.
  [1046.5, 1318.51, 1567.98, 2093.0].forEach((freq, i) => {
    const t = t0 + 0.95 + i * 0.14;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(g);
    g.connect(master);
    g.connect(delay);
    osc.start(t);
    osc.stop(t + 1.2);
  });
  return true;
}
