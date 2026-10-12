import type { QuadrantRecord } from "./quadrants";

/**
 * La semana de una persona promedio que trabaja, en horas por semana, para comparar.
 * Datos fijos (no se consultan en vivo). Lo que no mide ninguna encuesta en forma directa
 * está marcado como aproximado.
 *
 * Fuentes:
 * - BLS, American Time Use Survey 2025 (bls.gov/news.release/atus.nr0.htm): trabajo de tiempo
 *   completo 8,5 h los días de semana trabajados; ocio 5,2 h por día, la mitad mirando TV (2,6 h);
 *   socializar 35 min por día; tareas de la casa 2 h por día; sueño ~9 h por día (ATUS 2024).
 * - OMS: 150 a 300 minutos de actividad física moderada por semana para adultos.
 * - INDEC / Ministerio de Salud, 4.ª Encuesta Nacional de Factores de Riesgo (2018): 6 de cada 10
 *   personas en Argentina tienen actividad física baja.
 */
export const AVERAGE_WEEK: QuadrantRecord<number> & { dormir: number } = {
  dormir: 63, // ~9 h por día (ATUS, incluye siestas)
  trabajo: 41, // 8,1–8,5 h por día trabajado, cinco días
  cuerpo: 2, // aproximado: la mayoría no llega a lo recomendado
  interior: 1, // aproximado: meditación, terapia, prácticas espirituales
  mente: 2, // aproximado: lectura y estudio por interés propio
  alma: 1, // aproximado: prácticas espirituales, arte, hobbies creativos
  vinculos: 4, // 35 min por día socializando (ATUS)
  libre: 55, // el resto: TV (~18 h), casa (~14 h), traslados, comidas, pantallas
};

/** Datos para motivar, cortos y con su fuente. Se muestran al comparar tu semana con la del promedio. */
export const FACTS: Partial<QuadrantRecord<{ text: string; source: string }>> = {
  cuerpo: {
    text: "6 de cada 10 personas en Argentina tienen actividad física baja. La OMS recomienda al menos 2 h 30 por semana.",
    source: "INDEC, Encuesta Nacional de Factores de Riesgo 2018 · OMS",
  },
  vinculos: {
    text: "Una persona promedio pasa apenas 35 minutos por día socializando, y cada vez menos (eran 41 hace diez años).",
    source: "BLS, American Time Use Survey 2025",
  },
  libre: {
    text: "La mitad del tiempo libre promedio se va en mirar TV: unas 18 horas por semana.",
    source: "BLS, American Time Use Survey 2025",
  },
  trabajo: {
    text: "Quien trabaja tiempo completo hace en promedio 8,5 h por día de semana trabajado.",
    source: "BLS, American Time Use Survey 2025",
  },
};

/** Lo recomendado para el cuerpo (OMS): 150 minutos por semana. */
export const WHO_ACTIVITY_MINUTES = 150;
