/** Cómo están configuradas las alertas (aparte, sin depender del store, para no armar un ciclo). */
export type AlertSettings = {
  /** Ya las configuraste (si no, la ruedita se resalta al día siguiente de la guía). */
  configured: boolean;
  /** No negociables: al abrir la app a la mañana (de 5 a 12). */
  nonegMorning: boolean;
  /** No negociables: a la noche, a esta hora (minutos desde las 0), si te faltan los de hoy. */
  nonegNight: boolean;
  nonegNightAt: number;
  /** Reconfirmar la rutina de la semana: qué día (0 domingo, 1 lunes) y a qué hora. */
  routine: boolean;
  routineDay: number;
  routineAt: number;
  /** Avisos de cómo venís: el balde a mitad de semana y las metas del mes. */
  progress: boolean;
};

export const DEFAULT_ALERTS: AlertSettings = {
  configured: false,
  nonegMorning: true,
  nonegNight: true,
  nonegNightAt: 21 * 60,
  routine: true,
  routineDay: 0,
  routineAt: 20 * 60,
  progress: true,
};
