/**
 * Música zen de fondo, sintetizada en el navegador (sin archivos): acordes lentos y abiertos que se van
 * fundiendo uno en otro, con un filtro que respira y, cada tanto, un cuenco suave. Volumen bajo.
 * Se prende y se apaga con un fundido; la preferencia se recuerda en este navegador.
 */

const KEY = "lb:zen";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | undefined;
let playing = false;
const listeners = new Set<(on: boolean) => void>();

/** Notas en Hz: re pentatónico, grave y abierto. */
const CHORDS = [
  [146.83, 220.0, 293.66, 369.99],
  [130.81, 196.0, 261.63, 329.63],
  [110.0, 164.81, 246.94, 329.63],
  [123.47, 185.0, 246.94, 369.99],
];
const BELLS = [587.33, 659.25, 739.99, 880.0, 987.77];

export function zenWanted() {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function isZenPlaying() {
  return playing;
}

export function onZenChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  for (const fn of listeners) fn(playing);
}

/** Un acorde que entra despacio, se sostiene y se va (se superpone con el siguiente). */
function chord(a: AudioContext, out: AudioNode, notes: number[], t: number, dur: number) {
  for (const [i, f] of notes.entries()) {
    for (const detune of [-4, 4]) {
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      osc.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i === 0 ? 0.05 : 0.022, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
  }
}

/** Un cuenco: una nota que suena y se apaga larga. */
function bell(a: AudioContext, out: AudioNode, t: number) {
  const f = BELLS[Math.floor(Math.random() * BELLS.length)];
  for (const [mult, gain] of [
    [1, 0.03],
    [2.76, 0.008],
  ] as const) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = "sine";
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 5.2);
  }
}

let starting = false;
/** Si mientras arrancaba la apagaste, no arranca. */
let cancelled = false;
export async function startZen() {
  if (playing || starting || typeof window === "undefined") return;
  // Sin un toque previo el navegador no deja sonar (y el arranque quedaría colgado): se espera al primer toque.
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (ua && !ua.hasBeenActive) return;
  cancelled = false;
  starting = true;
  try {
    await begin();
  } finally {
    starting = false;
  }
}

async function begin() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx ??= new Ctor();
    // Si el navegador no responde, no se queda esperando para siempre.
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 800))]);
  } catch {
    return;
  }
  if (ctx.state !== "running" || cancelled) return;
  const a = ctx;
  playing = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {}

  master = a.createGain();
  master.gain.setValueAtTime(0.0001, a.currentTime);
  master.gain.exponentialRampToValueAtTime(0.55, a.currentTime + 3);
  // Un filtro que respira lento y un eco de sala.
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.4;
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 350;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  const delay = a.createDelay(2);
  delay.delayTime.value = 0.6;
  const fb = a.createGain();
  fb.gain.value = 0.35;
  delay.connect(fb).connect(delay);
  filter.connect(master);
  filter.connect(delay);
  delay.connect(master);
  master.connect(a.destination);

  let i = 0;
  const DUR = 12;
  const loop = () => {
    if (!playing || !master) return;
    const t = a.currentTime + 0.05;
    chord(a, filter, CHORDS[i % CHORDS.length], t, DUR + 4);
    if (Math.random() < 0.7) bell(a, delay, t + 2 + Math.random() * 6);
    i++;
    timer = window.setTimeout(loop, DUR * 1000);
  };
  loop();
  emit();
}

export function stopZen(remember = true) {
  if (remember) {
    try {
      localStorage.setItem(KEY, "0");
    } catch {}
  }
  if (starting) cancelled = true;
  if (!playing) return emit();
  playing = false;
  window.clearTimeout(timer);
  if (remember) {
    try {
      localStorage.setItem(KEY, "0");
    } catch {}
  }
  const a = ctx;
  const m = master;
  master = null;
  if (a && m) {
    m.gain.cancelScheduledValues(a.currentTime);
    m.gain.setValueAtTime(Math.max(0.0001, m.gain.value), a.currentTime);
    m.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 1.2);
    window.setTimeout(() => m.disconnect(), 1400);
  }
  emit();
}
