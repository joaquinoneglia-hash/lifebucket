/** Fecha local en formato YYYY-MM-DD. */
export type DateKey = string;

export function toKey(d: Date): DateKey {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunes de la semana de `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function weekKeys(start: Date): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(start, i)));
}

const stripDots = (s: string) => s.replace(/\./g, "");
const weekdayShortFmt = new Intl.DateTimeFormat("es-AR", { weekday: "short" });
const weekdayLongFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
const monthShortFmt = new Intl.DateTimeFormat("es-AR", { month: "short" });

export function weekdayShort(key: DateKey): string {
  return stripDots(weekdayShortFmt.format(fromKey(key)));
}

/** "martes 14" */
export function dayLabel(key: DateKey): string {
  const d = fromKey(key);
  return `${weekdayLongFmt.format(d)} ${d.getDate()}`;
}

/** "6 – 12 oct" o "29 sep – 5 oct" */
export function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const sm = stripDots(monthShortFmt.format(start));
  const em = stripDots(monthShortFmt.format(end));
  return sm === em
    ? `${start.getDate()} – ${end.getDate()} ${em}`
    : `${start.getDate()} ${sm} – ${end.getDate()} ${em}`;
}

/** El número de semana del año (ISO: la semana 1 es la que tiene el primer jueves). */
export function weekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
