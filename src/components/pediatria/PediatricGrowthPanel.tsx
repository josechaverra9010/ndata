/**
 * Pediatric Growth Panel — tabs + z-scores + WHO charts
 */

import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WHOGrowthChart } from './WHOGrowthChart';
import { calculateGrowthIndicators } from '@/lib/whoGrowthCharts';
import {
  buildCurrentMeasurement,
  getAgeMonthsFromBirthDate,
  getAgeMonthsFromFields,
  isWhoChartEligible,
  mapGenderToWhoSex,
  type WhoIndicator,
  type WhoMeasurement,
} from '@/lib/pediatricGrowthUtils';
import { Baby, Ruler, Scale } from 'lucide-react';

export interface PediatricGrowthPanelProps {
  /** Raw gender from form or patient profile */
  gender?: string | null;
  /** Birth date (preferred for accurate age) */
  birthDate?: string | null;
  /** Fallback age fields when birth date is unavailable */
  ageYears?: string | number | null;
  ageMonths?: string | number | null;
  /** Current measurements */
  weightKg?: string | number | null;
  heightCm?: string | number | null;
  headCircumferenceCm?: string | number | null;
  /** Historical weight points (e.g. from progress metrics) */
  weightHistory?: WhoMeasurement[];
  /** Measurement date for current values (defaults to today) */
  measurementDate?: string;
  className?: string;
  /** Compact layout for modals (default) */
  compact?: boolean;
}

const INDICATOR_META: Record<
  WhoIndicator,
  { label: string; short: string; icon: React.ReactNode }
> = {
  weight_for_age: { label: 'Peso / edad', short: 'Peso', icon: <Scale className="h-4 w-4" /> },
  length_for_age: { label: 'Talla / edad', short: 'Talla', icon: <Ruler className="h-4 w-4" /> },
  head_circumference: {
    label: 'P. cefálico / edad',
    short: 'P. cefálico',
    icon: <Baby className="h-4 w-4" />,
  },
};

function parseNum(v?: string | number | null): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function classificationVariant(classification: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const c = classification.toLowerCase();
  if (c.includes('sever') || c.includes('micro') || c.includes('macro')) return 'destructive';
  if (c.includes('moderad') || c.includes('retraso') || c.includes('bajo') || c.includes('riesgo')) return 'secondary';
  if (c.includes('sobrepeso') || c.includes('obesidad') || c.includes('acelerado')) return 'outline';
  return 'default';
}

export const PediatricGrowthPanel: React.FC<PediatricGrowthPanelProps> = ({
  gender,
  birthDate,
  ageYears,
  ageMonths,
  weightKg,
  heightCm,
  headCircumferenceCm,
  weightHistory = [],
  measurementDate,
  className = '',
  compact = true,
}) => {
  const sex = mapGenderToWhoSex(gender);
  const refDateIso = measurementDate ?? new Date().toISOString().slice(0, 10);
  const refDate = useMemo(() => new Date(refDateIso), [refDateIso]);

  const currentAgeMonths = useMemo(() => {
    const fromBirth = getAgeMonthsFromBirthDate(birthDate, refDate);
    if (fromBirth != null) return fromBirth;
    return getAgeMonthsFromFields(ageYears, ageMonths);
  }, [birthDate, ageYears, ageMonths, refDate]);

  const weight = parseNum(weightKg);
  const height = parseNum(heightCm);
  const head = parseNum(headCircumferenceCm);

  const zScores = useMemo(() => {
    if (!isWhoChartEligible(currentAgeMonths)) return null;
    const birth = birthDate ? new Date(birthDate) : null;
    if (!birth || Number.isNaN(birth.getTime())) {
      return calculateGrowthIndicators(
        new Date(refDate.getTime() - currentAgeMonths * 30.4375 * 24 * 60 * 60 * 1000),
        sex,
        weight ?? undefined,
        height ?? undefined,
        head ?? undefined,
        refDate
      );
    }
    return calculateGrowthIndicators(birth, sex, weight ?? undefined, height ?? undefined, head ?? undefined, refDate);
  }, [birthDate, currentAgeMonths, sex, weight, height, head, refDate]);

  const measurementsByIndicator = useMemo(() => {
    const currentWeight = buildCurrentMeasurement(currentAgeMonths, weight, measurementDate);
    const history =
      weightHistory.length > 0
        ? weightHistory
        : currentWeight;

    return {
      weight_for_age: history,
      length_for_age: buildCurrentMeasurement(currentAgeMonths, height, measurementDate),
      head_circumference: buildCurrentMeasurement(currentAgeMonths, head, measurementDate),
    } satisfies Record<WhoIndicator, WhoMeasurement[]>;
  }, [currentAgeMonths, weight, height, head, weightHistory, measurementDate]);

  if (!isWhoChartEligible(currentAgeMonths)) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Curvas de crecimiento OMS</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Las curvas WHO Child Growth Standards aplican de 0 a 60 meses (5 años).
            Edad actual: {currentAgeMonths.toFixed(1)} meses.
          </p>
        </CardContent>
      </Card>
    );
  }

  const availableTabs = (['weight_for_age', 'length_for_age', 'head_circumference'] as WhoIndicator[]).filter(
    (key) => measurementsByIndicator[key].length > 0 || zScores?.indicators[key]
  );

  const defaultTab = availableTabs[0] ?? 'weight_for_age';

  return (
    <Card className={`overflow-hidden ${compact ? 'border shadow-sm' : ''} ${className}`}>
      <CardHeader className={compact ? 'pb-2 pt-4 px-4' : 'pb-3'}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className={compact ? 'text-sm' : 'text-base'}>
              Curvas OMS (0–60 meses)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentAgeMonths.toFixed(1)} meses · {sex === 'M' ? 'Niño' : 'Niña'}
            </p>
          </div>
          {zScores && Object.keys(zScores.indicators).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(zScores.indicators) as [WhoIndicator, (typeof zScores.indicators)[string]][]).map(
                ([key, ind]) => (
                  <Badge key={key} variant={classificationVariant(ind.classification)} className="text-[10px] px-1.5 py-0">
                    {INDICATOR_META[key].short}: P{ind.percentile}
                  </Badge>
                )
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={compact ? 'space-y-3 px-4 pb-4 pt-0' : 'space-y-4'}>
        {!compact && zScores && Object.keys(zScores.indicators).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(zScores.indicators) as [WhoIndicator, (typeof zScores.indicators)[string]][]).map(
              ([key, ind]) => (
                <div key={key} className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    {INDICATOR_META[key].icon}
                    {INDICATOR_META[key].label}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {ind.measurement}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{ind.unit}</span>
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Z: {ind.zScore} · Percentil {ind.percentile}
                  </p>
                  <p className="text-xs font-medium mt-1">{ind.classification}</p>
                </div>
              )
            )}
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            {(Object.keys(INDICATOR_META) as WhoIndicator[]).map((key) => (
              <TabsTrigger key={key} value={key} className="text-[11px] sm:text-xs gap-1 px-1">
                {INDICATOR_META[key].icon}
                <span className="truncate">{INDICATOR_META[key].short}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(INDICATOR_META) as WhoIndicator[]).map((key) => (
            <TabsContent key={key} value={key} className="mt-2">
              <div className="w-full max-w-full">
                <WHOGrowthChart
                  sex={sex}
                  indicator={key}
                  measurements={measurementsByIndicator[key]}
                  compact={compact}
                />
              </div>
              {measurementsByIndicator[key].length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Ingresa {INDICATOR_META[key].short.toLowerCase()} para ver la medición en la curva.
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PediatricGrowthPanel;
