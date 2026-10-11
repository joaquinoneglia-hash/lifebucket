import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { TargetsProposal, type TargetsRequest } from "@/lib/ai-schemas";
import { client, errorResponse, FALLBACK, missingKeyResponse, MODEL, refusalResponse } from "@/lib/claude-server";

const SYSTEM = `Sos el coach de LifeBucket, un planificador de balance de vida para personas con TDAH. La vida se organiza en cinco cuadrantes: Cuerpo (salud, deporte, comidas), Mente (estudio, lectura, aprender), Alma (meditación, arte, creatividad), Vínculos (pareja, amigos, familia) y Trabajo. Además está Libre (descanso, ocio sin plan, traslados, casa): todo minuto despierto sin actividad cuenta como Libre automáticamente. El sueño es un horario fijo: no se agenda nada ahí y no entra en el balance; el 100% es el tiempo despierto.

Tu tarea: recomendar el objetivo de balance del usuario: qué porcentaje de su tiempo despierto debería ir a cada parte (los cinco cuadrantes y Libre). No tiene que ser parejo: depende de su vida.

Reglas:
- Porcentajes enteros, múltiplos de 5, que sumen exactamente 100. Ninguno en 0 salvo Trabajo si no trabaja. Libre nunca menos de 10: incluye traslados y casa, y el descanso sin plan también es balance.
- Trabajo refleja la realidad (alguien full time no puede tener 10%), pero sin que se coma todo.
- Subí un poco lo que quiere priorizar y lo que siente que descuida, sin metas imposibles: es mejor un objetivo alcanzable que uno ideal.
- Si hay historial, tenelo en cuenta: si un cuadrante viene muy por debajo hace semanas, proponé un escalón intermedio en lugar de un salto.
- explanation: dos o tres oraciones, cálidas y concretas, en español rioplatense.`;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: TargetsRequest;
  try {
    body = (await request.json()) as TargetsRequest;
  } catch {
    return NextResponse.json({ error: "No entendí el pedido." }, { status: 400 });
  }
  const a = body.answers;
  if (!a) return NextResponse.json({ error: "Faltan tus respuestas." }, { status: 400 });

  const summary = [
    `Trabajo: ${a.jobs || "no trabaja ahora"} (${Math.round(a.workMinutes / 60)} h por semana sobre ${Math.round(a.awakeMinutes / 60)} h despierto, o sea ${a.awakeMinutes ? Math.round((a.workMinutes / a.awakeMinutes) * 100) : 0}%).`,
    `Quiere priorizar (y probablemente viene descuidando): ${a.priorities.join(", ") || "nada en particular"}.`,
    a.note ? `Nota: ${a.note.slice(0, 500)}` : "",
    body.history ? `Cómo viene:\n${body.history.slice(0, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(TargetsProposal) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `${summary}\n\nRecomendame mi objetivo de balance.` }],
    });
    if (response.stop_reason === "refusal") return refusalResponse();
    if (!response.parsed_output) {
      return NextResponse.json({ error: "No pude armar la recomendación." }, { status: 502 });
    }
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    return errorResponse(error, "targets");
  }
}
