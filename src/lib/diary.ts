import { guessQuadrant } from "./categorize";
import type { QuadrantId } from "./quadrants";
import { fromKey, toKey, type DateKey } from "./dates";
import { parseLogro } from "./logro-parse";
import type { Logro, LogroCat } from "./store";

/**
 * Mi diario personal: un texto puede traer varias cosas ("hoy corrí 2 horas, cené con amigos y practiqué
 * guitarra"). Se separa en logros (cada uno con su categoría y su duración, si se reconoce) y con todo el
 * mes se arma una historia por días, con tarjetas de color e hitos.
 */
export const DIARY_CATS: LogroCat[] = ["cuerpo", "interior", "alma", "mente", "vinculos", "trabajo"];
export type DiaryItem = {
  text: string;
  category: LogroCat | null;
  minutes: number;
  date: DateKey;
  start?: number;
  /** Si lo hacés rutina: los días de la semana en que se repite (0 = domingo). */
  repeat?: number[];
};

/** ¿Arranca con un verbo en pasado ("corrí", "fui", "hice")? Así se sabe que es otra cosa y no parte de la anterior. */
const PAST =
  /^(?:(?:hoy|ayer|anoche|anteayer|mañana|pasado\s+mañana|despu[eé]s|tambi[eé]n|luego|el\s+\p{L}+|este\s+\p{L}+|a\s+la\s+(?:mañana|tarde|noche)|a\s+las?\s+\S+(?:\s+de\s+la\s+\p{L}+)?)\s+)*(?:\p{L}+[éí]|fui|hice|tuve|estuve|pude|vi|di|puse|dije|vine|anduve|traje|voy|vamos|tengo|tenemos|quiero|hay\s+que|\p{L}+(?:ré|rá|remos)|me\s+\p{L}+|le\s+\p{L}+|la\s+\p{L}+)(?=[\s,.;]|$)/iu;

const suggest = (text: string, known: { name: string; quadrant: QuadrantId }[] = []): LogroCat | null => {
  const q = guessQuadrant(text, known);
  return q && (DIARY_CATS as string[]).includes(q) ? (q as LogroCat) : null;
};

/** `known`: tus bloques de la rutina, para reconocer tus propias actividades ("Brandtag" → Trabajo). */
export function parseDiary(input: string, now = new Date(), known: { name: string; quadrant: QuadrantId }[] = []): DiaryItem[] {
  const text = input.trim();
  if (!text) return [];
  const today = toKey(now);
  // Primero por oraciones; después, dentro de cada una, por ", " / " y " cuando lo que sigue es otra acción.
  const pieces: string[] = [];
  // "9 a.m.": los puntos de a.m. / p.m. no cortan la oración.
  for (const raw of text.replace(/\b([ap])\.\s?m\.?/gi, "$1m").split(/(?:[.;!?\n]+\s*)/).filter((x) => x.trim())) {
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
    // Si solo se escribió cuándo ("de lunes a viernes"), el título queda vacío hasta que digas qué es.
    const clean = parsed.text;
    const category = clean ? suggest(clean, known) : null;
    const minutes = parsed.minutes ?? (category ? 60 : 0);
    return { text: clean, category, minutes: category ? minutes : 0, date: parsed.date ?? whole.date ?? today, start: parsed.start ?? (parsed.repeat ? 18 * 60 : undefined), repeat: parsed.repeat ?? undefined };
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
  // Hitos: lo grande del mes (2 h o más) y, si no hay, lo más largo.
  const milestones = new Set<string>(list.filter((l) => l.category && l.minutes >= 120).map((l) => l.id));
  if (!milestones.size) {
    const top = [...list].filter((l) => l.category && l.minutes > 0).sort((a, b) => b.minutes - a.minutes)[0];
    if (top) milestones.add(top.id);
  }
  const counted = list.filter((l) => l.category && l.minutes > 0);
  const total = counted.reduce((acc, l) => acc + l.minutes, 0);
  const byCat = DIARY_CATS.map((c) => ({ c, m: counted.filter((l) => l.category === c).reduce((acc, l) => acc + l.minutes, 0) }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m);
  return { days, milestones, count: list.length, total, byCat };
}
