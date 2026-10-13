import { z } from "zod";

/**
 * Un cambio que propone el asistente sobre la semana tipo (y momentos u objetivos). Todos los campos
 * están siempre (null cuando no aplican) para que la salida estructurada sea simple y estricta.
 */
export const WeekAction = z.object({
  kind: z
    .enum(["add_block", "update_block", "remove_block", "add_logro", "add_task", "clear_week"])
    .describe(
      "add_block: bloque nuevo en la semana tipo (algo que se repite) · update_block: cambiar horario, días, nombre o categoría de un bloque · remove_block: sacar un bloque · add_logro: algo que hizo un día puntual (el diario de logros) · add_task: una meta · clear_week: vaciar la semana (solo si lo pide explícitamente)",
    ),
  blockId: z.string().nullable().describe("Id de un bloque existente (update_block, remove_block). null en el resto."),
  name: z.string().nullable().describe("Nombre del bloque, texto del logro o de la meta. Corto. Si el bloque ya existe, usá el mismo nombre."),
  quadrant: z
    .enum(["trabajo", "cuerpo", "interior", "alma", "mente", "vinculos", "libre"])
    .nullable()
    .describe("Categoría del bloque o del logro: cuerpo = Deporte, interior = Mente y Espíritu, alma = Hobbies y disfrute, mente = Intelecto y Cognitivo, vinculos = Vínculos."),
  days: z.array(z.number().int()).nullable().describe("Días del bloque (0=domingo, 1=lunes … 6=sábado). En update_block, solo si cambian."),
  start: z.number().int().nullable().describe("Inicio en minutos desde la medianoche, múltiplo de 30, entre 300 (05:00) y 1410 (23:30)."),
  minutes: z.number().int().nullable().describe("Duración en minutos: de un bloque (múltiplo de 30, sin pasar de las 24:00) o de un logro."),
  onlyDay: z
    .number()
    .int()
    .nullable()
    .describe("En update_block o remove_block de un bloque que se repite: el único día afectado (0–6). null = todos sus días."),
  month: z.string().nullable().describe("YYYY-MM de una meta. Por defecto, el mes actual."),
  date: z.string().nullable().describe("YYYY-MM-DD: el día de un logro (por defecto, hoy) o la fecha de una meta (null si no tiene)."),
  taskKind: z.enum(["cuerpo", "interior", "alma", "mente", "vinculos", "trabajo", "otro"]).nullable().describe("Solo en add_task."),
  summary: z.string().describe("Una línea clara en español rioplatense, por ejemplo: «Gimnasio · lun, mié y vie · 07:00 a 08:00»."),
});

export const WeekPlan = z.object({
  reply: z.string().describe("Respuesta breve y cálida al usuario (una o dos oraciones), en español rioplatense."),
  actions: z.array(WeekAction),
});

export type WeekAction = z.infer<typeof WeekAction>;
export type WeekPlan = z.infer<typeof WeekPlan>;

export type WeekAiRequest = {
  /** El pedido (escrito o dictado). */
  text: string;
  /** El estado actual en texto: bloques con sus ids, sueño, fecha de hoy. */
  context: string;
  /** Los últimos intercambios, para entender "eso", "el de recién", etc. */
  history?: { role: "user" | "assistant"; text: string }[];
};
