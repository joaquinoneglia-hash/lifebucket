import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { IdealEdit, SetupExtraction, WeekReview, type SetupRequest } from "@/lib/ai-schemas";
import { client, errorResponse, FALLBACK, missingKeyResponse, MODEL, refusalResponse } from "@/lib/claude-server";

const SYSTEM = `Sos el guía de LifeBucket: una app que muestra en qué se te va el tiempo de tu vida. Tu vida es un balde de horas y cada parte lo llena: Cuerpo (deporte, salud), Mente (leer, estudiar, aprender), Alma (meditar, arte, lo que te recarga), Vínculos (pareja, amigos, familia), Trabajo (solo trabajo, sin detallar reuniones ni mails) y Libre (todo lo que sobra: descanso, casa, traslados, pantallas). El sueño es fijo y queda fuera del 100%.

No es una agenda detallada: se arma la semana tipo con bloques grandes que se repiten. La rutina es lo que se repite igual cada semana: sueño, trabajo y hábitos de Cuerpo, Mente y Espíritu. Vínculos (pareja, amigos, familia) no son rutina: son momentos que se registran cuando pasan, así que no los critiques si figuran en 0.

Hablás en español rioplatense, cálido, breve y sin sermones. Nunca juzgás: mostrás.`;

const PROMPTS = {
  extract: `Te paso una pregunta del armado de la semana y la respuesta del usuario con sus palabras (puede venir dictada, con errores). Extraé solo lo que dijo; no inventes. Si no menciona algo, dejalo en null o vacío. Si no dice cuántas veces, asumí 2 por semana; si no dice duración, 60 minutos.`,
  ideal: `El usuario está diseñando su semana ideal y te pide cambios con sus palabras. Traducilos en actividades para sumar o sacar (por nombre). Si pide "más" de algo que ya tiene, sumalo con las veces nuevas totales. En reply, contá qué cambiaste y sugerí algo concreto para mejorar el balance, mirando la referencia promedio.`,
  review: `Comentá la distribución de la semana del usuario comparada con la de una persona promedio. Destacá una cosa buena y una que se podría mejorar, con números concretos. Sin juzgar.`,
} as const;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: SetupRequest;
  try {
    body = (await request.json()) as SetupRequest;
  } catch {
    return NextResponse.json({ error: "No entendí el pedido." }, { status: 400 });
  }
  const mode = body.mode;
  if (!(mode in PROMPTS)) return NextResponse.json({ error: "Modo desconocido." }, { status: 400 });

  const content = [
    PROMPTS[mode],
    body.context ? `\nContexto:\n${body.context.slice(0, 6000)}` : "",
    body.question ? `\nPregunta: ${body.question.slice(0, 500)}` : "",
    body.text ? `\nLo que dijo: ${body.text.slice(0, 2000)}` : "",
  ].join("\n");
  const format = mode === "extract" ? SetupExtraction : mode === "ideal" ? IdealEdit : WeekReview;

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(format) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return refusalResponse();
    if (!response.parsed_output) return NextResponse.json({ error: "No pude entenderlo." }, { status: 502 });
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    return errorResponse(error, "setup");
  }
}
