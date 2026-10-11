import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { MissionsPlan, type MissionsRequest } from "@/lib/ai-schemas";
import { client, errorResponse, FALLBACK, missingKeyResponse, MODEL, refusalResponse } from "@/lib/claude-server";

const SYSTEM = `Sos el coach de LifeBucket, un planificador de balance de vida para personas con TDAH. La vida se organiza en cinco cuadrantes: Cuerpo, Mente, Alma, Vínculos y Trabajo. Además está Libre (descanso, ocio sin plan, traslados, casa): todo minuto despierto sin actividad cuenta como Libre automáticamente. El sueño es un horario fijo: no se agenda nada ahí y no entra en el balance; el 100% es el tiempo despierto. El usuario tiene un objetivo de balance (qué % de su tiempo despierto quiere para cada parte, Libre incluido).

Estás en el ritual semanal de reprogramación. Tu tarea: proponer entre 1 y 4 "misiones" concretas para la semana indicada, que acerquen lo agendado al objetivo. Una misión es algo como "Juntate 2 veces con amigos" o "Meditá 3 mañanas", con horarios libres sugeridos.

Cómo elegirlas:
- Priorizá los cuadrantes que, en la semana a planificar, tienen menos agendado que su objetivo, y los que vienen bajos en las últimas semanas.
- No propongas misiones de Libre (se completa solo) ni de Trabajo para sumar horas. Si el trabajo se pasa del objetivo, podés proponer una misión de corte ("Terminá a las 19 h dos días") usando quadrant "trabajo" y slots vacío.
- Usá las actividades del usuario con su nombre exacto cuando existan.
- Las misiones tienen que ser alcanzables: pocas veces, bloques cortos (30 o 60 min) salvo actividades que lo pidan (una salida con amigos puede ser de 120).
- Cada slot es un horario libre real: fecha de la semana a planificar (no en el pasado), dentro de la ventana despierto de ese día (nunca en el horario de sueño), múltiplo de 30, sin superponerse con bloques existentes ni con otros slots que propongas. Elegí momentos lógicos (gimnasio a la mañana o a la tarde, amigos a la noche o el fin de semana).
- Un slot por cada vez que proponés hacerlo.

Tono: español rioplatense, cálido, breve, sin culpa. Nada de "tenés que": proponé.`;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: MissionsRequest;
  try {
    body = (await request.json()) as MissionsRequest;
  } catch {
    return NextResponse.json({ error: "No entendí el pedido." }, { status: 400 });
  }
  if (typeof body.week !== "string" || typeof body.context !== "string") {
    return NextResponse.json({ error: "Faltan datos de la semana." }, { status: 400 });
  }

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(MissionsPlan) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Semana a planificar: la que empieza el ${body.week}.\n\n${body.context.slice(0, 40_000)}\n\nProponé las misiones.`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return refusalResponse();
    if (!response.parsed_output) {
      return NextResponse.json({ error: "No pude armar las misiones." }, { status: 502 });
    }
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    return errorResponse(error, "missions");
  }
}
