import { normalize } from "./activities";
import type { QuadrantId } from "./quadrants";

/**
 * Palabras que delatan la categoría de una actividad. Se buscan como comienzo de palabra
 * ("gim" encuentra "gimnasio"; "leer" encuentra "leer un rato").
 */
const WORDS: Record<"trabajo" | "cuerpo" | "interior" | "alma" | "mente" | "vinculos" | "libre", string[]> = {
  trabajo: ["trabaj", "laburo", "oficina", "reunion", "meeting", "mails", "mail", "proyecto", "cliente", "empleo", "emprend", "freelance", "negocio", "facturar", "ventas", "call", "turno", "guardia", "consultorio"],
  // Deporte
  cuerpo: ["gim", "gym", "correr", "corri", "running", "caminar", "camine", "caminata", "yoga", "pilates", "futbol", "padel", "tenis", "natacion", "nadar", "nade", "bici", "ciclismo", "crossfit", "entren", "box", "funcional", "spinning", "deporte", "rugby", "hockey", "basquet", "voley", "escalar", "remo", "trekking", "surf"],
  // Mente y Alma
  interior: ["medit", "terapia", "psico", "respir", "mindful", "rezar", "reze", "misa", "journal", "diario", "agradec", "silencio", "retiro"],
  // Hobbies y disfrute
  alma: ["musica", "produc", "guitarra", "piano", "bateria", "cantar", "ajedrez", "serie", "netflix", "pelicula", "cine", "juego", "jugue", "videojuego", "play", "dibuj", "pint", "foto", "recital", "concierto", "teatro", "museo", "hobby", "jardin", "plantas", "manualidad", "cocin", "bar", "boliche", "fiesta"],
  // Habilidades
  mente: ["idioma", "ingles", "aleman", "frances", "italiano", "portugues", "estudi", "curso", "clase", "facu", "aprend", "leer", "lei", "libro", "lectura", "programar", "codigo", "tesis", "examen", "investig", "podcast", "certific", "taller"],
  vinculos: ["amig", "famil", "novi", "pareja", "cita", "mama", "papa", "vieja", "viejo", "herman", "abuel", "tio", "tia", "prim", "hij", "sobrin", "suegr", "juntada", "asado", "cumple", "visita", "llame", "llamada"],
  libre: ["almuerzo", "almorzar", "desayuno", "desayunar", "cena", "cenar", "merienda", "comer", "comida", "descanso", "descansar", "siesta", "traslado", "colectivo", "subte", "tren", "manejar", "ducha", "casa", "limpi", "lavar", "compras", "super", "tramite", "banco", "relax", "dormir"],
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
  if (mine) return mine.quadrant;

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
