import { addDays, toKey, type DateKey } from "./dates";

/**
 * Lee un logro escrito como se habla ("salí a correr dos horas ayer") con reglas, sin IA: cuánto duró, qué
 * día fue y lo que queda es el texto ("Salí a correr"). Lo que no entiende lo deja como está.
 */
export interface ParsedLogro {
  /** El texto sin la duración ni la fecha. */
  text: string;
  minutes: number | null;
  date: DateKey | null;
}

const NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, noventa: 90,
};
const NUM = `(\\d+(?:[.,]\\d+)?|${Object.keys(NUMBERS).join("|")})`;
const toNumber = (s: string) => NUMBERS[s] ?? Number(s.replace(",", "."));

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Sin tildes y en minúsculas, con el mismo largo (así las posiciones sirven para recortar el original). */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Las duraciones, de la más larga a la más corta (la primera que encaja gana). */
const DURATIONS: { re: RegExp; minutes: (m: RegExpExecArray) => number }[] = [
  // "1h30", "1 h 30", "2hs 15"
  { re: /\b(\d+)\s*(?:h|hs|hrs?)\.?\s*(\d{1,2})\b(?!\s*(?:h|hs|hrs?|horas?)\b)/, minutes: (m) => Number(m[1]) * 60 + Number(m[2]) },
  // "dos horas y media", "una hora y cuarto", "1 hora y 20 minutos"
  {
    re: new RegExp(`\\b${NUM}\\s*(?:horas?|hs?|hrs?)\\.?\\s+y\\s+(media|cuarto|\\d+\\s*(?:minutos?|mins?|m)\\b)`),
    minutes: (m) => toNumber(m[1]) * 60 + (m[2] === "media" ? 30 : m[2] === "cuarto" ? 15 : parseInt(m[2], 10)),
  },
  // "tres cuartos de hora"
  { re: /\btres\s+cuartos\s+de\s+hora\b/, minutes: () => 45 },
  // "un par de horas", "unas horas", "varias horas"
  { re: /\b(?:un\s+par\s+de|unas|varias|algunas)\s+horas\b/, minutes: () => 120 },
  // "toda la mañana / tarde / noche", "todo el día"
  { re: /\btoda\s+la\s+(?:manana|tarde|noche)\b/, minutes: () => 240 },
  { re: /\btodo\s+el\s+dia\b/, minutes: () => 480 },
  // "un rato", "un ratito"
  { re: /\bun\s+rat(?:o|ito)\b/, minutes: () => 30 },
  // "hora y media"
  { re: /\bhora\s+y\s+media\b/, minutes: () => 90 },
  // "media hora"
  { re: /\bmedia\s+hora\b/, minutes: () => 30 },
  // "2 horas", "dos hs", "1,5 h"
  { re: new RegExp(`\\b${NUM}\\s*(?:horas?|hs|hrs?|h)\\b\\.?`), minutes: (m) => Math.round(toNumber(m[1]) * 60) },
  // "45 minutos", "veinte min", "45'"
  { re: new RegExp(`\\b${NUM}\\s*(?:minutos?|mins?|m)\\b\\.?`), minutes: (m) => Math.round(toNumber(m[1])) },
  { re: /\b(\d{1,3})\s*'/, minutes: (m) => Number(m[1]) },
];

export function parseLogro(input: string, now = new Date()): ParsedLogro {
  let text = input;
  let minutes: number | null = null;
  let date: DateKey | null = null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /** Saca de `text` lo que encontró la expresión (con su "durante", "por", "el" de antes). */
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(fold(text));
    if (!m) return null;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return m;
  };

  for (const d of DURATIONS) {
    const m = take(new RegExp(`(?:\\b(?:durante|por|como|unas?|unos?)\\s+)?${d.re.source}`));
    if (m) {
      // Si "unas" quedó tomado como número ("unas dos horas"), el valor está más adelante.
      const sub = d.re.exec(m[0]);
      const value = sub ? d.minutes(sub) : null;
      if (value && value > 0 && value <= 24 * 60) minutes = value;
      break;
    }
  }

  // Fecha: hoy, ayer, anteayer, un día de la semana o un día del mes. Nunca en el futuro.
  const ago = take(new RegExp(`\\bhace\\s+${NUM}\\s+(dias?|semanas?)\\b`));
  const agoWord = !ago && take(/\bhace\s+(un|una)\s+(dia|semana)\b/);
  if (ago || agoWord) {
    const m = (ago || agoWord) as RegExpExecArray;
    const n = toNumber(m[1]);
    date = toKey(addDays(today, -Math.round(n * (m[2].startsWith("semana") ? 7 : 1))));
  } else if (take(/\b(?:anteayer|antes\s+de\s+ayer|antier|antes\s+ayer)\b/)) date = toKey(addDays(today, -2));
  else if (take(/\b(?:la\s+semana\s+pasada)\b/)) date = toKey(addDays(today, -7));
  else if (take(/\b(?:el\s+)?(?:finde|fin\s+de\s+semana)(?:\s+pasado)?\b/)) {
    const back = (today.getDay() - 6 + 7) % 7 || 7;
    date = toKey(addDays(today, -back));
  } else if (take(/\banoche\b/)) date = toKey(addDays(today, -1));
  else if (take(/\b(?:ayer)\b(?:\s+(?:a\s+la|por\s+la|en\s+la)\s+(?:manana|tarde|noche))?/)) date = toKey(addDays(today, -1));
  else if (take(/\b(?:hoy|esta\s+(?:manana|tarde|noche)|recien|hace\s+un\s+rato)\b/)) date = toKey(today);
  else {
    const wd = take(new RegExp(`\\b(?:el\\s+|este\\s+|el\\s+pasado\\s+)?(${WEEKDAYS.join("|")})(?:\\s+pasado)?\\b`));
    if (wd) {
      const target = WEEKDAYS.indexOf(wd[1]);
      // El último que pasó (si es hoy, el de la semana pasada).
      const back = (today.getDay() - target + 7) % 7 || 7;
      date = toKey(addDays(today, -back));
    } else {
      const dm = take(new RegExp(`\\bel\\s+(\\d{1,2})(?:\\s+de\\s+(${MONTHS.join("|")})|\\s*/\\s*(\\d{1,2}))?\\b(?!\\s*(?:k|km|kms|mts?|metros|%))`));
      if (dm) {
        const day = Number(dm[1]);
        const month = dm[2] ? MONTHS.indexOf(dm[2]) : dm[3] ? Number(dm[3]) - 1 : today.getMonth();
        let d = new Date(today.getFullYear(), month, day);
        // Si todavía no llegó, es el del mes (o año) anterior.
        if (d > today) d = dm[2] || dm[3] ? new Date(today.getFullYear() - 1, month, day) : new Date(today.getFullYear(), month - 1, day);
        if (d.getDate() === day && day >= 1 && day <= 31) date = toKey(d);
      }
    }
  }

  return { text: tidy(text), minutes, date };
}

/** Limpia lo que quedó: espacios dobles, conectores sueltos al final ("por", "de", "y") y la mayúscula inicial. */
function tidy(s: string): string {
  let out = s.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  for (let i = 0; i < 3; i++) out = out.replace(/(?:^|[\s,])(?:y|de|por|durante|el|la|a|en|,)\s*$/i, "").trim();
  out = out.replace(/^[,.;:\s]+|[,;:\s]+$/g, "");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}
