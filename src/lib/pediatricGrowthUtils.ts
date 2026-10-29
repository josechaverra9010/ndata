import { calculateAgeMonths } from './whoGrowthCharts';

export type WhoSex = 'M' | 'F';

export type WhoIndicator =
  | 'weight_for_age'
  | 'length_for_age'
  | 'head_circumference'
  | 'bmi_for_age'
  | 'weight_for_height';

export interface WhoMeasurement {
  /** Eje X: meses, talla (cm) o semanas según gráfica */
  x: number;
  value: number;
  date?: string;
  /** Compatibilidad: alias de x cuando el eje es edad en meses */
  ageMonths?: number;
}

/** Whether patient is within WHO 0–60 month infant charts */
export function isWhoInfantChartEligible(ageMonths: number): boolean {
  return ageMonths >= 0 && ageMonths <= 60;
}

/** Perímetro cefálico: medida habitual en lactantes y niños hasta ~5 años (OMS). */
export function isHeadCircumferenceAgeEligible(birthDate?: string | Date | null): boolean {
  const months = getAgeMonthsFromBirthDate(birthDate);
  return months != null && isWhoInfantChartEligible(months);
}

/** Whether school-age height/BMI charts apply (5–17 years) */
export function isWhoSchoolChartEligible(ageMonths: number): boolean {
  return ageMonths >= 61 && ageMonths <= 204;
}

/** Whether any pediatric growth chart applies (0–17 years) */
export function isWhoChartEligible(ageMonths: number): boolean {
  return ageMonths >= 0 && ageMonths <= 204;
}

/** Indicators available for a given age */
export function getAvailableIndicators(ageMonths: number): WhoIndicator[] {
  const all: WhoIndicator[] = [
    'weight_for_age',
    'length_for_age',
    'head_circumference',
    'bmi_for_age',
    'weight_for_height',
  ];
  if (ageMonths <= 60) return all;
  if (ageMonths <= 204) return ['length_for_age', 'bmi_for_age'];
  return [];
}

/** Map app gender strings to WHO sex codes */
export function mapGenderToWhoSex(gender?: string | null): WhoSex {
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'hombre' || g === 'masculino' || g === 'm' || g === 'male' || g === 'varon') {
    return 'M';
  }
  return 'F';
}

/** Age in months from years + remainder months fields */
export function getAgeMonthsFromFields(
  years?: string | number | null,
  months?: string | number | null
): number {
  const y = parseFloat(String(years ?? '')) || 0;
  const m = parseFloat(String(months ?? '')) || 0;
  return y * 12 + m;
}

/** Age in months from birth date */
export function getAgeMonthsFromBirthDate(
  birthDate?: string | Date | null,
  referenceDate: Date = new Date()
): number | null {
  if (!birthDate) return null;
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  return calculateAgeMonths(birth, referenceDate);
}

/** Parse numeric clinical value (handles comma decimals) */
export function parseClinicalNumber(value?: string | number | null): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toMeasurement(x: number, value: number, date?: string): WhoMeasurement {
  return { x, ageMonths: x, value, date };
}

/** Build a single current measurement point (age-based) */
export function buildCurrentMeasurement(
  ageMonths: number,
  value: number | null | undefined,
  date?: string
): WhoMeasurement[] {
  if (value == null || value <= 0 || !isWhoChartEligible(ageMonths)) return [];
  return [toMeasurement(ageMonths, value, date)];
}

/** Build weight-for-height point (x = height cm, value = weight kg) */
export function buildWeightForHeightMeasurement(
  heightCm: number,
  weightKg: number | null | undefined,
  date?: string
): WhoMeasurement[] {
  if (weightKg == null || weightKg <= 0 || heightCm <= 0) return [];
  if (heightCm < 45 || heightCm > 120) return [];
  return [{ x: heightCm, value: weightKg, date }];
}

/** Build BMI measurement at current age */
export function buildBmiMeasurement(
  ageMonths: number,
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  date?: string
): WhoMeasurement[] {
  if (!weightKg || !heightCm || heightCm <= 0) return [];
  if (!isWhoChartEligible(ageMonths)) return [];
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return [toMeasurement(ageMonths, bmi, date)];
}

/** Build weight history for WHO chart from progress metrics */
export function buildWeightMeasurementsFromHistory(
  birthDate: string,
  metrics: { date: string; weight: number }[]
): WhoMeasurement[] {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return [];

  return metrics
    .filter((m) => m.weight > 0)
    .map((m) => {
      const ageMonths = calculateAgeMonths(birth, new Date(m.date));
      return toMeasurement(ageMonths, m.weight, m.date);
    })
    .filter((m) => isWhoInfantChartEligible(m.x))
    .sort((a, b) => a.x - b.x);
}
