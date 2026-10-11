const NBSP = " ";

/** "30 min", "1 h", "1 h 30" (con espacios que no cortan línea). */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}${NBSP}min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h}${NBSP}h${NBSP}${rest}` : `${h}${NBSP}h`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
