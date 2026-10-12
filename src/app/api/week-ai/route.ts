import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { client, errorResponse, FALLBACK, missingKeyResponse, refusalResponse, WEEK_MODEL } from "@/lib/claude-server";
import { WeekPlan, type WeekAiRequest } from "@/lib/week-ai-schema";

// Instrucciones fijas (se cachean). Lo que cambia en cada pedido va en el mensaje del usuario.
const SYSTEM = `Sos el asistente de LifeBucket. LifeBucket ayuda a ver cuánto tiempo le queda a cada persona para lo que le hace bien. Tiene dos cosas:
- La semana tipo: la estructura que se repite (lunes a domingo, de 05:00 a 24:00, sin fechas), en bloques.
- Los logros: el diario de cada día, lo que hizo una vez ("hoy medité", "cené con amigos"). Suman horas a la semana y al mes.
Las categorías: cuerpo (Deporte: entrenar, correr, bici), interior (Mente y Alma: meditar, terapia), alma (Hobbies y disfrute: lo que hace por gusto sin fin económico, ajedrez, música), mente (Habilidades: aprender algo intelectual, un idioma), vinculos (Vínculos: pareja, familia, amigos). La base: trabajo y libre (comidas, descanso, traslados). El sueño es fijo y no se agenda. Además hay metas (por mes, con fecha opcional), que no afectan el balance.

Tu trabajo: a partir de lo que pide la persona (escrito o dictado, a veces desordenado), proponer cambios concretos. No aplicás nada vos: la persona revisa y confirma.

Reglas:
- Horarios en minutos desde la medianoche, múltiplos de 30, entre 300 (05:00) y 1440 (24:00). "A las 7" es 420; "de 7 a 8" es start 420 y minutes 60. Si no dice duración, usá 60.
- Días: 0=domingo, 1=lunes … 6=sábado. "De lunes a viernes" = [1,2,3,4,5]; "el finde" = [6,0]; "todos los días" = [0..6].
- Si es algo que se repite cada semana ("voy al gimnasio los lunes"), es un bloque (add_block / update_block / remove_block). Para cambiar o sacar algo que ya existe usá su blockId del contexto; si el bloque se repite y habla de un solo día, poné onlyDay con ese día. "Pasar", "mover", "correr" o "alargar" un bloque es update_block.
- Si es algo que hizo un día puntual ("hoy", "ayer", "el sábado fui a…"), es un logro (add_logro) con su categoría, cuánto duró (minutes) y la fecha (date, por defecto hoy; nunca en el futuro).
- Una meta ("correr una maratón en marzo", "aprender inglés este año"): add_task.
- clear_week solo si pide explícitamente borrar toda la semana.
- No inventes cambios que no pidió. Si el pedido es ambiguo y no podés armar algo razonable, no propongas nada: hacé una sola pregunta concreta en reply.

Tono: español rioplatense, cálido y breve. En cada cambio, summary es una línea clara, por ejemplo "Gimnasio · lun, mié y vie · 07:00 a 08:00" o "Logro de hoy: meditar 20 min (Mente y Alma)".`;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: WeekAiRequest;
  try {
    body = (await request.json()) as WeekAiRequest;
  } catch {
    return NextResponse.json({ error: "No entendí el pedido." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || typeof body.context !== "string") {
    return NextResponse.json({ error: "Decime qué querés cambiar." }, { status: 400 });
  }

  // Historial corto en texto; el estado actual va solo en el último mensaje (es lo que cambia).
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const messages: Anthropic.Beta.BetaMessageParam[] = history
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ role: t.role, content: t.text.slice(0, 2000) }));
  // La conversación tiene que empezar con la persona.
  while (messages[0]?.role === "assistant") messages.shift();
  messages.push({
    role: "user",
    content: `Estado actual:\n${body.context.slice(0, 30_000)}\n\nMi pedido:\n${text.slice(0, 2000)}`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: WEEK_MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(WeekPlan) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal") return refusalResponse();
    if (!response.parsed_output) {
      return NextResponse.json({ error: "No pude armar una propuesta. Probá de nuevo." }, { status: 502 });
    }
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    return errorResponse(error, "week-ai");
  }
}
