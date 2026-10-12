import { normalize } from "./activities";
import type { QuadrantId } from "./quadrants";

/**
 * Palabras que delatan la categoría de una actividad. Se buscan como comienzo de palabra
 * ("gim" encuentra "gimnasio"; "leer" encuentra "leer un rato").
 */
const WORDS: Record<"trabajo" | "cuerpo" | "mente" | "alma" | "libre", string[]> = {
  trabajo: ["trabaj", "laburo", "oficina", "reunion", "meeting", "mails", "mail", "proyecto", "cliente", "empleo", "emprend", "freelance", "negocio", "facturar", "ventas", "call", "planificacion", "capacitacion", "turno", "guardia", "consultorio", "local"],
  cuerpo: ["gim", "gym", "correr", "running", "caminar", "caminata", "yoga", "pilates", "futbol", "padel", "tenis", "natacion", "nadar", "bici", "ciclismo", "crossfit", "entren", "box", "funcional", "spinning", "estirar", "elongar", "deporte", "rugby", "hockey", "basquet", "voley", "escalar", "danza", "baile", "kine", "medico", "salud"],
  mente: ["leer", "lectura", "libro", "estudi", "curso", "facu", "clase", "idioma", "ingles", "aleman", "frances", "italiano", "portugues", "meditar", "meditacion", "escribir", "journal", "diario", "podcast", "aprender", "investig", "terapia", "psico", "ajedrez", "programar", "tesis", "examen"],
  alma: ["musica", "guitarra", "piano", "cantar", "serie", "netflix", "pelicula", "cine", "juego", "videojuego", "play", "dibuj", "pintar", "foto", "salir", "bar", "recital", "fiesta", "boliche", "teatro", "museo", "hobby", "jardin", "plantas", "manualidad", "cocinar", "paseo", "pasear", "viaje", "concierto"],
  libre: ["almuerzo", "almorzar", "desayuno", "desayunar", "cena", "cenar", "merienda", "comer", "comida", "descanso", "descansar", "siesta", "traslado", "viaje al", "colectivo", "subte", "tren", "auto", "manejar", "ducha", "bano", "casa", "limpi", "lavar", "compras", "super", "tramite", "banco", "nada", "libre", "relax", "dormir"],
};

/**
 * Adivina la categoría de lo que escribiste. Primero mira tus propios bloques (si ya tenés "Brandtag"
 * en Trabajo, "brandtag" va a Trabajo); después, palabras conocidas. Si no reconoce nada, devuelve null.
 */
export function guessQuadrant(text: string, known: { name: string; quadrant: QuadrantId }[] = []): QuadrantId | null {
  const q = normalize(text);
  if (q.length < 2) return null;

  // Lo que ya cargaste antes: coincidencia exacta o que empiece igual.
  const mine = known.find((k) => normalize(k.name) === q) ?? known.find((k) => q.length >= 3 && normalize(k.name).startsWith(q));
  if (mine) return mine.quadrant === "vinculos" ? "alma" : mine.quadrant;

  const words = q.split(/[^a-z0-9ñ]+/).filter(Boolean);
  let best: { id: QuadrantId; score: number } | null = null;
  for (const [id, list] of Object.entries(WORDS) as [QuadrantId, string[]][]) {
    let score = 0;
    for (const key of list) {
      if (key.includes(" ")) {
        if (q.includes(key)) score += 2;
      } else if (words.some((w) => w.startsWith(key) || (w.length >= 3 && key.startsWith(w)))) {
        // Palabra completa o empezada (mientras escribís "gimn…").
        score += words.some((w) => w.startsWith(key)) ? 2 : 1;
      }
    }
    if (score && (!best || score > best.score)) best = { id, score };
  }
  return best?.id ?? null;
}
