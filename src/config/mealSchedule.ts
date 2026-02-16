/**
 * Horarios estándar del plan de alimentación.
 * Desayuno, Snack #1, Almuerzo, Snack #2, Cena.
 */
export const MEAL_SCHEDULE = [
  {
    type: "desayuno" as const,
    label: "Desayuno",
    time: "07:00",
    timeRange: "7:00am - 9:30am",
  },
  {
    type: "almuerzo" as const,
    label: "Snack #1",
    time: "10:00",
    timeRange: "10:00am - 11:00am",
  },
  {
    type: "comida" as const,
    label: "Almuerzo",
    time: "12:00",
    timeRange: "12:00pm - 1:30pm",
  },
  {
    type: "merienda" as const,
    label: "Snack #2",
    time: "16:00",
    timeRange: "4:00pm - 5:00pm",
  },
  {
    type: "cena" as const,
    label: "Cena",
    time: "19:00",
    timeRange: "7:00pm - 8:00pm",
  },
] as const;

export type MealScheduleType = (typeof MEAL_SCHEDULE)[number]["type"];
