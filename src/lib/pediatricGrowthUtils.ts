import { calculateAgeMonths } from './whoGrowthCharts';

export type WhoSex = 'M' | 'F';

export type WhoIndicator = 'weight_for_age' | 'length_for_age' | 'head_circumference';

export interface WhoMeasurement {
  ageMonths: number;
  value: number;
  date?: string;
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

/** Whether patient is within WHO 0–60 month charts */
export function isWhoChartEligible(ageMonths: number): boolean {
  return ageMonths >= 0 && ageMonths <= 60;
}

/** Parse numeric clinical value (handles comma decimals) */
export function parseClinicalNumber(value?: string | number | null): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Build a single current measurement point */
export function buildCurrentMeasurement(
  ageMonths: number,
  value: number | null | undefined,
  date?: string
): WhoMeasurement[] {
  if (value == null || value <= 0 || !isWhoChartEligible(ageMonths)) return [];
  return [{ ageMonths, value, date }];
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
    .map((m) => ({
      ageMonths: calculateAgeMonths(birth, new Date(m.date)),
      value: m.weight,
      date: m.date,
    }))
    .filter((m) => isWhoChartEligible(m.ageMonths))
    .sort((a, b) => a.ageMonths - b.ageMonths);
}
