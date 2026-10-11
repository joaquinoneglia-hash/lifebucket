import { z } from "zod";

/**
 * Un cambio propuesto por el asistente. Todos los campos están siempre presentes
 * (null cuando no aplican) para que la salida estructurada sea simple y estricta.
 */
export const PlanAction = z.object({
  kind: z
    .enum(["add", "move", "update", "remove", "mark"])
    .describe("add: bloque nuevo · move: cambiar día/hora · update: cambiar actividad o duración · remove: borrar · mark: marcar estado"),
  blockId: z.string().nullable().describe("Id de un bloque existente (move/update/remove/mark). null en add."),
  activityName: z
    .string()
    .nullable()
    .describe("Nombre de la actividad. Usá exactamente un nombre de la lista del usuario si existe."),
  quadrant: z.enum(["cuerpo", "mente", "alma", "vinculos", "trabajo", "libre"]).nullable(),
  minutes: z.number().int().nullable().describe("Duración: 30, 60 o 120."),
  date: z.string().nullable().describe("Fecha YYYY-MM-DD. En add con repetición, la primera vez."),
  start: z.number().int().nullable().describe("Minutos desde la medianoche, múltiplo de 30, entre 360 y 1410."),
  repeatDays: z
    .array(z.number().int())
    .nullable()
    .describe("Solo en add: días en que se repite (0=domingo … 6=sábado). null si no se repite."),
  status: z.enum(["done", "skipped", "pending"]).nullable().describe("Solo en mark."),
  summary: z.string().describe("Una línea en español rioplatense que describe el cambio."),
});

export const Plan = z.object({
  reply: z.string().describe("Respuesta breve y cálida al usuario, en español rioplatense."),
  actions: z.array(PlanAction),
});

export type PlanAction = z.infer<typeof PlanAction>;
export type Plan = z.infer<typeof Plan>;

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantRequest {
  /** Conversación previa (solo texto) más el pedido nuevo al final. */
  turns: AssistantTurn[];
  /** Estado actual de la semana, armado en el cliente. */
  context: string;
}
