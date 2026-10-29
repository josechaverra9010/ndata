/**
 * Utilidades compartidas para módulos por especialidad
 */

import {
  getAtalahClass,
  getGestanteDebioGanar,
  getGestanteExpectedGainKg,
  getTrimestreFromSemana,
} from './foodNutrients';
import { calculateGrowthIndicators } from './whoGrowthCharts';
import {
  buildWeightMeasurementsFromHistory,
  getAgeMonthsFromBirthDate,
  isWhoChartEligible,
  mapGenderToWhoSex,
} from './pediatricGrowthUtils';

export type SpecialtyTipo =
  | 'pediatria'
  | 'gestante'
  | 'gestante_adolescente'
  | 'geriatrico'
  | 'deportista'
  | 'hospitalizado'
  | 'adulto';

export const SPECIALTY_LABELS: Record<string, string> = {
  pediatria: 'Pediatría',
  gestante: 'Gestante',
  gestante_adolescente: 'Gestante adolescente',
  geriatrico: 'Geriátrico',
  deportista: 'Deportista',
  hospitalizado: 'Hospitalizado',
  adulto: 'Adulto',
};

export const PRENATAL_CHECKLIST_ITEMS = [
  { id: 'acido_folico', label: 'Ácido fólico / vitaminas prenatales' },
  { id: 'hierro', label: 'Suplemento de hierro indicado' },
  { id: 'calcio', label: 'Aporte adecuado de calcio' },
  { id: 'control_prenatal', label: 'Controles prenatales al día' },
  { id: 'hidratacion', label: 'Hidratación ≥ 2 L/día' },
  { id: 'sin_tabaquismo', label: 'Sin alcohol / tabaco' },
  { id: 'actividad', label: 'Actividad física moderada autorizada' },
  { id: 'peso_semanal', label: 'Registro de peso semanal' },
] as const;

export const ALTA_HOSPITAL_CHECKLIST = [
  { id: 'tolerancia_oral', label: 'Tolerancia oral adecuada' },
  { id: 'peso_estable', label: 'Peso estable 48–72 h' },
  { id: 'plan_entregado', label: 'Plan de alta nutricional entregado' },
  { id: 'cita_seguimiento', label: 'Cita de seguimiento programada' },
  { id: 'educacion_familiar', label: 'Educación a familia/cuidador' },
] as const;

export const DEPORTISTA_PHASES = [
  { id: 'pre', label: 'Pre-competencia', hint: '3–7 días antes: énfasis en CHO e hidratación' },
  { id: 'during', label: 'Durante', hint: 'Hidratación y CHO según duración/intensidad' },
  { id: 'post', label: 'Post-competencia', hint: 'Ventana 30–60 min: CHO + proteína' },
] as const;

/** Pliegues cutáneos para endomorfia (Heath-Carter / EVANUT Deportista) */
export const DEPORTISTA_PLIEGUES_ENDOMORFIA = [
  {
    key: 'deportista_triceps',
    label: 'Tríceps',
    apellido: 'Tricipital',
    site: 'Cara posterior del brazo',
  },
  {
    key: 'deportista_subescapular',
    label: 'Subescapular',
    apellido: 'Infraescapular',
    site: 'Ángulo inferior de la escápula',
  },
  {
    key: 'deportista_supraespinal',
    label: 'Supraespinal',
    apellido: 'Supraspinal',
    site: 'Sobre la cresta ilíaca (pliegue natural)',
  },
] as const;

export function getDeportistaSumatoriaPliegues(fase1: Record<string, unknown>): number | null {
  const values = DEPORTISTA_PLIEGUES_ENDOMORFIA.map((p) => parseNum(fase1[p.key]));
  if (values.some((v) => v == null || v <= 0)) return null;
  return Number(values.reduce((sum, v) => sum + (v ?? 0), 0).toFixed(2));
}

/** Perímetro braquial en cm; pliegue tricipital en mm → PMB (cm) */
export function calcPerimetroMuscularBrazoCm(perimBrazoCm: number, pliegueTricipitalMm: number): number {
  if (!(perimBrazoCm > 0)) return 0;
  return perimBrazoCm - Math.PI * (pliegueTricipitalMm / 10);
}

export function calcBraquialAreasFromCm(perimBrazoCm: number, pmbCm: number) {
  const areaMuscularBrazo = pmbCm > 0 ? (pmbCm ** 2) / (4 * Math.PI) : 0;
  const areaTotalBrazo = perimBrazoCm > 0 ? (Math.PI / 4) * (perimBrazoCm / Math.PI) ** 2 : 0;
  return {
    areaMuscularBrazo,
    areaTotalBrazo,
    areaGrasaBrazo: areaTotalBrazo - areaMuscularBrazo,
  };
}

/** Lee perímetro braquial en cm (compatibilidad con planes guardados en mm) */
export function readPerimBrazoCm(data: Record<string, unknown>, prefix: 'pediatria' | 'gestante'): number {
  const cm = parseNum(data[`${prefix}_perim_brazo_cm`]);
  if (cm != null && cm > 0) return cm;
  const legacyMm = parseNum(data[`${prefix}_perim_brazo_mm`]);
  if (legacyMm != null && legacyMm > 0) return legacyMm / 10;
  return 0;
}

/** Convierte PMB almacenado (legacy mm) a cm para mostrar */
export function toPmbCm(stored: unknown): number | null {
  const n = parseNum(stored);
  if (n == null || n <= 0) return null;
  return n > 50 ? n / 10 : n;
}

/** Convierte áreas almacenadas (legacy mm²) a cm² para mostrar */
export function toAreaCm2(stored: unknown): number | null {
  const n = parseNum(stored);
  if (n == null || n <= 0) return null;
  return n > 500 ? n / 100 : n;
}

/** Campos antropométricos pediátricos: perímetros en cm, pliegues en mm */
export const PEDIATRIA_PERIMETROS = [
  { key: 'pediatria_perimetro_cefalico', label: 'Perímetro cefálico', unit: 'cm' },
  { key: 'pediatria_perim_brazo_cm', label: 'Perímetro braquial', unit: 'cm' },
] as const;

export const PEDIATRIA_PLIEGUES = [
  { key: 'pediatria_pliegue_tricipital_mm', label: 'Pliegue tricipital', unit: 'mm' },
  { key: 'pediatria_pliegue_subescapular_mm', label: 'Pliegue subescapular', unit: 'mm' },
] as const;

/** MNA-SF simplificado (6 ítems, máx 14 puntos) */
export const MNA_SF_QUESTIONS = [
  {
    id: 'food_intake',
    label: '¿Ha disminuido la ingesta de alimentos en los últimos 3 meses?',
    options: [
      { value: 0, label: 'Disminución severa' },
      { value: 1, label: 'Disminución moderada' },
      { value: 2, label: 'Sin disminución' },
    ],
  },
  {
    id: 'weight_loss',
    label: 'Pérdida de peso en los últimos 3 meses',
    options: [
      { value: 0, label: '> 3 kg' },
      { value: 1, label: 'No sabe' },
      { value: 2, label: '1–3 kg' },
      { value: 3, label: 'Sin pérdida' },
    ],
  },
  {
    id: 'mobility',
    label: 'Movilidad',
    options: [
      { value: 0, label: 'Cama o silla' },
      { value: 1, label: 'Sale de casa con dificultad' },
      { value: 2, label: 'Sale de casa' },
    ],
  },
  {
    id: 'stress',
    label: '¿Enfermedad aguda o estrés psicológico?',
    options: [
      { value: 0, label: 'Sí' },
      { value: 2, label: 'No' },
    ],
  },
  {
    id: 'neuro',
    label: 'Problemas neuropsicológicos',
    options: [
      { value: 0, label: 'Demencia o depresión severa' },
      { value: 1, label: 'Leve' },
      { value: 2, label: 'Ninguno' },
    ],
  },
  {
    id: 'bmi',
    label: 'IMC (kg/m²)',
    options: [
      { value: 0, label: '< 19' },
      { value: 1, label: '19 – < 21' },
      { value: 2, label: '21 – < 23' },
      { value: 3, label: '≥ 23' },
    ],
  },
] as const;

export function scoreMnaSf(answers: Record<string, number>): { score: number; classification: string } {
  const score = MNA_SF_QUESTIONS.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
  let classification = 'Riesgo de desnutrición';
  if (score >= 12) classification = 'Estado nutricional normal';
  else if (score >= 8) classification = 'Riesgo de desnutrición';
  else classification = 'Desnutrido';
  return { score, classification };
}

export function buildGestanteSummary(fase1: Record<string, unknown>, currentWeight?: number | null) {
  const semana = parseFloat(String(fase1.gestante_semana ?? '')) || 0;
  const pesoPreg = parseFloat(String(fase1.gestante_peso_preg ?? fase1.gestante_peso_pregestacional ?? '')) || 0;
  const estaturaM = parseFloat(String(fase1.gestante_estatura_m ?? '')) || 0;
  const pesoActual = (currentWeight ?? parseFloat(String(fase1.gestante_peso_actual ?? ''))) || 0;
  const imcPreg = pesoPreg && estaturaM
    ? pesoPreg / (estaturaM * estaturaM)
    : (parseFloat(String(fase1.imc_pregestacional ?? '')) || 0);
  const atalah = (fase1.clasificacion_atalah as string) || getAtalahClass(imcPreg);
  const trimestre = getTrimestreFromSemana(semana || 1);
  const expected = getGestanteExpectedGainKg(atalah as 'Bajo' | 'Normal' | 'Sobrepeso' | 'Obesidad' | '');
  const debioGanar = getGestanteDebioGanar(semana, expected.t1, expected.t23);
  const gananciaPresentada = pesoActual && pesoPreg ? pesoActual - pesoPreg : null;
  const diff = gananciaPresentada != null ? gananciaPresentada - debioGanar : null;

  return {
    semana,
    trimestre,
    imcPregestacional: imcPreg > 0 ? Number(imcPreg.toFixed(1)) : null,
    clasificacionAtalah: atalah,
    debioGanar: Number(debioGanar.toFixed(2)),
    gananciaPresentada: gananciaPresentada != null ? Number(gananciaPresentada.toFixed(2)) : null,
    gananciaEsperadaTotal: expected.t1 + expected.t23,
    diffVsEsperado: diff != null ? Number(diff.toFixed(2)) : null,
    status:
      diff == null
        ? 'unknown'
        : diff > 2
          ? 'above'
          : diff < -2
            ? 'below'
            : 'on_track',
    caloriasAdicionales: fase1.calorias_adicionales,
    requerimientoKcal: fase1.requerimiento_energetico,
  };
}

export function buildPediatricZAlerts(
  birthDate: string | null | undefined,
  gender: string | null | undefined,
  weight?: number | null,
  height?: number | null,
  headCm?: number | null
) {
  if (!birthDate) return [];
  const ageMonths = getAgeMonthsFromBirthDate(birthDate);
  if (ageMonths == null || !isWhoChartEligible(ageMonths)) return [];

  const sex = mapGenderToWhoSex(gender);
  const birth = new Date(birthDate);
  const result = calculateGrowthIndicators(
    birth,
    sex,
    weight ?? undefined,
    height ?? undefined,
    headCm ?? undefined
  );

  const alerts: { indicator: string; percentile: number; zScore: number; message: string }[] = [];
  const labels: Record<string, string> = {
    weight_for_age: 'Peso/edad',
    length_for_age: 'Talla/edad',
    head_circumference: 'P. cefálico/edad',
    bmi_for_age: 'IMC/edad',
    weight_for_height: 'Peso/talla',
  };

  for (const [key, ind] of Object.entries(result.indicators)) {
    if (ind.percentile < 3 || ind.percentile > 97) {
      alerts.push({
        indicator: key,
        percentile: ind.percentile,
        zScore: ind.zScore,
        message: `${labels[key] || key}: P${ind.percentile} (Z=${ind.zScore}) — ${ind.classification}`,
      });
    }
  }
  return alerts;
}

export function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function isSpecialtyTipo(tipo?: string | null): tipo is SpecialtyTipo {
  return !!tipo && tipo !== 'adulto' && tipo in SPECIALTY_LABELS;
}
