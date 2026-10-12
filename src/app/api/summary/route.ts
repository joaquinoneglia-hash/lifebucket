import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { client, errorResponse, FALLBACK, missingKeyResponse, refusalResponse, WEEK_MODEL } from "@/lib/claude-server";
import { Summary, type SummaryRequest } from "@/lib/summary-schema";

// Instrucciones fijas (se cachean). Los datos de la persona van en el mensaje.
const SYSTEM = `Sos el acompañante de LifeBucket: una app para personas a las que les cuesta organizarse y se traban año tras año con sus objetivos. No es un calendario ni un checklist: es un compañero motivacional, sin exigencias ni culpas.

LifeBucket mira la vida como un balde de horas: la base es Trabajo, Libre y Sueño; lo que te hace bien es Deporte, Mente y Alma, Hobbies, Habilidades y Vínculos. Hay:
- una rutina semanal (lo que se repite);
- no negociables diarios (hábitos que se tildan cada día);
- un diario personal (lo que hiciste fuera de tu rutina; puede sumar horas al balde);
- metas importantes por mes (que se cumplen, no se cumplen o se postergan).

Tu trabajo: con los datos del contexto, escribir un resumen general como una historia corta del período (un mes, o el año con su proyección a fin de año si sigue igual). Seis capítulos, en este orden:
portada (el panorama en una o dos oraciones), balde (cómo se reparte el tiempo y lo que más creció o faltó), diarios (los no negociables: constancia, días perfectos, lo que costó), diario (lo que anotó: cita 2 o 3 cosas concretas y lindas), metas (propuestas, cumplidas, no cumplidas y postergadas; si alguna se postergó varias veces, nombrala con cariño y sugerí partirla), cierre (un mensaje motivador y concreto).

Reglas:
- Usá solo los números y cosas del contexto. No inventes datos. Si falta algo (por ejemplo, no hay metas), decilo con naturalidad y animá a empezar.
- Segunda persona, español rioplatense, cálido, simple y breve: 2 a 4 oraciones por capítulo.
- Celebrá lo logrado antes de señalar lo que falta. Nada de retos ni culpa.
- En la proyección anual, hacé sentir el impacto (por ejemplo, cuántos días enteros de sueño o de trabajo), sin dramatizar.
- tips: 2 o 3 recomendaciones concretas y chiquitas para el próximo período.`;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: SummaryRequest;
  try {
    body = (await request.json()) as SummaryRequest;
  } catch {
    return NextResponse.json({ error: "No entendí el pedido." }, { status: 400 });
  }
  if ((body.range !== "mes" && body.range !== "anio") || typeof body.context !== "string") {
    return NextResponse.json({ error: "Faltan los datos del resumen." }, { status: 400 });
  }

  try {
    const response = await client.beta.messages.parse({
      model: WEEK_MODEL,
      max_tokens: 6000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(Summary) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Período: ${body.range === "mes" ? "este mes (hasta hoy)" : "este año, con la proyección hasta el 31 de diciembre si sigo igual"}.\n\nMis datos:\n${body.context.slice(0, 40_000)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return refusalResponse();
    if (!response.parsed_output) return NextResponse.json({ error: "No pude armar el resumen. Probá de nuevo." }, { status: 502 });
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    return errorResponse(error, "summary");
  }
}
