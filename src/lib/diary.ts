import { guessQuadrant } from "./categorize";
import { fromKey, toKey, type DateKey } from "./dates";
import { parseLogro } from "./logro-parse";
import type { Logro, LogroCat } from "./store";

/**
 * Mi diario personal: un texto puede traer varias cosas ("hoy corrí 2 horas, cené con amigos y practiqué
 * guitarra"). Se separa en logros (cada uno con su categoría y su duración, si se reconoce) y con todo el
 * mes se arma una historia por días, con tarjetas de color e hitos.
 */
export const DIARY_CATS: LogroCat[] = ["cuerpo", "interior", "alma", "mente", "vinculos", "trabajo"];
export type DiaryItem = { text: string; category: LogroCat | null; minutes: number; date: DateKey };

/** ¿Arranca con un verbo en pasado ("corrí", "fui", "hice")? Así se sabe que es otra cosa y no parte de la anterior. */
const PAST = /^(?:hoy\s+|ayer\s+|despu[eé]s\s+|tambi[eé]n\s+|luego\s+|a\s+la\s+(?:mañana|tarde|noche)\s+)?(?:\p{L}+[éí]|fui|hice|tuve|estuve|pude|vi|di|puse|dije|vine|anduve|traje|me\s+\p{L}+|le\s+\p{L}+|la\s+\p{L}+)(?=[\s,.;]|$)/iu;

const suggest = (text: string): LogroCat | null => {
  const q = guessQuadrant(text);
  return q && (DIARY_CATS as string[]).includes(q) ? (q as LogroCat) : null;
};

export function parseDiary(input: string, now = new Date()): DiaryItem[] {
  const text = input.trim();
  if (!text) return [];
  const today = toKey(now);
  // Primero por oraciones; después, dentro de cada una, por ", " / " y " cuando lo que sigue es otra acción.
  const pieces: string[] = [];
  for (const raw of text.split(/(?:[.;!?\n]+\s*)/).filter((x) => x.trim())) {
    // "hora y media", "y cuarto": no son dos cosas.
    const sentence = raw.replace(/\s+y\s+(media|cuarto)\b/gi, "~$1");
    // Los separadores quedan en la lista (posiciones impares) para volver a armar el texto como estaba.
    const parts = sentence.split(/(\s*,\s*(?:y\s+)?|\s+y\s+(?:despu[eé]s\s+|tambi[eé]n\s+|luego\s+)?|\s+despu[eé]s\s+|\s+luego\s+)/);
    let cur = parts[0] ?? "";
    for (let i = 1; i < parts.length; i += 2) {
      const sep = parts[i];
      const next = parts[i + 1] ?? "";
      if (PAST.test(next.trim())) {
        pieces.push(cur);
        cur = next;
      } else cur = `${cur}${sep}${next}`;
    }
    if (cur.trim()) pieces.push(cur);
  }
  for (let i = 0; i < pieces.length; i++) pieces[i] = pieces[i].replace(/~/g, " y ");
  // Si el día se dijo una sola vez ("ayer corrí y después cené"), vale para todo.
  const whole = parseLogro(text, now);
  return pieces.map((p) => {
    const parsed = parseLogro(p, now);
    const clean = parsed.text || p.trim();
    const category = suggest(clean);
    const minutes = parsed.minutes ?? (category ? 60 : 0);
    return { text: clean, category, minutes: category ? minutes : 0, date: parsed.date ?? whole.date ?? today };
  });
}

const WEEKDAY = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric" });
const INTROS: Partial<Record<LogroCat, string>> = {
  cuerpo: "Un día con movimiento",
  interior: "Un día para adentro",
  alma: "Un día para disfrutar",
  mente: "Un día de aprender",
  vinculos: "Un día con los tuyos",
  trabajo: "Un día de laburo",
};

/** La historia del mes: un título por día, con su frase y sus tarjetas; y los hitos (lo más grande del mes). */
export function monthStory(logros: Logro[], month: string) {
  const list = logros.filter((l) => l.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(list.map((l) => l.date))].map((date) => {
    const items = list.filter((l) => l.date === date);
    const cats = items.map((l) => (l.minutes > 0 ? l.category : null)).filter(Boolean) as LogroCat[];
    const top = cats.sort((a, b) => cats.filter((c) => c === b).length - cats.filter((c) => c === a).length)[0];
    const lead = top ? INTROS[top]! : "Un día para recordar";
    return { date, title: WEEKDAY.format(fromKey(date)).replace(/^./, (c) => c.toUpperCase()), lead, items };
  });
  // Hitos: lo que más tiempo te llevó y la primera vez de cada categoría en el mes.
  const seen = new Set<string>();
  const milestones = new Set<string>();
  for (const l of list) {
    if (l.category && l.minutes > 0 && !seen.has(l.category)) {
      seen.add(l.category);
      milestones.add(l.id);
    }
    if (l.minutes >= 120) milestones.add(l.id);
  }
  const counted = list.filter((l) => l.category && l.minutes > 0);
  const total = counted.reduce((acc, l) => acc + l.minutes, 0);
  const byCat = DIARY_CATS.map((c) => ({ c, m: counted.filter((l) => l.category === c).reduce((acc, l) => acc + l.minutes, 0) }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m);
  return { days, milestones, count: list.length, total, byCat };
}
