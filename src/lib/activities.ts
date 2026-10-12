import type { QuadrantRecord } from "./quadrants";

/** Sugerencias para el arranque. Las primeras tres vienen preseleccionadas. */
export const SUGGESTED_ACTIVITIES: QuadrantRecord<string[]> = {
  cuerpo: ["Gimnasio", "Correr", "Bici", "Fútbol", "Natación", "Caminar", "Yoga"],
  interior: ["Meditar", "Terapia", "Respirar", "Escribir un diario", "Rezar"],
  mente: ["Idiomas", "Estudiar", "Curso online", "Leer", "Programar", "Investigar"],
  alma: ["Producir música", "Ajedrez", "Guitarra", "Dibujar", "Fotografía", "Cocinar", "Videojuegos"],
  vinculos: ["Pareja", "Amigos", "Familia", "Llamar a alguien", "Salida", "Asado", "Juegos de mesa"],
  trabajo: ["Trabajo profundo", "Reuniones", "Mails", "Proyecto", "Planificación", "Capacitación"],
  libre: ["Almuerzo", "Descanso", "Cena", "Traslados", "Siesta", "Casa", "Series", "Trámites"],
};

export const PRESELECTED_COUNT = 3;

export const DURATIONS = [30, 60, 120, 180, 240, 360, 480, 540] as const;

/** Minúsculas y sin acentos, para buscar "medit" y encontrar "Meditar" o "musica" y encontrar "Música". */
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Ordena por relevancia: primero las que empiezan con el texto, después las que tienen una palabra que empieza así, después el resto. */
export function searchActivities<T extends { name: string }>(items: T[], query: string): T[] {
  const q = normalize(query);
  if (!q) return items;
  const rank = (name: string) => {
    const n = normalize(name);
    if (n.startsWith(q)) return 0;
    if (n.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (n.includes(q)) return 2;
    return -1;
  };
  return items
    .map((item) => ({ item, r: rank(item.name) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.item);
}
