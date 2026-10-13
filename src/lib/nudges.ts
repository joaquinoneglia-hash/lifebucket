import { addDays, toKey } from "./dates";
import { goalAge } from "./goal-tips";
import { sleepStats } from "./sleep-stats";
import type { QuadrantId } from "./quadrants";
import { goalsFor, type PlannerState } from "./store";
import { idealOf, idealProgress } from "./balance-goals";
import { ACTIVE_PARTS, monthMinutes, weekMinutes } from "./week-shares";

const hrs = (m: number) => `${(Math.round((m / 60) * 10) / 10).toLocaleString("es-AR")} h`;

/**
 * Recomendaciones y recordatorios: todo lo que la app te sugiere ahora, de lo más importante a lo menos.
 * Los mismos avisos salen de a uno como pop-up y se juntan en la campanita.
 */
export type NudgeTarget = "semana" | "diarios" | "diario" | "metas" | "bucket";
export type NudgeIcon = "rutina" | "noneg" | "metas" | "diario" | "balde" | "sueno";
/** Un bloque de ejemplo para sumar a la rutina (se abre el editor ya cargado). */
export type NudgeDraft = { name: string; quadrant: QuadrantId; days: number[]; start: number; minutes: number };
export type Nudge = { id: string; kind: "recordatorio" | "recomendacion"; icon: NudgeIcon; title: string; body: string; cta: string; go: NudgeTarget; draft?: NudgeDraft; sleep?: boolean };

/** Un ejemplo por categoría para empezar (se puede cambiar antes de sumarlo). */
const EXAMPLE: Record<string, NudgeDraft> = {
  cuerpo: { name: "Gimnasio", quadrant: "cuerpo", days: [2, 4], start: 1140, minutes: 60 },
  interior: { name: "Meditar", quadrant: "interior", days: [1, 3, 5], start: 420, minutes: 30 },
  alma: { name: "Hobby", quadrant: "alma", days: [6], start: 600, minutes: 120 },
  mente: { name: "Curso", quadrant: "mente", days: [3], start: 1140, minutes: 60 },
  vinculos: { name: "Salida con amigos", quadrant: "vinculos", days: [5], start: 1260, minutes: 120 },
};
type Data = Pick<PlannerState, "routine" | "dailyGoals" | "goalMonths" | "dailyChecks" | "tasks" | "logros" | "sleep" | "startedAt"> & { idealHours?: PlannerState["idealHours"] };

const LABEL: Record<string, string> = { cuerpo: "Deporte", interior: "Mente y Espíritu", alma: "Hobbies", mente: "Intelecto y Cognitivo", vinculos: "Vínculos" };

export function computeNudges(s: Data, now = new Date()): Nudge[] {
  const today = toKey(now);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const goals = goalsFor(s, month);
  const metas = s.tasks.filter((x) => x.month >= month && x.month.startsWith(year));
  const monthsLeft = 12 - Number(month.slice(5)) + 1;
  const out: Nudge[] = [];

  // Recordatorios: lo que falta para que la app funcione.
  if (!s.routine.some((b) => b.quadrant === "trabajo"))
    out.push({ id: "rutina", kind: "recordatorio", icon: "rutina", title: "Terminá de configurar tu rutina", body: "Cargá tu trabajo y lo que se repite cada semana: así vas a ver cuánto tiempo libre te queda de verdad.", cta: "Sumar mi trabajo", go: "semana", draft: { name: "Trabajo", quadrant: "trabajo", days: [1, 2, 3, 4, 5], start: 540, minutes: 480 } });
  if (goals.length === 0)
    out.push({ id: "noneg", kind: "recordatorio", icon: "noneg", title: "Todavía no tenés no negociables", body: "Elegí hasta 5 hábitos simples para cumplir todos los días. El hábito hace al maestro.", cta: "Elegir mis no negociables", go: "diarios" });
  if (metas.length === 0)
    out.push({ id: "metas", kind: "recordatorio", icon: "metas", title: "¡Tus metas del año están vacías!", body: `Agregá por lo menos 3 para lo que queda del año (${monthsLeft === 1 ? "este mes" : `${monthsLeft} meses`}). Que sean cosas que de verdad te cambien.`, cta: "Sumar metas", go: "metas" });
  else if (!s.tasks.some((t) => t.month === month))
    out.push({ id: "metas-mes", kind: "recordatorio", icon: "metas", title: "Este mes no tiene metas", body: "Elegí 1 o 2 cosas importantes para este mes. Chiquitas, pero que te muevan.", cta: "Sumar una meta", go: "metas" });
  if (goals.length && now.getHours() >= 18 && !(s.dailyChecks[today] ?? []).length)
    out.push({ id: "hoy", kind: "recordatorio", icon: "noneg", title: "Tildá tus no negociables de hoy", body: "Un minuto: marcá los que cumpliste. Lo que no, mañana es otra oportunidad.", cta: "Tildar los de hoy", go: "diarios" });
  if (!s.logros.some((l) => l.date >= toKey(addDays(now, -3))))
    out.push({ id: "diario", kind: "recordatorio", icon: "diario", title: "¿Qué hiciste estos días?", body: "Hace unos días que no anotás nada en tu diario. Contá algo que hayas disfrutado o logrado: suma a tu balde.", cta: "Escribir en mi diario", go: "diario" });

  // Recomendaciones: para llenar mejor tu balde.
  const stuck = s.tasks.filter((t) => goalAge(t, today).stuck);
  if (stuck.length)
    out.push({ id: "trabadas", kind: "recomendacion", icon: "metas", title: `«${stuck[0].title}» se viene postergando`, body: "Probá partirla en un primer paso más chico y ponerle fecha esta semana.", cta: "Ver mis metas", go: "metas" });
  // Tu balance de la semana contra tu balde ideal: lo que viene más atrasado según el día de la semana.
  if (s.routine.length) {
    const wk = weekMinutes(s.routine, s.logros, s.sleep);
    const prog = idealProgress(wk, idealOf(s.idealHours));
    const dayIdx = (now.getDay() + 6) % 7; // lunes = 0
    const expected = Math.round(((dayIdx + 1) / 7) * 100);
    const behind = [...prog.rows].filter((r) => r.pct < expected - 15).sort((a, b) => a.pct - b.pct)[0];
    if (behind && dayIdx >= 1) {
      const p = behind.p;
      const left = Math.max(0, Math.round(((behind.goal - behind.minutes) / 60) * 10) / 10);
      const msg: Record<string, [string, string]> = {
        cuerpo: ["¿Movemos el cuerpo esta semana?", `Llevás ${hrs(behind.minutes)} de deporte y la meta es ${hrs(behind.goal)} (la OMS recomienda 150 a 300 min por semana).`],
        interior: ["Un rato para tu mente y tu espíritu", `Con 15 minutos por día ya se nota. Esta semana llevás ${hrs(behind.minutes)} de ${hrs(behind.goal)}.`],
        alma: ["¿Y si te das un gusto?", `Tus hobbies llevan ${hrs(behind.minutes)} de ${hrs(behind.goal)} esta semana. Hacer algo por puro gusto te recarga.`],
        mente: ["Aprendé algo nuevo esta semana", `Intelecto y Cognitivo lleva ${hrs(behind.minutes)} de ${hrs(behind.goal)}. Media hora de lectura o un curso cuentan.`],
        vinculos: ["¿No te gustaría ver a los tuyos?", `Esta semana llevás ${hrs(behind.minutes)} con tus vínculos. Lo recomendado es verlos unas 2 veces por semana.`],
      };
      out.push({
        id: `balance-${p}`,
        kind: "recomendacion",
        icon: "balde",
        title: msg[p][0],
        body: `${msg[p][1]} Te faltan ${left.toLocaleString("es-AR")} h.`,
        cta: p === "vinculos" ? "Sumar un encuentro fijo" : "Sumarlo a mi rutina",
        go: "semana",
        draft: EXAMPLE[p],
      });
    }
    const { minutes } = monthMinutes(s.routine, s.logros, s.sleep, month, s.startedAt, today);
    const missing = ACTIVE_PARTS.filter((p) => minutes[p] === 0);
    if (missing.length)
      out.push({ id: `falta-${missing[0]}`, kind: "recomendacion", icon: "balde", title: `A tu balde le falta ${LABEL[missing[0]]}`, body: `Este mes no le diste tiempo a ${LABEL[missing[0]]}. ¿Le hacés un lugar fijo en tu rutina, aunque sea una hora por semana?`, cta: missing[0] === "vinculos" ? "Anotarlo en mi diario" : "Sumarlo a mi rutina", go: missing[0] === "vinculos" ? "diario" : "semana", draft: missing[0] === "vinculos" ? undefined : EXAMPLE[missing[0]] });
  }
  const sl = sleepStats(s.sleep);
  if (sl.status === "poco")
    out.push({ id: "sueno", kind: "recomendacion", icon: "sueno", title: "Estás durmiendo poco", body: `Con tu horario dormís ${Math.round(sl.perNight * 10) / 10} h por noche. Lo recomendado es entre 7 y 9.`, cta: "Revisar mi sueño", go: "semana", sleep: true });
  return out;
}
