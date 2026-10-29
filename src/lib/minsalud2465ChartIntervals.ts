/**

 * Intervalos de edad — Resolución MINSALUD 2465 de 2016 (Anexos técnicos 3 y 4)

 * Curvas OMS en puntuación Z por bandas etarias.

 */



import type { WhoIndicator } from './pediatricGrowthUtils';



export type ChartXAxis = 'age_months' | 'height_cm' | 'gestational_weeks';



export interface MinsaludChartInterval {

  id: string;

  /** Etiqueta oficial, ej. "0 a 2 años" */

  label: string;

  xAxis: ChartXAxis;

  xMin: number;

  xMax: number;

  yMin: number;

  yMax: number;

  /** Separación de marcas en eje X */

  xTickStep: number;

  /** Compatibilidad con código previo */

  ageMinMonths: number;

  ageMaxMonths: number;

}



export const MINSALUD_RESOLUTION_REF =

  'Resolución MINSALUD 2465 de 2016 — Curvas OMS (puntuación Z)';



/** Curvas de puntuación Z estándar (como anexo técnico) */

export const Z_SCORE_LINES = [-3, -2, -1, 0, 1, 2, 3] as const;



export const Z_SCORE_COLORS: Record<number, string> = {

  [-3]: '#b91c1c',

  [-2]: '#dc2626',

  [-1]: '#f97316',

  [0]: '#16a34a',

  [1]: '#2563eb',

  [2]: '#1d4ed8',

  [3]: '#1e3a8a',

};



function ageInterval(

  id: string,

  label: string,

  ageMinMonths: number,

  ageMaxMonths: number,

  yMin: number,

  yMax: number,

  xTickStep: number

): MinsaludChartInterval {

  return {

    id,

    label,

    xAxis: 'age_months',

    xMin: ageMinMonths,

    xMax: ageMaxMonths,

    yMin,

    yMax,

    xTickStep,

    ageMinMonths,

    ageMaxMonths,

  };

}



function heightInterval(

  id: string,

  label: string,

  xMin: number,

  xMax: number,

  yMin: number,

  yMax: number,

  xTickStep: number

): MinsaludChartInterval {

  return {

    id,

    label,

    xAxis: 'height_cm',

    xMin,

    xMax,

    yMin,

    yMax,

    xTickStep,

    ageMinMonths: 0,

    ageMaxMonths: 0,

  };

}



export const MINSALUD_CHART_INTERVALS: Record<WhoIndicator, MinsaludChartInterval[]> = {

  weight_for_age: [

    ageInterval('0-2', '0 a 2 años', 0, 24, 2, 16, 3),

    ageInterval('2-5', '2 a 5 años', 24, 60, 8, 26, 6),

  ],

  length_for_age: [

    ageInterval('0-2', '0 a 2 años', 0, 24, 45, 95, 3),

    ageInterval('2-5', '2 a 5 años', 24, 60, 75, 120, 6),

    ageInterval('5-17', '5 a 17 años', 61, 204, 100, 190, 12),

  ],

  head_circumference: [

    ageInterval('0-5', '0 a 5 años', 0, 60, 30, 55, 6),

  ],

  bmi_for_age: [

    ageInterval('0-2', '0 a 2 años', 0, 24, 11, 22, 3),

    ageInterval('2-5', '2 a 5 años', 24, 60, 12, 20, 6),

    ageInterval('5-17', '5 a 17 años', 61, 204, 12, 28, 12),

  ],

  weight_for_height: [

    heightInterval('0-2', '0 a 2 años', 45, 87, 2, 14, 5),

    heightInterval('2-5', '2 a 5 años', 65, 120, 6, 24, 5),

  ],

};



/** Intervalo IMC gestacional (semanas) */

export const GESTATIONAL_BMI_INTERVAL: MinsaludChartInterval = {

  id: 'gestational',

  label: 'Edad gestacional',

  xAxis: 'gestational_weeks',

  xMin: 10,

  xMax: 42,

  yMin: 18,

  yMax: 40,

  xTickStep: 4,

  ageMinMonths: 0,

  ageMaxMonths: 0,

};



const INDICATOR_TITLES: Record<WhoIndicator, { M: string; F: string }> = {

  weight_for_age: { M: 'Peso para la Edad — Niños', F: 'Peso para la Edad — Niñas' },

  length_for_age: { M: 'Talla para la Edad — Niños', F: 'Talla para la Edad — Niñas' },

  head_circumference: { M: 'Perímetro Cefálico — Niños', F: 'Perímetro Cefálico — Niñas' },

  bmi_for_age: { M: 'IMC para la Edad — Niños', F: 'IMC para la Edad — Niñas' },

  weight_for_height: { M: 'Peso para la Talla — Niños', F: 'Peso para la Talla — Niñas' },

};



export function getMinsaludChartTitle(

  indicator: WhoIndicator,

  sex: 'M' | 'F',

  interval: MinsaludChartInterval

): string {

  const base = INDICATOR_TITLES[indicator][sex];

  return `${base} · Puntuación Z (${interval.label})`;

}



/** Intervalo recomendado según edad actual del paciente (eje edad) */

export function pickDefaultInterval(

  indicator: WhoIndicator,

  ageMonths: number

): MinsaludChartInterval {

  const intervals = MINSALUD_CHART_INTERVALS[indicator];

  const ageBased = intervals.filter((i) => i.xAxis === 'age_months');

  const pool = ageBased.length > 0 ? ageBased : intervals;

  const match = pool.find((i) => ageMonths >= i.xMin && ageMonths <= i.xMax);

  return match ?? pool[pool.length - 1];

}



/** Intervalo peso/talla según talla actual (cm) */

export function pickWeightForHeightInterval(heightCm: number): MinsaludChartInterval {

  const intervals = MINSALUD_CHART_INTERVALS.weight_for_height;

  const match = intervals.find((i) => heightCm >= i.xMin && heightCm <= i.xMax);

  return match ?? (heightCm < 65 ? intervals[0] : intervals[intervals.length - 1]);

}



/** Filtra mediciones al rango visible (eje X genérico) */

export function filterMeasurementsToInterval<T extends { x?: number; ageMonths?: number }>(

  measurements: T[],

  interval: MinsaludChartInterval

): T[] {

  return measurements.filter((m) => {

    const x = m.x ?? m.ageMonths ?? 0;

    return x >= interval.xMin && x <= interval.xMax;

  });

}



/** Genera puntos X para trazar curvas dentro del intervalo */

export function buildXSamples(interval: MinsaludChartInterval, step?: number): number[] {

  const span = interval.xMax - interval.xMin;

  const defaultStep =

    step ??

    (interval.xAxis === 'height_cm'

      ? 2

      : interval.xAxis === 'gestational_weeks'

        ? 1

        : span <= 24

          ? 0.5

          : span <= 60

            ? 1

            : 3);

  const xs: number[] = [];

  for (let x = interval.xMin; x <= interval.xMax; x += defaultStep) {

    xs.push(Math.round(x * 10) / 10);

  }

  return xs;

}



/** @deprecated use buildXSamples */

export function buildAgeSamples(interval: MinsaludChartInterval, step = 0.5): number[] {

  return buildXSamples(interval, step);

}



/** Etiqueta del eje X según tipo de intervalo */

export function formatXAxisLabel(x: number, interval: MinsaludChartInterval): string {

  if (interval.xAxis === 'height_cm') {

    return String(Math.round(x));

  }

  if (interval.xAxis === 'gestational_weeks') {

    return `${Math.round(x)}s`;

  }

  if (interval.xMax <= 24) {

    return String(Math.round(x));

  }

  if (x % 12 === 0) {

    return `${x / 12}a`;

  }

  return String(Math.round(x));

}



/** @deprecated use formatXAxisLabel */

export function formatAgeAxisLabel(ageMonths: number, interval: MinsaludChartInterval): string {

  return formatXAxisLabel(ageMonths, interval);

}



export function getXAxisLabel(interval: MinsaludChartInterval): string {

  if (interval.xAxis === 'height_cm') return 'Talla (cm)';

  if (interval.xAxis === 'gestational_weeks') return 'Semanas de gestación';

  return interval.xMax <= 24 ? 'Edad (meses)' : 'Edad (meses / años)';

}


