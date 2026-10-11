import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { Plan, type AssistantRequest } from "@/lib/assistant-schema";
import { client, errorResponse, FALLBACK, missingKeyResponse, MODEL, refusalResponse } from "@/lib/claude-server";

// Instrucciones fijas (se cachean). Lo que cambia en cada pedido va en el mensaje del usuario.
const SYSTEM = `Sos el asistente de LifeBucket, un planificador de balance de vida para personas con TDAH. La vida se organiza en cinco cuadrantes: Cuerpo (salud, deporte, comidas), Mente (estudio, lectura, aprender), Alma (meditación, arte, creatividad), Vínculos (pareja, amigos, familia) y Trabajo. Además está Libre (descanso, ocio sin plan, traslados, casa): todo minuto despierto sin actividad cuenta como Libre automáticamente. El sueño es un horario fijo: no se agenda nada ahí y no entra en el balance; el 100% es el tiempo despierto.

Tu trabajo: a partir de lo que pide el usuario (escrito o dictado, a veces desordenado), proponer cambios concretos en su semana. No aplicás nada vos: el usuario revisa tu propuesta y la confirma.

Reglas para los cambios:
- Horarios en minutos desde la medianoche, en múltiplos de 30, siempre dentro de la ventana despierto de ese día (ver el horario de sueño del contexto). Después de medianoche se sigue contando: 00:30 = 1470.
- Duraciones: 30, 60, 120, 180 o 240 minutos. Elegí la más cercana a lo que pide.
- Fechas en formato YYYY-MM-DD, dentro del rango de días que figura en el contexto, y nunca en el pasado salvo que el usuario lo pida.
- Usá las actividades que el usuario ya tiene, con el mismo nombre y cuadrante. Si pide algo que no existe, proponé una actividad nueva con un nombre corto y el cuadrante que corresponda.
- No superpongas bloques con los que ya existen, salvo que el usuario lo pida. Mirá los horarios ocupados del contexto.
- "Reorganizar" o "pasar" es mover (move) bloques existentes con su blockId; no los borres y vuelvas a crear.
- Para algo que se repite (por ejemplo "lunes, miércoles y viernes"), usá un solo add con repeatDays y la fecha de la primera vez.
- Borrá (remove) solo si el usuario lo pide de forma explícita.
- Si pide equilibrar, tené en cuenta el objetivo de balance, cómo está repartido lo agendado y lo cumplido; sumá tiempo a los cuadrantes que quedaron abajo, con bloques cortos.
- Si el pedido es ambiguo y no podés armar algo razonable, no propongas cambios: hacé una sola pregunta concreta en reply.

Tono: español rioplatense, cálido y breve (dos oraciones como máximo en reply). Nunca culpes al usuario por lo que no hizo. En cada cambio, summary es una línea clara, por ejemplo "Gimnasio · lun 12 · 07:00 a 08:00".`;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "No entendí el pedido." }, { status: 400 });
  }

  const turns = Array.isArray(body.turns) ? body.turns.slice(-12) : [];
  const last = turns.at(-1);
  if (!last || last.role !== "user" || !last.text?.trim() || typeof body.context !== "string") {
    return NextResponse.json({ error: "Escribime qué querés hacer." }, { status: 400 });
  }

  // Historial en texto; el contexto de la semana va solo en el último mensaje (es lo que cambia).
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.slice(0, -1).map((t) => ({
    role: t.role,
    content: t.text.slice(0, 4000),
  }));
  messages.push({
    role: "user",
    content: `Estado actual de mi planificación:\n${body.context.slice(0, 40_000)}\n\nMi pedido:\n${last.text.slice(0, 4000)}`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Plan) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal") return refusalResponse();
    if (!response.parsed_output) {
      return NextResponse.json({ error: "No pude armar una propuesta. Probá de nuevo." }, { status: 502 });
    }
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    return errorResponse(error, "assistant");
  }
}
