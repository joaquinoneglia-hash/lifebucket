import { normalize } from "./activities";
import { addDays, toKey, type DateKey } from "./dates";
import type { ReminderKind } from "./store";

/** Los tipos de recordatorio, con su color. "feriado" se calcula solo (no se carga). */
export type KindId = ReminderKind | "feriado";
export const KINDS: { id: KindId; name: string; color: string; emoji: string }[] = [
  { id: "tarea", name: "Tareas", color: "#5b6472", emoji: "✓" },
  { id: "cumple", name: "Cumpleaños", color: "#e5508a", emoji: "🎂" },
  { id: "aniversario", name: "Aniversarios", color: "#c2410c", emoji: "💞" },
  { id: "pago", name: "Pagos y vencimientos", color: "#2e9e63", emoji: "💳" },
  { id: "salud", name: "Salud", color: "#2563eb", emoji: "🩺" },
  { id: "mascota", name: "Mascotas", color: "#a16207", emoji: "🐾" },
  { id: "tramite", name: "Trámites", color: "#7c3aed", emoji: "📄" },
  { id: "feriado", name: "Feriados y fechas especiales", color: "#0891b2", emoji: "🎉" },
];
export type KindDef = { id: string; name: string; color: string; emoji: string };
/** Todos los tipos: los de siempre, los tuyos y, al final, los feriados. */
export const allKinds = (custom: KindDef[] = []): KindDef[] => [...KINDS.filter((k) => k.id !== "feriado"), ...custom, KINDS[KINDS.length - 1]];
export const kindInfo = (k?: string, custom: KindDef[] = []) => allKinds(custom).find((x) => x.id === (k ?? "tarea")) ?? KINDS[0];
/** Colores para tipos nuevos (cada tipo, uno distinto). */
export const KIND_COLORS = ["#ea580c", "#0d9488", "#db2777", "#4f46e5", "#65a30d", "#b45309", "#9333ea", "#0284c7", "#dc2626", "#475569"];
/** Cuánto antes avisar. */
export const REMIND_OPTIONS = [
  { v: 0, label: "Avisar en el momento" },
  { v: 60, label: "1 hora antes" },
  { v: 180, label: "3 horas antes" },
  { v: 1440, label: "1 día antes" },
  { v: 2880, label: "2 días antes" },
  { v: 10080, label: "1 semana antes" },
];
/** El tipo y cada cuánto se repite, de entrada. */
export const KIND_REPEAT: Partial<Record<ReminderKind, "anual" | "mensual">> = { cumple: "anual", aniversario: "anual", pago: "mensual" };

/** Adivina el tipo por las palabras ("cumple de Juan", "pagar el alquiler", "turno con el dentista"). */
export function guessKind(text: string): ReminderKind | null {
  const q = normalize(text);
  if (/\bcumple/.test(q)) return "cumple";
  if (/\baniversario|\baniv\b/.test(q)) return "aniversario";
  if (/\b(pagar|pago|vence|vencimiento|alquiler|expensas|tarjeta|factura|luz|gas|internet|monotributo|impuesto|cuota|seguro)\b/.test(q)) return "pago";
  if (/\b(turno|medic|doctor|dentista|odontolog|vacuna|analisis|chequeo|control|psicolog|kinesio|oculista|ginecolog|pediatra)/.test(q)) return "salud";
  if (/\b(perro|perra|gato|gata|veterinari|desparasit|antipulgas|mascota)/.test(q)) return "mascota";
  if (/\b(dni|pasaporte|registro|licencia|vtv|tramite|cedula|patente|afip|anses|renovar)/.test(q)) return "tramite";
  return null;
}

/** Domingo de Pascua (algoritmo de Gauss / Meeus). */
function easter(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

/** Feriados trasladables (Ley 27.399): si cae martes o miércoles, pasa al lunes anterior; jueves o viernes, al lunes siguiente. */
function movable(y: number, m: number, d: number): Date {
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  if (dow === 2) return addDays(date, -1);
  if (dow === 3) return addDays(date, -2);
  if (dow === 4) return addDays(date, 4);
  if (dow === 5) return addDays(date, 3);
  return date;
}

/** El n-ésimo domingo de un mes. */
function nthSunday(y: number, m: number, n: number): Date {
  const first = new Date(y, m - 1, 1);
  return addDays(first, ((7 - first.getDay()) % 7) + (n - 1) * 7);
}

export type Holiday = { date: DateKey; name: string; feriado: boolean };

/** Feriados nacionales de Argentina y fechas especiales del año (calculados, sin conexión). */
export function holidays(y: number): Holiday[] {
  const fx = (m: number, d: number, name: string): Holiday => ({ date: toKey(new Date(y, m - 1, d)), name, feriado: true });
  const at = (date: Date, name: string, feriado = true): Holiday => ({ date: toKey(date), name, feriado });
  const e = easter(y);
  return [
    fx(1, 1, "Año Nuevo"),
    at(addDays(e, -48), "Carnaval"),
    at(addDays(e, -47), "Carnaval"),
    fx(3, 24, "Día de la Memoria"),
    fx(4, 2, "Malvinas"),
    at(addDays(e, -3), "Jueves Santo", false),
    at(addDays(e, -2), "Viernes Santo"),
    at(e, "Pascua", false),
    fx(5, 1, "Día del Trabajador"),
    fx(5, 25, "Revolución de Mayo"),
    at(movable(y, 6, 17), "Paso a la Inmortalidad de Güemes"),
    fx(6, 20, "Día de la Bandera"),
    fx(7, 9, "Día de la Independencia"),
    at(movable(y, 8, 17), "Paso a la Inmortalidad de San Martín"),
    at(movable(y, 10, 12), "Día de la Diversidad Cultural"),
    at(movable(y, 11, 20), "Día de la Soberanía Nacional"),
    fx(12, 8, "Inmaculada Concepción"),
    fx(12, 25, "Navidad"),
    // Fechas especiales (no son feriado).
    at(new Date(y, 1, 14), "San Valentín", false),
    at(nthSunday(y, 6, 3), "Día del Padre", false),
    at(new Date(y, 6, 20), "Día del Amigo", false),
    at(nthSunday(y, 8, 3), "Día del Niño", false),
    at(new Date(y, 8, 21), "Día de la Primavera", false),
    at(nthSunday(y, 10, 3), "Día de la Madre", false),
    at(new Date(y, 11, 24), "Nochebuena", false),
    at(new Date(y, 11, 31), "Fin de año", false),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** Los feriados y fechas especiales entre dos fechas. */
export function holidaysBetween(from: DateKey, to: DateKey): Holiday[] {
  const ys = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
  return [...ys].flatMap(holidays).filter((h) => h.date >= from && h.date <= to);
}
