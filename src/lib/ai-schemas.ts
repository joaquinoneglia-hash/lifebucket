import { z } from "zod";

const Quadrant = z.enum(["cuerpo", "mente", "alma", "vinculos", "trabajo", "libre"]);

/** Misiones de la semana propuestas en el ritual. */
export const MissionsPlan = z.object({
  intro: z.string().describe("Una o dos oraciones cálidas sobre cómo viene la semana y qué proponés."),
  missions: z
    .array(
      z.object({
        title: z.string().describe("Corta y concreta, en segunda persona: \"Juntate 2 veces con amigos\"."),
        why: z.string().describe("Por qué, en una línea, ligado al objetivo o a lo que viene pasando."),
        quadrant: Quadrant,
        activityName: z.string().describe("Una actividad del usuario si existe; si no, un nombre corto nuevo."),
        minutes: z.number().int().describe("30, 60, 120, 180 o 240."),
        slots: z
          .array(z.object({ date: z.string().describe("YYYY-MM-DD"), start: z.number().int().describe("Minutos desde la medianoche, múltiplo de 30.") }))
          .describe("Horarios libres sugeridos, uno por cada vez."),
      }),
    )
    .describe("Entre 1 y 4 misiones."),
});
export type MissionsPlan = z.infer<typeof MissionsPlan>;

export interface MissionsRequest {
  week: string;
  context: string;
}

/** Respuestas del cuestionario para recomendar el objetivo de balance. */
export interface TargetsAnswers {
  /** Minutos de trabajo por semana (suma de tus trabajos con horario). */
  workMinutes: number;
  /** Minutos despierto por semana, según tu horario de sueño. */
  awakeMinutes: number;
  /** Tus trabajos en texto, por ejemplo "Empleo lun a vie 9 a 18; Emprendimiento mar y jue 19 a 21". */
  jobs: string;
  /** Lo que querés priorizar (y probablemente venís descuidando). */
  priorities: string[];
  note?: string;
}

export const TargetsProposal = z.object({
  targets: z
    .object({ cuerpo: z.number().int(), mente: z.number().int(), alma: z.number().int(), vinculos: z.number().int(), trabajo: z.number().int(), libre: z.number().int() })
    .describe("Porcentajes en múltiplos de 5 que suman exactamente 100."),
  explanation: z.string().describe("Dos o tres oraciones explicando el porqué, en español rioplatense."),
});
export type TargetsProposal = z.infer<typeof TargetsProposal>;

export interface TargetsRequest {
  answers: TargetsAnswers;
  /** Resumen de cómo viene repartiendo y cumpliendo (si ya usa la app). */
  history?: string;
}

// ---------- Armado de la semana conversando ----------

const LifeQuadrant = z.enum(["cuerpo", "mente", "alma", "vinculos"]);

const ActivityOut = z.object({
  quadrant: LifeQuadrant,
  name: z.string().describe("Nombre corto con mayúscula: \"Gimnasio\", \"Leer\", \"Cena con amigos\"."),
  perWeek: z.number().int().describe("Veces por semana, de 1 a 7."),
  minutes: z.number().int().describe("Duración en minutos: 30, 60, 90, 120, 180 o 240."),
  timeOfDay: z.enum(["mañana", "tarde", "noche"]).nullable(),
  days: z.array(z.number().int()).nullable().describe("Días puntuales si los dijo (Date.getDay(): 0 domingo … 6 sábado); null si no."),
});

/** Lo que el usuario contó con sus palabras en una pregunta del armado. */
export const SetupExtraction = z.object({
  name: z.string().nullable().describe("Su nombre si lo dijo."),
  sleep: z
    .object({
      weekdayBed: z.number().int().describe("Minutos desde la medianoche; después de medianoche, sumá 1440 (00:30 = 1470)."),
      weekdayWake: z.number().int(),
      weekendBed: z.number().int(),
      weekendWake: z.number().int(),
    })
    .nullable(),
  jobs: z
    .array(
      z.object({
        name: z.string().describe("Empleo, Emprendimiento, o el nombre que le dé."),
        days: z.array(z.number().int()).describe("Días con Date.getDay(): 0 domingo, 1 lunes … 6 sábado."),
        start: z.number().int().describe("Minutos desde la medianoche, múltiplo de 30."),
        end: z.number().int(),
      }),
    )
    .nullable()
    .describe("Sus trabajos (hasta 2). Lista vacía si no trabaja; null si no habló de trabajo."),
  activities: z.array(ActivityOut).describe("Actividades que hace (o quiere hacer). Solo Cuerpo, Mente, Alma o Vínculos."),
  none: z.boolean().describe("true si dijo que no hace nada de lo que se le preguntó."),
  reply: z.string().describe("Una oración corta y cálida confirmando lo que entendiste, en español rioplatense."),
});
export type SetupExtraction = z.infer<typeof SetupExtraction>;

/** Cambios pedidos para la semana ideal. */
export const IdealEdit = z.object({
  add: z.array(ActivityOut).describe("Actividades para sumar."),
  remove: z.array(z.string()).describe("Nombres de actividades para sacar."),
  reply: z.string().describe("Una o dos oraciones: qué cambiaste y una sugerencia o pregunta para seguir."),
});
export type IdealEdit = z.infer<typeof IdealEdit>;

/** Comentario sobre una distribución, comparada con la de una persona promedio. */
export const WeekReview = z.object({
  comment: z.string().describe("Dos o tres oraciones, cálidas y concretas, sin juzgar."),
});
export type WeekReview = z.infer<typeof WeekReview>;

export interface SetupRequest {
  mode: "extract" | "ideal" | "review";
  /** La pregunta que se le hizo (extract) o lo que pidió (ideal). */
  question?: string;
  text?: string;
  /** Resumen de la semana: horas por cuadrante, actividades, la referencia promedio. */
  context: string;
}
