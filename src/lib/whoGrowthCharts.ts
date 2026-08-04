/**
 * WHO Growth Charts Integration
 * Functions to calculate z-scores and generate growth charts for pediatric patients
 */

// LMS Parameters for WHO Child Growth Standards (0-60 months)
export const WHO_LMS_DATA = {
  weight_for_age_boys: {
    0: { L: -1.3361, M: 3.3464, S: 0.14171 },
    1: { L: -1.2653, M: 4.3013, S: 0.12595 },
    2: { L: -1.1849, M: 5.1075, S: 0.11454 },
    3: { L: -1.0961, M: 5.8081, S: 0.10641 },
    6: { L: -0.7853, M: 7.3365, S: 0.09220 },
    12: { L: -0.3522, M: 9.3075, S: 0.08366 },
    24: { L: 0.2581, M: 12.8320, S: 0.08234 },
    36: { L: 0.6017, M: 15.7730, S: 0.08578 },
    48: { L: 0.8623, M: 18.4220, S: 0.08883 },
    60: { L: 1.0788, M: 20.6280, S: 0.09053 },
  },
  weight_for_age_girls: {
    0: { L: -1.3225, M: 3.2315, S: 0.14657 },
    1: { L: -1.2529, M: 4.1850, S: 0.13049 },
    2: { L: -1.1757, M: 4.9735, S: 0.11883 },
    3: { L: -1.0917, M: 5.6448, S: 0.11050 },
    6: { L: -0.7849, M: 7.0997, S: 0.09620 },
    12: { L: -0.3697, M: 8.8871, S: 0.08810 },
    24: { L: 0.2366, M: 12.0005, S: 0.08656 },
    36: { L: 0.5889, M: 14.6450, S: 0.08923 },
    48: { L: 0.8506, M: 17.0050, S: 0.09195 },
    60: { L: 1.0705, M: 19.0280, S: 0.09358 },
  },
  length_for_age_boys: {
    0: { L: 0.3183, M: 49.9, S: 0.03594 },
    1: { L: 0.3092, M: 54.7, S: 0.03346 },
    2: { L: 0.3006, M: 58.4, S: 0.03154 },
    3: { L: 0.2924, M: 61.4, S: 0.03027 },
    6: { L: 0.2710, M: 67.6, S: 0.02804 },
    12: { L: 0.2463, M: 75.7, S: 0.02657 },
    24: { L: 0.2058, M: 87.0, S: 0.02569 },
    36: { L: 0.1765, M: 95.3, S: 0.02541 },
    48: { L: 0.1523, M: 102.3, S: 0.02529 },
    60: { L: 0.1330, M: 108.2, S: 0.02516 },
  },
  length_for_age_girls: {
    0: { L: 0.3181, M: 49.2, S: 0.03765 },
    1: { L: 0.3090, M: 54.0, S: 0.03489 },
    2: { L: 0.3004, M: 57.7, S: 0.03272 },
    3: { L: 0.2923, M: 60.6, S: 0.03118 },
    6: { L: 0.2711, M: 66.7, S: 0.02872 },
    12: { L: 0.2463, M: 74.3, S: 0.02704 },
    24: { L: 0.2060, M: 85.3, S: 0.02605 },
    36: { L: 0.1768, M: 93.3, S: 0.02570 },
    48: { L: 0.1526, M: 100.0, S: 0.02556 },
    60: { L: 0.1333, M: 105.6, S: 0.02541 },
  },
  head_circumference_boys: {
    0: { L: 1.0961, M: 34.3, S: 0.03730 },
    1: { L: 1.0788, M: 37.3, S: 0.03480 },
    2: { L: 1.0627, M: 39.4, S: 0.03290 },
    3: { L: 1.0477, M: 41.0, S: 0.03155 },
    6: { L: 1.0101, M: 43.8, S: 0.02887 },
    12: { L: 0.9544, M: 46.4, S: 0.02655 },
    24: { L: 0.8881, M: 48.8, S: 0.02535 },
    36: { L: 0.8330, M: 50.3, S: 0.02483 },
    48: { L: 0.7886, M: 51.5, S: 0.02454 },
    60: { L: 0.7533, M: 52.4, S: 0.02433 },
  },
  head_circumference_girls: {
    0: { L: 1.0815, M: 33.7, S: 0.03910 },
    1: { L: 1.0642, M: 36.7, S: 0.03643 },
    2: { L: 1.0481, M: 38.8, S: 0.03433 },
    3: { L: 1.0331, M: 40.3, S: 0.03280 },
    6: { L: 0.9954, M: 42.9, S: 0.02994 },
    12: { L: 0.9397, M: 45.2, S: 0.02749 },
    24: { L: 0.8733, M: 47.4, S: 0.02619 },
    36: { L: 0.8181, M: 48.8, S: 0.02562 },
    48: { L: 0.7737, M: 49.9, S: 0.02531 },
    60: { L: 0.7384, M: 50.7, S: 0.02510 },
  },
};

/**
 * Calculate age in months from birth date
 */
export function calculateAgeMonths(birthDate: Date, measurementDate: Date = new Date()): number {
  const ageMs = measurementDate.getTime() - birthDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays / 30.4375; // Average days per month
}

/**
 * Interpolate LMS values for a given age using linear interpolation
 */
export function interpolateLMS(
  ageMonths: number,
  lmsTable: Record<number, { L: number; M: number; S: number }>
): { L: number; M: number; S: number } {
  const ages = Object.keys(lmsTable).map(Number).sort((a, b) => a - b);

  if (ageMonths <= ages[0]) {
    const { L, M, S } = lmsTable[ages[0]];
    return { L, M, S };
  }

  if (ageMonths >= ages[ages.length - 1]) {
    const { L, M, S } = lmsTable[ages[ages.length - 1]];
    return { L, M, S };
  }

  for (let i = 0; i < ages.length - 1; i++) {
    if (ages[i] <= ageMonths && ageMonths <= ages[i + 1]) {
      const age1 = ages[i];
      const age2 = ages[i + 1];
      const { L: L1, M: M1, S: S1 } = lmsTable[age1];
      const { L: L2, M: M2, S: S2 } = lmsTable[age2];

      const t = (ageMonths - age1) / (age2 - age1);
      const L = L1 + t * (L2 - L1);
      const M = M1 + t * (M2 - M1);
      const S = S1 + t * (S2 - S1);

      return { L, M, S };
    }
  }

  const { L, M, S } = lmsTable[ages[ages.length - 1]];
  return { L, M, S };
}

/**
 * Calculate z-score using LMS method
 */
export function calculateZScore(measurement: number, L: number, M: number, S: number): number {
  if (M <= 0 || S <= 0) return 0;

  let zScore: number;
  if (L === 0) {
    // Logarithmic transformation
    zScore = Math.log(measurement / M) / S;
  } else {
    // Box-Cox transformation
    zScore = (Math.pow(measurement / M, L) - 1) / (L * S);
  }

  // Clamp between -3 and 3
  return Math.max(-3, Math.min(3, zScore));
}

/**
 * Convert z-score to percentile using normal distribution approximation
 */
export function zScoreToPercentile(zScore: number): number {
  // Approximation using error function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = zScore < 0 ? -1 : 1;
  const x = Math.abs(zScore) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  const percentile = 50 * (1 + sign * y);
  return Math.max(0.1, Math.min(99.9, percentile));
}

/**
 * Classify nutritional status based on z-score
 */
export function classifyNutritionalStatus(zScore: number, indicator: string = 'weight_for_age'): string {
  if (indicator === 'weight_for_age') {
    if (zScore < -2) return 'Desnutrición severa';
    if (zScore < -1) return 'Desnutrición moderada';
    if (zScore < 1) return 'Normal';
    if (zScore < 2) return 'Riesgo de sobrepeso';
    return 'Sobrepeso/Obesidad';
  }

  if (indicator === 'length_for_age') {
    if (zScore < -2) return 'Retraso severo del crecimiento';
    if (zScore < -1) return 'Retraso del crecimiento';
    if (zScore < 1) return 'Normal';
    return 'Crecimiento acelerado';
  }

  if (indicator === 'head_circumference') {
    if (zScore < -2) return 'Microcefalia';
    if (zScore < -1) return 'Perímetro cefálico bajo';
    if (zScore < 1) return 'Normal';
    return 'Macrocefalia';
  }

  return 'Normal';
}

/**
 * Calculate all growth indicators for a child
 */
export function calculateGrowthIndicators(
  birthDate: Date,
  sex: 'M' | 'F',
  weight?: number,
  length?: number,
  headCircumference?: number,
  measurementDate: Date = new Date()
): ZScoreResult {
  const ageMonths = calculateAgeMonths(birthDate, measurementDate);

  const indicators: Record<string, GrowthIndicator> = {};

  // Weight-for-age
  if (weight !== undefined && ageMonths <= 60) {
    const lmsTable = sex === 'M' ? WHO_LMS_DATA.weight_for_age_boys : WHO_LMS_DATA.weight_for_age_girls;
    const { L, M, S } = interpolateLMS(ageMonths, lmsTable);
    const zScore = calculateZScore(weight, L, M, S);
    const percentile = zScoreToPercentile(zScore);

    indicators.weight_for_age = {
      measurement: weight,
      unit: 'kg',
      L,
      M,
      S,
      zScore: Math.round(zScore * 100) / 100,
      percentile: Math.round(percentile * 10) / 10,
      classification: classifyNutritionalStatus(zScore, 'weight_for_age'),
    };
  }

  // Length-for-age
  if (length !== undefined && ageMonths <= 60) {
    const lmsTable = sex === 'M' ? WHO_LMS_DATA.length_for_age_boys : WHO_LMS_DATA.length_for_age_girls;
    const { L, M, S } = interpolateLMS(ageMonths, lmsTable);
    const zScore = calculateZScore(length, L, M, S);
    const percentile = zScoreToPercentile(zScore);

    indicators.length_for_age = {
      measurement: length,
      unit: 'cm',
      L,
      M,
      S,
      zScore: Math.round(zScore * 100) / 100,
      percentile: Math.round(percentile * 10) / 10,
      classification: classifyNutritionalStatus(zScore, 'length_for_age'),
    };
  }

  // Head circumference-for-age
  if (headCircumference !== undefined && ageMonths <= 60) {
    const lmsTable = sex === 'M' ? WHO_LMS_DATA.head_circumference_boys : WHO_LMS_DATA.head_circumference_girls;
    const { L, M, S } = interpolateLMS(ageMonths, lmsTable);
    const zScore = calculateZScore(headCircumference, L, M, S);
    const percentile = zScoreToPercentile(zScore);

    indicators.head_circumference = {
      measurement: headCircumference,
      unit: 'cm',
      L,
      M,
      S,
      zScore: Math.round(zScore * 100) / 100,
      percentile: Math.round(percentile * 10) / 10,
      classification: classifyNutritionalStatus(zScore, 'head_circumference'),
    };
  }

  return {
    ageMonths: Math.round(ageMonths * 10) / 10,
    sex,
    indicators,
  };
}

/**
 * Generate percentile curve data for charting
 */
export function generatePercentileCurveData(
  lmsTable: Record<number, { L: number; M: number; S: number }>,
  percentile: number,
  ageRange: number[] = Array.from({ length: 121 }, (_, i) => i * 0.5)
): Array<{ age: number; value: number }> {
  const zScore = percentileToZScore(percentile);
  const data: Array<{ age: number; value: number }> = [];

  for (const age of ageRange) {
    const { L, M, S } = interpolateLMS(age, lmsTable);

    let measurement: number;
    if (L === 0) {
      measurement = M * Math.exp(zScore * S);
    } else {
      measurement = M * Math.pow(1 + L * S * zScore, 1 / L);
    }

    data.push({ age, value: measurement });
  }

  return data;
}

/**
 * Convert percentile to z-score using inverse normal distribution approximation
 */
function percentileToZScore(percentile: number): number {
  if (percentile === 50) return 0;

  const p = percentile / 100;
  if (p < 0.5) {
    const t = Math.sqrt(Math.log(1 / (p * p)));
    return -(t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
  } else {
    const t = Math.sqrt(Math.log(1 / ((1 - p) * (1 - p))));
    return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  }
}

export interface GrowthIndicator {
  measurement: number;
  unit: string;
  L: number;
  M: number;
  S: number;
  zScore: number;
  percentile: number;
  classification: string;
}

export interface ZScoreResult {
  ageMonths: number;
  sex: 'M' | 'F';
  indicators: Record<string, GrowthIndicator>;
}
