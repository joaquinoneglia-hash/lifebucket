import { normalize } from "./activities";
import { fromKey, toKey } from "./dates";
import type { YearTask } from "./store";

/**
 * Tips al cargar una meta importante: si parece una tarea simple ("ir al súper"), un hábito ("todos los
 * días…") o algo de la rutina, se avisa con cariño. Las metas son lo que te cambia como persona.
 */
export function goalTip(text: string): string | null {
  const q = normalize(text);
  if (q.length < 4) return null;
  if (/\b(todos los dias|cada dia|diario|diariamente|por dia|a diario|cada manana|cada noche)\b/.test(q))
    return "Esto parece un hábito diario: sumalo a tus no negociables y dejá las metas para cambios grandes.";
  if (/\b(\d+|dos|tres|cuatro) (veces|dias) (por|a la) semana\b|\bcada semana\b|\btodas las semanas\b|\blos (lunes|martes|miercoles|jueves|viernes|sabados|domingos)\b/.test(q))
    return "Esto parece algo de tu rutina semanal: ponelo como bloque en tu semana.";
  if (/\b(ir al super|super|supermercado|comprar|pagar|lavar|limpiar|ordenar|sacar turno|llamar al|mandar mail|responder|tramite|hacer las compras|cocinar)\b/.test(q) && q.split(" ").length <= 5)
    return "Parece una tarea simple. Una meta importante es algo que te cambie: «volver a entrenar», «hacer mi primer viaje sola».";
  return null;
}

/** El seguimiento de una meta: cuánto lleva abierta y cuántas veces se postergó. */
export function goalAge(t: YearTask, today = toKey(new Date())) {
  const created = t.createdAt ?? null;
  const days = created ? Math.max(0, Math.round((fromKey(today).getTime() - fromKey(created).getTime()) / 86400000)) : null;
  const moved = t.history?.length ?? 0;
  return { days, moved, stuck: !t.done && (moved >= 2 || (days !== null && days >= 60)) };
}
