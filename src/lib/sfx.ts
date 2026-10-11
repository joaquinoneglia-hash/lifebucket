/**
 * Sonidos de la app, sintetizados con Web Audio (sin archivos): cortos, suaves y con volumen bajo.
 * Se pueden silenciar (se recuerda en este navegador).
 */

export type Sfx = "click" | "pop" | "bubble" | "complete" | "delete" | "open" | "close";

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

function audio() {
  if (typeof window === "undefined") return null;
  ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
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
  }
}
