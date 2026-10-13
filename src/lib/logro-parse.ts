import { addDays, toKey, type DateKey } from "./dates";

/**
 * Lee lo que escribís como se habla ("salí a correr dos horas ayer", "mañana a las 10 de la noche tengo una
 * cita") con reglas, sin IA: qué día (pasado o futuro), a qué hora, cuánto dura y lo que queda es el texto
 * ("Salí a correr", "Tengo una cita"). Lo que no entiende lo deja como está.
 */
export interface ParsedLogro {
  /** El texto sin la fecha, la hora ni la duración. */
  text: string;
  minutes: number | null;
  date: DateKey | null;
  /** A qué hora empieza (minutos desde la medianoche), si se dijo: "a las 18", "de 7 a 8:30", "10 de la noche". */
  start: number | null;
  /** Si se repite: los días de la semana (0 = domingo). "todos los días", "lunes y jueves". */
  repeat: number[] | null;
  /** ¿Habla de algo que va a pasar? ("voy a…", "mañana", "el viernes que viene") */
  future: boolean;
}

const NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40,
  cuarenta_y_cinco: 45, cincuenta: 50, noventa: 90,
};
const WORD_NUMS = Object.keys(NUMBERS).filter((k) => !k.includes("_")).sort((a, b) => b.length - a.length);
const NUM = `(\\d+(?:[.,]\\d+)?|${WORD_NUMS.join("|")})`;
const toNumber = (s: string) => NUMBERS[s] ?? Number(s.replace(",", "."));

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Sin tildes y en minúsculas, con el mismo largo (así las posiciones sirven para recortar el original). */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n");
// normalize("NFD") separa la ñ en n + tilde, que se va con el reemplazo: el largo puede cambiar. Para recortar
// bien se trabaja sobre una versión de largo fijo, letra por letra.
const foldFixed = (s: string) => [...s].map((c) => fold(c)[0] ?? c).join("");

/** Partes del día: ayudan a leer la hora ("10 de la noche" = 22:00) y a ubicar algo sin hora. */
type DayPart = "madrugada" | "manana" | "mediodia" | "tarde" | "noche";

/** ¿Está en futuro? "voy a", "vamos a", "tengo que", "quiero", "hay que", verbos en futuro ("iré", "haremos"). */
const FUTURE_RE =
  /\b(?:voy|vas|va|vamos|van)\s+a\s+\p{L}+|\b(?:tengo|tenes|tiene|tenemos|tienen)\s+que\b|\bhay\s+que\b|\b(?:quiero|queremos|planeo|pienso|pensamos|me\s+toca|nos\s+toca|toca)\b|\b\p{L}{2,}(?:ré|rás|rá|remos|rán)\b/iu;
const PAST_HINT = /\b(?:ayer|anoche|anteayer|hace\s+\S+|pasad[oa])\b/;

/** La hora de un reloj, con todas las formas: "10", "10:30", "10.30", "diez y media", "8 menos cuarto", "10 pm". */
const H = `(\\d{1,2}|${["una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"].join("|")})`;
const clock = (p: string) =>
  `${H.replace("(", `(?<${p}h>`)}(?:[:.](?<${p}m>\\d{2})|\\s+y\\s+(?<${p}y>media|cuarto|\\d{1,2})|\\s+menos\\s+(?<${p}menos>cuarto|\\d{1,2}))?` +
  `(?:\\s*(?:hs|h|hrs|horas)\\b\\.?)?(?:\\s*(?<${p}ap>am|pm|a\\.\\s?m\\.?|p\\.\\s?m\\.?))?` +
  `(?:\\s+(?:de\\s+la|a\\s+la|por\\s+la|en\\s+la)\\s+(?<${p}part>manana|tarde|noche|madrugada))?`;

/** ¿Hay un verbo en pasado? ("tuve", "salí", "corrimos", "jugaron", "fui") */
const PAST_IRREGULAR = /\b(?:fui|fue|fuimos|fueron|tuve|tuvo|tuvimos|estuve|estuvo|estuvimos|hice|hizo|hicimos|pude|vi|vimos|di|dimos|puse|dije|vine|anduve|traje|hubo)\b/;
const NOT_VERBS = new Set(["que", "qué", "café", "bebé", "té", "sé", "también", "aquí", "ahí", "allí", "así", "sí", "mí", "tí", "papá", "mamá", "sofá", "menú", "maní", "jabalí", "rubí", "esquí"]);
function isPastTense(input: string): boolean {
  const t = input.toLowerCase();
  if (PAST_IRREGULAR.test(t)) return true;
  // Pretérito regular: -é / -í / -ó (salí, jugué, comió), -aste/-iste, -aron/-ieron. ("-amos" no sirve: en
  // presente es igual.)
  return (t.match(/\p{L}{2,}(?:é|í|ó|aste|iste|aron|ieron)(?=[^\p{L}]|$)/gu) ?? []).some((w) => !NOT_VERBS.has(w));
}

type Groups = Record<string, string | undefined>;

/** Arma la hora (en minutos) a partir de lo leído, usando la parte del día para saber si es a.m. o p.m. */
function toClock(g: Groups, p: string, part: DayPart | null): number | null {
  let h = toNumber(g[`${p}h`]!);
  if (!Number.isFinite(h) || h > 24) return null;
  let m = 0;
  if (g[`${p}m`]) m = Number(g[`${p}m`]);
  else if (g[`${p}y`]) m = g[`${p}y`] === "media" ? 30 : g[`${p}y`] === "cuarto" ? 15 : Number(g[`${p}y`]);
  else if (g[`${p}menos`]) {
    m = 60 - (g[`${p}menos`] === "cuarto" ? 15 : Number(g[`${p}menos`]));
    h -= 1;
  }
  if (m >= 60) return null;
  const ap = g[`${p}ap`]?.replace(/[\s.]/g, "");
  const pt = (g[`${p}part`] as DayPart | undefined) ?? part;
  if (ap === "pm" && h < 12) h += 12;
  else if (ap === "am" && h === 12) h = 0;
  else if (!ap && h <= 12) {
    if (pt === "tarde" && h < 12) h += 12;
    else if (pt === "noche") h = h === 12 ? 0 : h >= 5 ? h + 12 : h;
    else if (pt === "madrugada" && h === 12) h = 0;
    else if (!pt && h >= 1 && h <= 7) h += 12; // "a las 6" sin más: de la tarde
  }
  if (h === 24) h = 0;
  return h * 60 + m;
}

export function parseLogro(input: string, now = new Date()): ParsedLogro {
  let text = input;
  let minutes: number | null = null;
  let date: DateKey | null = null;
  let start: number | null = null;
  let part: DayPart | null = null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // El tiempo del verbo decide para dónde va un día suelto: "el sábado tengo / juego / voy" es el que viene;
  // "el sábado tuve / salí a correr" es el que pasó.
  const past = isPastTense(input) || PAST_HINT.test(fold(input));
  const future = !past && FUTURE_RE.test(input.toLowerCase());
  const ahead = !past;

  /** Saca de `text` lo que encontró la expresión. */
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(foldFixed(text));
    if (!m) return null;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return m;
  };

  // 1) Rango horario: "de 18 a 20", "desde las 10 hasta las 12 de la noche", "entre las 7 y las 8", "18-20 hs".
  const range =
    take(new RegExp(`\\b(?:de|desde)\\s+(?:las?\\s+)?${clock("a")}\\s+(?:a|hasta)\\s+(?:las?\\s+)?${clock("b")}`)) ??
    take(new RegExp(`\\bentre\\s+(?:las?\\s+)?${clock("a")}\\s+y\\s+(?:las?\\s+)?${clock("b")}`)) ??
    take(new RegExp(`\\b(?<ah>\\d{1,2})(?::(?<am>\\d{2}))?\\s*(?:-|–|a)\\s*(?<bh>\\d{1,2})(?::(?<bm>\\d{2}))?\\s*(?:hs|h)\\b`)) ??
    // "9 am a 12", "9:30 p.m. a 11"
    take(new RegExp(`\\b(?<ah>\\d{1,2})(?::(?<am>\\d{2}))?\\s*(?<aap>am|pm|a\\.\\s?m\\.?|p\\.\\s?m\\.?)\\s*(?:a|-|–|hasta)\\s*(?:las?\\s+)?(?<bh>\\d{1,2})(?::(?<bm>\\d{2}))?(?:\\s*(?<bap>am|pm|a\\.\\s?m\\.?|p\\.\\s?m\\.?))?`));
  if (range?.groups) {
    const g = range.groups;
    const endPart = (g.bpart as DayPart | undefined) ?? null;
    const e0 = toClock(g, "b", endPart);
    const end = e0 === 0 ? 24 * 60 : e0;
    let s = toClock(g, "a", (g.apart as DayPart | undefined) ?? endPart);
    // "de 10 a 2": cruza el mediodía.
    if (s !== null && end !== null && s >= end) s = toClock(g, "a", null);
    if (s !== null && end !== null && end <= s && end + 720 > s) {
      start = s;
      minutes = end + 720 - s;
    } else if (s !== null && end !== null && end > s) {
      start = s;
      minutes = end - s;
    }
  }

  // La parte del día se mira antes (para leer bien la hora: "a la noche, a las 10") y se saca después.
  const PART_RE = /\b(?:a\s+la|por\s+la|en\s+la|de\s+la|esta|toda\s+la|de)\s+(manana|tarde|noche|madrugada)\b|\b(?:al\s+)?(mediodia|medianoche)\b/;
  {
    const pk = PART_RE.exec(foldFixed(text));
    const w = pk && (pk[1] ?? pk[2]);
    if (w) part = w === "medianoche" ? "noche" : (w as DayPart);
  }

  // 2) Hora suelta: "a las 22", "a la una", "10 de la noche", "22hs", "9pm", "21:30".
  if (start === null) {
    const at =
      take(new RegExp(`\\b(?:a\\s+las?|tipo|tipo\\s+las?|como\\s+a\\s+las?|cerca\\s+de\\s+las?|para\\s+las?)\\s+${clock("a")}`)) ??
      take(new RegExp(String.raw`\b(?<ah>\d{1,2}):(?<am>\d{2})(?:\s*(?:hs|h)\b)?|\b(?<bh>\d{1,2})\s*(?<aap>am|pm)\b|\b(?<ch>1[3-9]|2[0-3])\s*hs?\b`)) ??
      take(new RegExp(`\\b(?<ah>\\d{1,2}|${["una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"].join("|")})(?:\\s+y\\s+(?<ay>media|cuarto))?\\s+de\\s+la\\s+(?<apart>manana|tarde|noche|madrugada)\\b`));
    if (at?.groups) {
      const g = { ...at.groups };
      // Las formas cortas ("9pm", "22hs") traen la hora en otro grupo.
      g.ah ??= g.bh ?? g.ch;
      start = toClock(g, "a", part);
    }
  }
  if (start !== null && (start < 0 || start >= 24 * 60)) start = null;

  // 3) Partes del día sueltas: "a la noche", "esta tarde", "al mediodía", "de madrugada".
  const partM = take(PART_RE);
  if (partM) {
    const w = partM[1] ?? partM[2];
    if (partM[0].startsWith("toda")) minutes ??= 240;
    if (w === "medianoche") {
      part = "noche";
      start ??= 0;
    } else if (w === "mediodia") {
      part = "mediodia";
      start ??= 12 * 60;
    } else part = w as DayPart;
    if (partM[0].startsWith("esta")) date = toKey(today);
  }

  // Se repite: "todos los días", "de lunes a viernes", "los fines de semana", "lunes, miércoles y viernes",
  // "cada martes". Va antes que la fecha para que "los lunes" no se lea como un lunes suelto.
  let repeat: number[] | null = null;
  const WD = "(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)";
  const daysIn = (s: string) => [...new Set([...s.matchAll(/lunes|martes|miercoles|jueves|viernes|sabado|domingo/g)].map((x) => WEEKDAYS.indexOf(x[0])))];
  let rp: RegExpExecArray | null;
  if (take(/\b(?:todos\s+los\s+dias|todas\s+las\s+(?:mananas|tardes|noches)|cada\s+dia|a\s+diario|diariamente)\b/)) repeat = [0, 1, 2, 3, 4, 5, 6];
  else if (take(/\b(?:(?:todos\s+los\s+dias\s+)?de\s+lunes\s+a\s+viernes|entre\s+semana|(?:los\s+)?dias\s+(?:de\s+semana|habiles|laborables))\b/)) repeat = [1, 2, 3, 4, 5];
  else if (take(/\b(?:de\s+lunes\s+a\s+sabados?)\b/)) repeat = [1, 2, 3, 4, 5, 6];
  else if (take(/\b(?:todos\s+los|los|cada)\s+(?:fines\s+de\s+semana|findes)\b/)) repeat = [6, 0];
  else if ((rp = take(new RegExp(`\\b(?:todos\\s+los|cada|los)\\s+${WD}(?:(?:\\s*,\\s*|\\s+y\\s+|\\s+e\\s+)(?:los\\s+)?${WD})*\\b`)) ?? take(new RegExp(`\\b${WD}(?:(?:\\s*,\\s*|\\s+y\\s+)${WD})+\\b`))))
    repeat = daysIn(rp[0]);
  if (repeat && !repeat.length) repeat = null;
  // Algo que se repite sin hora: según la parte del día ("todas las mañanas" → 8:00).
  if (repeat && start === null) {
    const pd = /\b(?:todas\s+las|a\s+la|por\s+la|de\s+la)\s+(manana|tarde|noche)s?\b/.exec(fold(input))?.[1] ?? part;
    start = pd === "manana" ? 8 * 60 : pd === "tarde" ? 16 * 60 : pd === "noche" ? 21 * 60 : null;
  }

  // 4) La fecha: pasada o futura.
  const nextDow = (target: number, fwd: boolean) => {
    const diff = fwd ? (target - today.getDay() + 7) % 7 || 7 : -((today.getDay() - target + 7) % 7 || 7);
    return toKey(addDays(today, diff));
  };
  let m: RegExpExecArray | null;
  if (take(/\bpasado\s+manana\b/)) date = toKey(addDays(today, 2));
  else if ((m = take(new RegExp(`\\bhace\\s+${NUM}\\s+(dias?|semanas?|mes(?:es)?)\\b`)))) {
    const n = toNumber(m[1]);
    date = toKey(addDays(today, -Math.round(n * (m[2].startsWith("semana") ? 7 : m[2].startsWith("mes") ? 30 : 1))));
  } else if ((m = take(new RegExp(`\\b(?:en|dentro\\s+de)\\s+${NUM}\\s+(dias?|semanas?)\\b`)))) {
    date = toKey(addDays(today, Math.round(toNumber(m[1]) * (m[2].startsWith("semana") ? 7 : 1))));
  } else if (take(/\b(?:anteayer|antes\s+de\s+ayer|antier|antes\s+ayer)\b/)) date = toKey(addDays(today, -2));
  else if (take(/\b(?:la\s+)?semana\s+pasada\b/)) date = toKey(addDays(today, -7));
  else if (take(/\b(?:la\s+)?(?:semana\s+que\s+viene|proxima\s+semana|semana\s+proxima)\b/)) date = toKey(addDays(today, 7));
  else if ((m = take(/\b(?:el\s+|este\s+|el\s+proximo\s+|este\s+proximo\s+)?(?:finde|fin\s+de\s+semana)(\s+pasado|\s+que\s+viene|\s+proximo)?\b/))) {
    const fwd = m[1] ? !/pasado/.test(m[1]) : ahead || /este|proximo/.test(m[0]);
    date = nextDow(6, fwd);
  } else if (take(/\banoche\b/)) {
    date = toKey(addDays(today, -1));
    part ??= "noche";
  } else if (take(/\bayer\b/)) date = toKey(addDays(today, -1));
  // "mañana" como día (no "a la mañana", "esta mañana", "de la mañana", que ya se sacaron arriba).
  else if (take(/(?<!\b(?:la|esta|cada|toda|una|las)\s)\bmanana\b/)) date = toKey(addDays(today, 1));
  else if (take(/\b(?:hoy|recien|hace\s+un\s+rato|ahora)\b/)) date = toKey(today);
  else if ((m = take(new RegExp(`\\b(?:el\\s+|este\\s+|el\\s+proximo\\s+|el\\s+pasado\\s+|proximo\\s+)?(${WEEKDAYS.join("|")})(\\s+pasado|\\s+que\\s+viene|\\s+proximo)?\\b`)))) {
    const target = WEEKDAYS.indexOf(m[1]);
    const explicitPast = /pasado/.test(m[0]);
    const explicitNext = /proximo|que\s+viene/.test(m[0]);
    if (!explicitPast && !explicitNext && /\beste\s/.test(m[0])) {
      // "este viernes": el de esta semana (lunes a domingo).
      const dow = (d: number) => (d + 6) % 7;
      date = toKey(addDays(today, dow(target) - dow(today.getDay())));
    } else date = nextDow(target, explicitNext || (!explicitPast && ahead));
  } else if ((m = take(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})(?:\\s+de\\s+(${MONTHS.join("|")})|\\s*/\\s*(\\d{1,2}))(?:\\s*/\\s*\\d{2,4})?\\b|\\bel\\s+(\\d{1,2})\\b(?!\\s*(?:k|km|kms|mts?|metros|%|hs|h|horas|minutos))`)))) {
    const day = Number(m[1] ?? m[4]);
    const month = m[2] ? MONTHS.indexOf(m[2]) : m[3] ? Number(m[3]) - 1 : today.getMonth();
    const explicitMonth = !!(m[2] || m[3]);
    let d = new Date(today.getFullYear(), month, day);
    // Sin año: el más cercano en la dirección que pide el verbo.
    if (ahead && d < today) d = explicitMonth ? new Date(today.getFullYear() + 1, month, day) : new Date(today.getFullYear(), month + 1, day);
    if (!ahead && d > today) d = explicitMonth ? new Date(today.getFullYear() - 1, month, day) : new Date(today.getFullYear(), month - 1, day);
    if (d.getDate() === day && day >= 1 && day <= 31) date = toKey(d);
  }

  // 5) La duración (si el rango horario no la dio).
  if (!minutes) {
    for (const d of DURATIONS) {
      const found = take(new RegExp(`(?:\\b(?:durante|por|como|unas?|unos?|casi|mas\\s+de|menos\\s+de)\\s+)?${d.re.source}`));
      if (found) {
        // Si "unas" quedó tomado como número ("unas dos horas"), el valor está más adelante.
        const sub = d.re.exec(found[0]) ?? d.re.exec(found[0].replace(/^(?:durante|por|como|unas?|unos?|casi|mas\s+de|menos\s+de)\s+/, ""));
        const value = sub ? d.minutes(sub) : null;
        if (value && value > 0 && value <= 24 * 60) minutes = value;
        break;
      }
    }
  }
  // "hasta las 12" con hora de inicio: la duración sale de ahí.
  if (start !== null && !minutes) {
    const until = take(new RegExp(`\\bhasta\\s+(?:las?\\s+)?${clock("b")}`));
    if (until?.groups) {
      const e0 = toClock(until.groups, "b", part);
      const end = e0 === 0 ? 24 * 60 : e0;
      if (end !== null) minutes = end > start ? end - start : end + 720 > start ? end + 720 - start : null;
    }
  }

  const isFuture = future || (!!date && date > toKey(today));
  return { text: tidy(text), minutes, date, start, future: isFuture, repeat };
}

/** Las duraciones, de la más larga a la más corta (la primera que encaja gana). */
const DURATIONS: { re: RegExp; minutes: (m: RegExpExecArray) => number }[] = [
  // "1h30", "1 h 30", "2hs 15"
  { re: /\b(\d+)\s*(?:h|hs|hrs?)\.?\s*(\d{1,2})\b(?!\s*(?:h|hs|hrs?|horas?)\b)/, minutes: (m) => Number(m[1]) * 60 + Number(m[2]) },
  // "dos horas y media", "una hora y cuarto", "1 hora y 20 minutos"
  {
    re: new RegExp(`\\b${NUM}\\s*(?:horas?|hs?|hrs?)\\.?\\s+y\\s+(media|cuarto|\\d+\\s*(?:minutos?|mins?|m)\\b)`),
    minutes: (m) => toNumber(m[1]) * 60 + (m[2] === "media" ? 30 : m[2] === "cuarto" ? 15 : parseInt(m[2], 10)),
  },
  { re: /\btres\s+cuartos\s+de\s+hora\b/, minutes: () => 45 },
  { re: /\bun\s+cuarto\s+de\s+hora\b/, minutes: () => 15 },
  { re: /\b(?:un\s+par\s+de|unas|varias|algunas)\s+horas\b/, minutes: () => 120 },
  { re: /\btodo\s+el\s+dia\b/, minutes: () => 480 },
  { re: /\btoda\s+la\s+(?:manana|tarde|noche)\b/, minutes: () => 240 },
  { re: /\bun\s+(?:buen\s+)?rat(?:o|ito)\b/, minutes: () => 30 },
  { re: /\bhora\s+y\s+media\b/, minutes: () => 90 },
  { re: /\bmedia\s+hora\b/, minutes: () => 30 },
  // "una hora", "2 horas", "dos hs", "1,5 h"
  { re: new RegExp(`\\b${NUM}\\s*(?:horas?|hs|hrs?|h)\\b\\.?`), minutes: (m) => Math.round(toNumber(m[1]) * 60) },
  { re: /\buna\s+hora\b/, minutes: () => 60 },
  // "45 minutos", "veinte min", "45'"
  { re: new RegExp(`\\b${NUM}\\s*(?:minutos?|mins?|m)\\b\\.?`), minutes: (m) => Math.round(toNumber(m[1])) },
  { re: /\b(\d{1,3})\s*'/, minutes: (m) => Number(m[1]) },
];

/** Limpia lo que quedó: espacios dobles, conectores sueltos en las puntas ("por", "de", "y") y la mayúscula inicial. */
function tidy(s: string): string {
  let out = s.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  for (let i = 0; i < 3; i++) {
    out = out.replace(/(?:^|[\s,])(?:y|de|por|durante|el|la|las|a|en|para|desde|hasta|,)\s*$/i, "").trim();
    out = out.replace(/^(?:y|de|el|la|las|a|en|para|,)\s+/i, "").trim();
  }
  out = out.replace(/^[,.;:\s]+|[,;:\s]+$/g, "");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}
