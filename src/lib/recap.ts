import { rangeStats } from "./daily-goals";
import { addDays, fromKey, startOfWeek, toKey, type DateKey } from "./dates";
import { QUADRANT_BY_ID } from "./quadrants";
import { sleepStats } from "./sleep-stats";
import { goalsFor, type Logro, type PlannerState, type YearTask } from "./store";
import { ACTIVE_PARTS, bucketTotal, fill, monthMinutes, weekMinutes, WEEK_MINUTES, type Part } from "./week-shares";

/**
 * "Cómo viene tu balde": junta el balde, los logros diarios, las cosas que hiciste, las metas y el sueño de
 * un período y lo cuenta en capítulos cortos (texto armado con reglas, sin IA, que también se puede
 * escuchar). Tres miradas: tu semana, tu mes y la proyección de tu año (cómo terminaría si seguís igual).
 */
export type Range = "semana" | "mes" | "anio";
type Data = Pick<PlannerState, "routine" | "logros" | "sleep" | "dailyGoals" | "goalMonths" | "dailyChecks" | "tasks" | "startedAt" | "routineHistory">;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });
const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
const num = (n: number) => Math.round(n).toLocaleString("es-AR");
const hrs = (m: number) => {
  const h = m >= 6000 ? Math.round(m / 60) : Math.round((m / 60) * 10) / 10;
  return `${h.toLocaleString("es-AR")} ${h === 1 ? "hora" : "horas"}`;
};
export const partName = (p: Part) => (p === "sueno" ? "Sueño" : p === "alma" ? "Hobbies" : QUADRANT_BY_ID[p].name);
const daysBetween = (a: DateKey, b: DateKey) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000) + 1;

/** Cómo vienen las metas de unos meses: propuestas, cumplidas, no cumplidas (ya pasó su mes), postergadas y en camino. */
export function taskStats(tasks: YearTask[], months: string[], thisMonth: string) {
  const inP = (m: string) => months.includes(m);
  const proposed = tasks.filter((t) => inP(t.month) || (t.history ?? []).some(inP));
  const done = proposed.filter((t) => t.done && inP(t.month));
  const postponed = proposed.filter((t) => (t.history ?? []).some(inP) && !inP(t.month));
  const notDone = proposed.filter((t) => !t.done && inP(t.month) && t.month < thisMonth);
  const pending = proposed.filter((t) => !t.done && inP(t.month) && t.month >= thisMonth);
  return { proposed, done, postponed, notDone, pending };
}

export function buildRecap(d: Data, range: Range, now = new Date()) {
  const today = toKey(now);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const monday = toKey(startOfWeek(now));
  const sleep = sleepStats(d.sleep);
  const dailyGoals = goalsFor(d, month);

  // El período y los minutos de cada parte.
  let start: DateKey;
  let end: DateKey;
  let minutes: Record<Part, number>;
  let total: number;
  let elapsedEnd: DateKey = today;
  if (range === "semana") {
    start = d.startedAt && d.startedAt > monday ? d.startedAt : monday;
    end = toKey(addDays(fromKey(monday), 6));
    minutes = weekMinutes(d.routine, d.logros, d.sleep, monday);
    total = WEEK_MINUTES;
  } else if (range === "mes") {
    const m = monthMinutes(d.routine, d.logros, d.sleep, month, d.startedAt, today);
    ({ start, end, minutes, total } = m);
  } else {
    // La proyección: desde que empezaste (o el 1 de enero) hasta fin de año, con tu rutina y el ritmo de lo que
    // venís anotando.
    const first = `${year}-01-01` as DateKey;
    start = d.startedAt && d.startedAt > first ? d.startedAt : first;
    end = `${year}-12-31` as DateKey;
    const days = daysBetween(start, end);
    const elapsed = Math.max(1, daysBetween(start, today));
    const scale = days / elapsed;
    const so = d.logros.filter((l) => l.date >= start && l.date <= today).map((l): Logro => ({ ...l, minutes: l.minutes * scale }));
    total = days * 24 * 60;
    minutes = fill(d.routine, so, sleep.weekHours * 60 * (days / 7), total, days / 7);
    elapsedEnd = today;
  }
  // El balde se reparte entre sueño, trabajo y lo tuyo (lo "libre" no cuenta).
  total = bucketTotal(minutes);
  const pct = (m: number) => Math.round((m / total) * 100);
  const title = range === "semana" ? "Cómo fue tu semana" : range === "mes" ? `Cómo fue tu ${MONTHS[now.getMonth()]}` : `Cómo viene tu ${year}`;
  const period = range === "anio" ? `Del ${fmt.format(fromKey(start))} al 31 de diciembre, si seguís igual` : `Del ${fmt.format(fromKey(start))} al ${fmt.format(fromKey(end))}`;
  const until = range === "semana" ? "esta semana" : range === "mes" ? "este mes" : "hasta fin de año";

  // El balde.
  const mine = ACTIVE_PARTS.reduce((acc, p) => acc + minutes[p], 0);
  const ranked = [...ACTIVE_PARTS].sort((a, b) => minutes[b] - minutes[a]);
  const top = ranked.filter((p) => minutes[p] > 0);
  const missing = ACTIVE_PARTS.filter((p) => minutes[p] === 0);
  let bucketText =
    range === "anio"
      ? `Si seguís con los mismos hábitos, de acá a fin de año vas a dormir ${hrs(minutes.sueno)} (${num(minutes.sueno / 1440)} días enteros) y trabajar ${hrs(minutes.trabajo)}. A lo que te hace bien le vas a dar ${hrs(mine)}: el ${pct(mine)}% de tu tiempo. `
      : `Le dedicaste ${hrs(mine)} a lo que te hace bien: el ${pct(mine)}% de tu tiempo. `;
  if (top.length) bucketText += `${range === "anio" ? "Lo que más va a crecer" : "Lo que más creció"} es ${partName(top[0])} (${hrs(minutes[top[0]])})${top[1] ? `, seguido de ${partName(top[1])}` : ""}. `;
  if (range !== "anio") bucketText += `El trabajo se llevó el ${pct(minutes.trabajo)}% y dormiste el ${pct(minutes.sueno)}%. `;
  if (missing.length) bucketText += `${range === "anio" ? "Van a quedar en cero" : "Quedó sin tiempo"}: ${missing.map(partName).join(", ")}.`;
  const prev = d.routineHistory.find((h) => h.date === toKey(addDays(fromKey(monday), -7)))?.shares;
  if (range === "semana" && prev) {
    const diff = pct(mine) - ACTIVE_PARTS.reduce((acc, p) => acc + (prev[p] ?? 0), 0);
    if (diff !== 0) bucketText += ` Frente a la semana pasada, ${diff > 0 ? "sumaste" : "perdiste"} ${Math.abs(diff)} puntos de tiempo para mí.`;
  }

  // Logros diarios (en la proyección: lo que va del año).
  const days: DateKey[] = [];
  for (let k = fromKey(start); toKey(k) <= (range === "anio" ? elapsedEnd : end); k = addDays(k, 1)) days.push(toKey(k));
  const goals = rangeStats(dailyGoals, d.dailyChecks, days, today, d.startedAt);
  const bestGoal = [...goals.perGoal].sort((a, b) => b.pct - a.pct)[0];
  const worstGoal = [...goals.perGoal].sort((a, b) => a.pct - b.pct)[0];
  const scored = goals.perDay.filter((x) => x.score !== null) as { date: DateKey; score: number }[];
  const bestDay = [...scored].sort((a, b) => b.score - a.score)[0];
  const fullDays = scored.filter((x) => dailyGoals.length && x.score === dailyGoals.length).length;
  let goalsText = "";
  if (!dailyGoals.length) goalsText = "Todavía no elegiste tus no negociables. Elegí hasta cinco cosas para cumplir todos los días y acá vas a ver cómo te va.";
  else if (!goals.days) goalsText = "Este período recién empieza: tildá tus no negociables y acá vas a ver cómo te va.";
  else {
    goalsText = `Cumpliste el ${goals.pct}% de tus no negociables (${goals.done} de ${goals.possible} tildes)${range === "anio" ? " en lo que va del año" : ""}. `;
    if (fullDays) goalsText += `Tuviste ${fullDays} ${fullDays === 1 ? "día perfecto" : "días perfectos"}, con todo tildado. `;
    else if (bestDay && bestDay.score > 0) goalsText += `Tu mejor día fue el ${weekday.format(fromKey(bestDay.date))} ${Number(bestDay.date.slice(8))}, con ${bestDay.score} de ${dailyGoals.length}. `;
    if (bestGoal && bestGoal.done > 0) goalsText += `Lo más constante: ${bestGoal.goal.name} (${bestGoal.pct}%). `;
    if (worstGoal && worstGoal !== bestGoal && worstGoal.pct < 50) goalsText += `Lo que más te costó: ${worstGoal.goal.name} (${worstGoal.pct}%).`;
  }

  // Cosas que hiciste.
  const entries = d.logros.filter((l) => l.date >= start && l.date <= (range === "anio" ? today : end)).sort((a, b) => a.date.localeCompare(b.date));
  const counted = entries.filter((l) => l.category && l.minutes > 0);
  let diaryText = "";
  if (!entries.length) diaryText = "No anotaste cosas que hiciste. Al final de cada día, contá qué querés destacar: algo que lograste, que disfrutaste o que aprendiste.";
  else {
    diaryText = `Anotaste ${entries.length} ${entries.length === 1 ? "cosa" : "cosas"} que hiciste. Algunas: ${entries
      .slice(-3)
      .map((l) => `«${l.text}»`)
      .join(", ")}. `;
    if (counted.length) diaryText += `Entre todas sumaron ${hrs(counted.reduce((acc, l) => acc + l.minutes, 0))} a tu balde.`;
  }

  // Metas: propuestas, cumplidas, no cumplidas y postergadas.
  const months = range === "anio" ? Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`) : [...new Set(days.map((x) => x.slice(0, 7)))];
  const ts = taskStats(d.tasks, months, month);
  const yearTasks = d.tasks.filter((t) => t.month.startsWith(year));
  let tasksText = "";
  const scope = range === "anio" ? `este año` : `en ${MONTHS[Number(month.slice(5)) - 1]}`;
  if (!ts.proposed.length) tasksText = range === "anio" ? "No cargaste metas para este año. Pensá en dos o tres cosas grandes que quieras lograr y ponelas en su mes." : `No tenías metas ${scope}.`;
  else {
    tasksText = `Te propusiste ${ts.proposed.length} ${ts.proposed.length === 1 ? "meta" : "metas"} ${scope}: cumpliste ${ts.done.length}`;
    if (ts.notDone.length) tasksText += `, no cumpliste ${ts.notDone.length}`;
    if (ts.postponed.length) tasksText += ` y postergaste ${ts.postponed.length}`;
    tasksText += ". ";
    if (ts.pending.length) tasksText += `Todavía en camino: ${ts.pending.map((t) => t.title).join(", ")}. `;
    const repeat = ts.proposed.filter((t) => (t.history?.length ?? 0) >= 2);
    if (repeat.length) tasksText += `Ojo: ${repeat.map((t) => `«${t.title}»`).join(", ")} ya se postergó más de una vez.`;
  }

  // Sueño y cierre (en la proyección: recomendaciones).
  const perNight = Math.round(sleep.perNight * 10) / 10;
  const sleepText = `Con tu horario dormís ${perNight.toLocaleString("es-AR")} horas por noche${sleep.status === "ok" ? ", dentro de lo recomendado" : sleep.status === "poco" ? ": un poco menos de lo recomendado (7 a 9 horas)" : ": más de lo recomendado"}.`;
  const weeksLeft = Math.max(1, Math.round(daysBetween(today, `${year}-12-31` as DateKey) / 7));
  const tips: string[] = [];
  for (const p of missing.slice(0, 2)) tips.push(`Sumá 1 hora de ${partName(p)} dos veces por semana: son ${num(weeksLeft * 2)} horas más antes de fin de año.`);
  if (pct(mine) < 15) tips.push(`Con 30 minutos por día para vos, de acá a fin de año sumás ${num(weeksLeft * 3.5)} horas.`);
  if (pct(minutes.trabajo) > 30) tips.push(`El trabajo se lleva el ${pct(minutes.trabajo)}% de tu tiempo: cortar media hora antes cada día te devuelve ${num(weeksLeft * 2.5)} horas.`);
  if (sleep.status === "poco") tips.push(`Dormir media hora más por noche son ${num(weeksLeft * 3.5)} horas de descanso de acá a fin de año.`);
  if (ts.postponed.length) tips.push(`Elegí una sola de tus metas postergadas y ponele fecha este mes.`);
  if (!tips.length) tips.push("Vas muy bien: elegí una cosa nueva que quieras aprender y dale un lugar fijo en tu rutina.");
  const closing =
    range === "anio"
      ? `Recomendaciones: ${tips.slice(0, 3).join(" ")}`
      : `${sleepText} ${pct(mine) >= 20 ? "Buen equilibrio: seguí cuidando ese espacio para vos." : "Tu balde todavía tiene lugar: elegí una cosa que te haga bien y dale un horario fijo."}`;

  const intro =
    range === "anio"
      ? `${period}. Si repetís lo que venís haciendo, así va a quedar repartido tu año: ${hrs(minutes.sueno)} durmiendo, ${hrs(minutes.trabajo)} trabajando y ${hrs(mine)} para lo que te hace bien.`
      : `${period}. ${top.length ? `Lo tuyo se llevó ${hrs(mine)}` : "Todavía no hay tiempo para mí cargado"}${dailyGoals.length && goals.days ? `, cumpliste el ${goals.pct}% de tus no negociables` : ""}${entries.length ? ` y anotaste ${entries.length} ${entries.length === 1 ? "cosa que hiciste" : "cosas que hiciste"}` : ""}.`;

  return {
    range,
    title,
    period,
    until,
    stats: { mine, minePct: pct(mine), goalsPct: dailyGoals.length ? goals.pct : null, entries: entries.length },
    minutes,
    total,
    goals,
    goalCount: dailyGoals.length,
    entries,
    tasks: { ...ts, year: yearTasks },
    tips: tips.slice(0, 3),
    sleep: perNight,
    chapters: [
      { id: "portada", title, text: intro },
      { id: "balde", title: range === "anio" ? "Tu año en horas" : "Tu balde", text: bucketText.trim() },
      { id: "diarios", title: "Tus no negociables", text: goalsText.trim() },
      { id: "diario", title: "Cosas que hiciste", text: diaryText.trim() },
      { id: "metas", title: "Tus metas", text: tasksText.trim() },
      { id: "cierre", title: range === "anio" ? "Qué podés cambiar" : "Para cerrar", text: closing },
    ] as const,
  };
}

export type Recap = ReturnType<typeof buildRecap>;
