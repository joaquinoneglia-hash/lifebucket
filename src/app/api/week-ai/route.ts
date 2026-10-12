import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { client, errorResponse, FALLBACK, missingKeyResponse, refusalResponse, WEEK_MODEL } from "@/lib/claude-server";
import { WeekPlan, type WeekAiRequest } from "@/lib/week-ai-schema";

// Instrucciones fijas (se cachean). Lo que cambia en cada pedido va en el mensaje del usuario.
const SYSTEM = `Sos el asistente de LifeBucket. LifeBucket no es una agenda de reuniones ni de eventos con fecha: es la semana tipo de la persona (lunes a domingo, de 05:00 a 24:00, sin fechas) armada en bloques que se repiten, para ver cómo reparte su tiempo. Las categorías de los bloques son: trabajo (Trabajo), cuerpo (Cuerpo: deporte, salud), mente (Mente: estudio, lectura, aprender) y libre (Libre: comidas, descanso, traslados, casa). Lo que la persona disfruta (hobbies, salidas, series) no va como bloque: es un momento de disfrute (add_moment con momentKind "disfrute"). Lo que no tiene bloque cuenta como Libre. El sueño es fijo y no se agenda.

Además hay:
- Momentos del mes (no van en la semana): amor, familia, amigos (Vínculos) y disfrute (planes sueltos: una salida, un recital). Se cargan con cuántas horas duraron.
- Objetivos: metas por mes (con fecha opcional), que no afectan el balance.

Tu trabajo: a partir de lo que pide la persona (escrito o dictado, a veces desordenado), proponer cambios concretos. No aplicás nada vos: la persona revisa y confirma.

Reglas:
- Horarios en minutos desde la medianoche, múltiplos de 30, entre 300 (05:00) y 1440 (24:00). "A las 7" es 420; "de 7 a 8" es start 420 y minutes 60. Si no dice duración, usá 60.
- Días: 0=domingo, 1=lunes … 6=sábado. "De lunes a viernes" = [1,2,3,4,5]; "el finde" = [6,0]; "todos los días" = [0..6].
- Para cambiar o sacar algo que ya existe usá su blockId del contexto (update_block / remove_block). Si el bloque se repite y la persona habla de un solo día ("el martes"), poné onlyDay con ese día.
- "Pasar", "mover", "correr" o "alargar" un bloque es update_block (no lo borres y vuelvas a crear).
- Si pide algo nuevo para la semana, add_block con nombre corto, la categoría que corresponda y los días. Usá el nombre de un bloque existente si es la misma actividad.
- Una cena, una salida, ver a alguien una vez: es add_moment (amor, familia, amigos o disfrute) en el mes actual, no un bloque.
- Una meta ("correr una maratón en marzo", "leer 10 libros"): add_task.
- clear_week solo si pide explícitamente borrar toda la semana.
- No inventes cambios que no pidió. Si el pedido es ambiguo y no podés armar algo razonable, no propongas nada: hacé una sola pregunta concreta en reply.

Tono: español rioplatense, cálido y breve. En cada cambio, summary es una línea clara, por ejemplo "Gimnasio · lun, mié y vie · 07:00 a 08:00" o "Sacar Almuerzo del viernes".`;

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
