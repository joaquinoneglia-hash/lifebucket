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
export const allKinds = (custom: KindDef[] = []): KindDef[] => {
  const over = (k: KindDef) => custom.find((c) => c.id === k.id) ?? k;
  const builtIn = new Set(KINDS.map((k) => k.id as string));
  return [...KINDS.filter((k) => k.id !== "feriado").map(over), ...custom.filter((c) => !builtIn.has(c.id)), over(KINDS[KINDS.length - 1])];
};
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

/** Los países con feriados propios (el resto usa solo las fechas universales). */
export const COUNTRIES = [
  { id: "AR", name: "Argentina", flag: "🇦🇷" },
  { id: "UY", name: "Uruguay", flag: "🇺🇾" },
  { id: "CL", name: "Chile", flag: "🇨🇱" },
  { id: "PY", name: "Paraguay", flag: "🇵🇾" },
  { id: "MX", name: "México", flag: "🇲🇽" },
  { id: "CO", name: "Colombia", flag: "🇨🇴" },
  { id: "PE", name: "Perú", flag: "🇵🇪" },
  { id: "ES", name: "España", flag: "🇪🇸" },
  { id: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { id: "XX", name: "Otro país", flag: "🌎" },
] as const;

/** El n-ésimo día de la semana (0 domingo … 6 sábado) de un mes; n = -1 es el último. */
function nth(y: number, m: number, wd: number, n: number): Date {
  if (n < 0) {
    const last = new Date(y, m, 0);
    return addDays(last, -((last.getDay() - wd + 7) % 7));
  }
  const first = new Date(y, m - 1, 1);
  return addDays(first, ((wd - first.getDay() + 7) % 7) + (n - 1) * 7);
}

/** Feriados nacionales y fechas especiales del año según el país (calculados, sin conexión). */
export function holidays(y: number, country = "AR"): Holiday[] {
  if (country !== "AR") return otherHolidays(y, country);
  return argentina(y);
}

function otherHolidays(y: number, country: string): Holiday[] {
  const fx = (m: number, d: number, name: string, feriado = true): Holiday => ({ date: toKey(new Date(y, m - 1, d)), name, feriado });
  const at = (date: Date, name: string, feriado = true): Holiday => ({ date: toKey(date), name, feriado });
  const e = easter(y);
  const santos = [at(addDays(e, -3), "Jueves Santo"), at(addDays(e, -2), "Viernes Santo"), at(e, "Pascua", false)];
  const base = [fx(1, 1, "Año Nuevo"), fx(5, 1, "Día del Trabajador"), fx(12, 25, "Navidad"), fx(2, 14, "San Valentín", false), fx(12, 24, "Nochebuena", false), fx(12, 31, "Fin de año", false)];
  const madre2 = at(nth(y, 5, 0, 2), "Día de la Madre", false);
  const padre3 = at(nth(y, 6, 0, 3), "Día del Padre", false);
  const byCountry: Record<string, Holiday[]> = {
    UY: [at(addDays(e, -48), "Carnaval"), at(addDays(e, -47), "Carnaval"), at(addDays(e, -3), "Semana de Turismo"), at(addDays(e, -2), "Semana de Turismo"), fx(4, 19, "Desembarco de los 33 Orientales"), fx(5, 18, "Batalla de Las Piedras"), fx(6, 19, "Natalicio de Artigas"), fx(7, 18, "Jura de la Constitución"), fx(8, 25, "Declaratoria de la Independencia"), fx(10, 12, "Día de la Diversidad Cultural"), fx(11, 2, "Día de los Difuntos"), madre2, padre3],
    CL: [at(addDays(e, -2), "Viernes Santo"), at(addDays(e, -1), "Sábado Santo"), fx(5, 21, "Glorias Navales"), fx(6, 29, "San Pedro y San Pablo"), fx(7, 16, "Virgen del Carmen"), fx(8, 15, "Asunción de la Virgen"), fx(9, 18, "Fiestas Patrias"), fx(9, 19, "Glorias del Ejército"), fx(10, 12, "Encuentro de Dos Mundos"), fx(10, 31, "Iglesias Evangélicas"), fx(11, 1, "Todos los Santos"), fx(12, 8, "Inmaculada Concepción"), madre2, padre3],
    PY: [fx(3, 1, "Día de los Héroes"), ...santos, fx(5, 14, "Independencia"), fx(5, 15, "Independencia"), fx(6, 12, "Paz del Chaco"), fx(8, 15, "Fundación de Asunción"), fx(9, 29, "Victoria de Boquerón"), fx(12, 8, "Virgen de Caacupé"), fx(5, 15, "Día de la Madre", false), padre3],
    MX: [at(nth(y, 2, 1, 1), "Día de la Constitución"), at(nth(y, 3, 1, 3), "Natalicio de Benito Juárez"), ...santos.map((h) => ({ ...h, feriado: false })), fx(9, 16, "Día de la Independencia"), at(nth(y, 11, 1, 3), "Día de la Revolución"), fx(11, 2, "Día de Muertos", false), fx(12, 12, "Virgen de Guadalupe", false), fx(5, 10, "Día de la Madre", false), padre3],
    CO: [...santos, fx(7, 20, "Día de la Independencia"), fx(8, 7, "Batalla de Boyacá"), fx(12, 8, "Inmaculada Concepción"), madre2, padre3],
    PE: [...santos, fx(6, 29, "San Pedro y San Pablo"), fx(7, 28, "Fiestas Patrias"), fx(7, 29, "Fiestas Patrias"), fx(8, 30, "Santa Rosa de Lima"), fx(10, 8, "Combate de Angamos"), fx(11, 1, "Todos los Santos"), fx(12, 8, "Inmaculada Concepción"), fx(12, 9, "Batalla de Ayacucho"), madre2, padre3],
    ES: [fx(1, 6, "Reyes"), at(addDays(e, -2), "Viernes Santo"), at(e, "Pascua", false), fx(8, 15, "Asunción de la Virgen"), fx(10, 12, "Fiesta Nacional"), fx(11, 1, "Todos los Santos"), fx(12, 6, "Día de la Constitución"), fx(12, 8, "Inmaculada Concepción"), at(nth(y, 5, 0, 1), "Día de la Madre", false), fx(3, 19, "Día del Padre", false)],
    US: [at(nth(y, 1, 1, 3), "Martin Luther King Jr."), at(nth(y, 2, 1, 3), "Presidents Day"), at(nth(y, 5, 1, -1), "Memorial Day"), fx(6, 19, "Juneteenth"), fx(7, 4, "Independence Day"), at(nth(y, 9, 1, 1), "Labor Day"), at(nth(y, 10, 1, 2), "Columbus Day"), fx(11, 11, "Veterans Day"), at(nth(y, 11, 4, 4), "Thanksgiving"), madre2, padre3],
  };
  const list = country === "US" ? base.filter((h) => h.name !== "Día del Trabajador") : base;
  return [...list, ...(byCountry[country] ?? [])].sort((a, b) => a.date.localeCompare(b.date));
}

/** Feriados nacionales de Argentina y fechas especiales del año. */
function argentina(y: number): Holiday[] {
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
export function holidaysBetween(from: DateKey, to: DateKey, country = "AR"): Holiday[] {
  const ys = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
  return [...ys].flatMap((y) => holidays(y, country)).filter((h) => h.date >= from && h.date <= to);
}
