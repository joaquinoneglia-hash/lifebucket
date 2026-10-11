// Los momentos del día ahora son bandas sobre la grilla horaria.
export const SLOTS = [
  { id: "manana", name: "Mañana", plural: "mañanas", start: 6 * 60 },
  { id: "tarde", name: "Tarde", plural: "tardes", start: 13 * 60 },
  { id: "noche", name: "Noche", plural: "noches", start: 20 * 60 },
] as const;

export type SlotId = (typeof SLOTS)[number]["id"];

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s])) as Record<
  SlotId,
  (typeof SLOTS)[number]
>;

/** Hora por defecto al migrar bloques que solo tenían momento. */
export const SLOT_DEFAULT_START: Record<SlotId, number> = {
  manana: 9 * 60,
  tarde: 15 * 60,
  noche: 21 * 60,
};

export function slotOf(start: number): SlotId {
  if (start < 13 * 60) return "manana";
  if (start < 20 * 60) return "tarde";
  return "noche";
}
