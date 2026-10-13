import { normalize } from "./activities";
import type { QuadrantId } from "./quadrants";

/**
 * Palabras que delatan la categoría de una actividad. Se buscan como comienzo de palabra
 * ("gim" encuentra "gimnasio"; "leer" encuentra "leer un rato").
 */
const WORDS: Record<"trabajo" | "cuerpo" | "interior" | "alma" | "mente" | "vinculos" | "libre", string[]> = {
  trabajo: ["trabaj", "laburo", "oficina", "reunion", "meeting", "mails", "mail", "proyecto", "cliente", "empleo", "emprend", "freelance", "negocio", "facturar", "ventas", "call", "turno", "guardia", "consultorio"],
  // Deporte
  cuerpo: ["gim", "gym", "correr", "corri", "corro", "corremos", "corriendo", "corrida", "trot", "running", "caminar", "camine", "caminata", "yoga", "pilates", "futbol", "fulbo", "picado", "partido", "padel", "tenis", "natacion", "nadar", "nade", "pileta", "bici", "pedal", "ciclismo", "crossfit", "entren", "box", "funcional", "spinning", "deporte", "rugby", "hockey", "basquet", "voley", "escal", "remo", "trekking", "surf", "pesas", "musculac", "fierros", "maraton", "kilometr", "km", "patin", "skate", "esqui", "jiu", "judo", "karate", "artes marciales", "estir", "elongu", "abdominal", "sentadilla", "saltar soga", "soga", "cardio", "hiit"],
  // Mente y Alma
  interior: ["medit", "terapia", "terapeuta", "psico", "respir", "mindful", "rezar", "reze", "rece", "orar", "oracion", "misa", "journal", "diario", "agradec", "gratitud", "silencio", "retiro", "reiki", "constelac", "coach", "reflexion", "espiritual", "contemplac"],
  // Hobbies y disfrute
  alma: ["musica", "produc", "beat", "dj", "mezcl", "guitarra", "piano", "bateria", "bajo", "ukelele", "cantar", "cante", "karaoke", "ajedrez", "serie", "netflix", "pelicula", "cine", "juego", "jugue", "jugar", "videojuego", "play", "consola", "dibuj", "pint", "foto", "recital", "concierto", "teatro", "museo", "hobby", "jardin", "plantas", "manualidad", "tej", "ceramica", "carpinter", "lego", "puzzle", "rompecabezas", "receta", "bar", "boliche", "fiesta", "bail", "danza", "escrib", "poesia", "pesca", "acamp", "paseo", "pasear", "viaje", "viaj", "playa"],
  // Habilidades
  mente: ["idioma", "ingles", "aleman", "frances", "italiano", "portugues", "chino", "duolingo", "estudi", "curso", "clase", "facu", "universidad", "aprend", "leer", "lei", "libro", "lectura", "programar", "programe", "codigo", "tesis", "examen", "parcial", "investig", "podcast", "certific", "taller", "webinar", "charla", "conferencia", "tutorial", "udemy", "coursera", "platzi", "masterclass", "matemat", "practique"],
  vinculos: ["amig", "famil", "novi", "pareja", "cita", "date", "mama", "papa", "vieja", "viejo", "viejos", "herman", "abuel", "tio", "tia", "prim", "hij", "sobrin", "suegr", "esposa", "esposo", "marido", "juntada", "junte", "asado", "cumple", "visita", "visite", "llame", "llamada", "videollamada", "salida", "sali con", "mate con", "con mi", "con mis", "con los chicos", "con las chicas", "los pibes", "las pibas"],
  libre: ["cocin", "barr", "orden", "plancha", "desayun", "perro", "pasear al perro", "almuerzo", "almorzar", "desayuno", "desayunar", "cena", "cenar", "merienda", "comer", "comida", "descanso", "descansar", "siesta", "traslado", "colectivo", "subte", "tren", "manejar", "ducha", "casa", "limpi", "lavar", "compras", "super", "tramite", "banco", "relax", "dormir"],
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
  const last = words[words.length - 1] ?? "";
  let best: { id: QuadrantId; score: number } | null = null;
  for (const [id, list] of Object.entries(WORDS) as [QuadrantId, string[]][]) {
    let score = 0;
    for (const key of list) {
      if (key.includes(" ")) {
        if (q.includes(key)) score += 2;
      } else if (words.some((w) => w.startsWith(key))) {
        score += 2;
      } else if (last.length >= 4 && key.startsWith(last)) {
        // La última palabra a medio escribir ("gimn…").
        score += 1;
      }
    }
    if (score && (!best || score > best.score)) best = { id, score };
  }
  return best?.id ?? null;
}
