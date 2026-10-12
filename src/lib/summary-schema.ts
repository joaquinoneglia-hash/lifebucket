import { z } from "zod";

/** El resumen general que escribe la IA: un relato en capítulos (los gráficos los pone la app). */
export const SummaryChapter = z.object({
  id: z.enum(["portada", "balde", "diarios", "diario", "metas", "cierre"]).describe("A qué capítulo corresponde (cada id una sola vez, en este orden)."),
  title: z.string().describe("Título corto y cálido del capítulo."),
  text: z.string().describe("El relato del capítulo: 2 a 4 oraciones, en segunda persona, español rioplatense, con los números reales del contexto."),
});

export const Summary = z.object({
  title: z.string().describe("Título del resumen, por ejemplo «Tu octubre, en pocas palabras»."),
  chapters: z.array(SummaryChapter).describe("Los seis capítulos, en orden: portada, balde, diarios, diario, metas, cierre."),
  tips: z.array(z.string()).describe("2 o 3 recomendaciones concretas y amables para el próximo período."),
});

export type Summary = z.infer<typeof Summary>;
export type SummaryRequest = { range: "mes" | "anio"; context: string };
