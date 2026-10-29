/**

 * Pediatric Growth Panel — curvas OMS por intervalos (Resolución MINSALUD 2465/2016)

 */



import React, { useMemo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { WHOGrowthChart } from './WHOGrowthChart';

import { calculateGrowthIndicators } from '@/lib/whoGrowthCharts';

import {

  buildBmiMeasurement,

  buildCurrentMeasurement,

  buildWeightForHeightMeasurement,

  getAgeMonthsFromBirthDate,

  getAgeMonthsFromFields,

  getAvailableIndicators,

  isWhoChartEligible,

  mapGenderToWhoSex,

  type WhoIndicator,

  type WhoMeasurement,

} from '@/lib/pediatricGrowthUtils';

import {

  getMinsaludChartTitle,

  MINSALUD_CHART_INTERVALS,

  MINSALUD_RESOLUTION_REF,

  pickDefaultInterval,

  pickWeightForHeightInterval,

  type MinsaludChartInterval,

} from '@/lib/minsalud2465ChartIntervals';

import { Activity, Baby, Ruler, Scale } from 'lucide-react';



export interface PediatricGrowthPanelProps {

  gender?: string | null;

  birthDate?: string | null;

  ageYears?: string | number | null;

  ageMonths?: string | number | null;

  weightKg?: string | number | null;

  heightCm?: string | number | null;

  headCircumferenceCm?: string | number | null;

  weightHistory?: WhoMeasurement[];

  measurementDate?: string;

  className?: string;

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

  bmi_for_age: { label: 'IMC / edad', short: 'IMC', icon: <Activity className="h-4 w-4" /> },

  weight_for_height: {

    label: 'Peso / talla',

    short: 'P/T',

    icon: <Scale className="h-4 w-4" />,

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

  if (c.includes('sobrepeso') || c.includes('obesidad') || c.includes('acelerado') || c.includes('delgadez'))

    return 'outline';

  return 'default';

}



function IndicatorChartBlock({

  indicator,

  sex,

  measurements,

  currentAgeMonths,

  heightCm,

  compact,

}: {

  indicator: WhoIndicator;

  sex: 'M' | 'F';

  measurements: WhoMeasurement[];

  currentAgeMonths: number;

  heightCm: number | null;

  compact: boolean;

}) {

  const intervals = MINSALUD_CHART_INTERVALS[indicator];

  const defaultInterval =

    indicator === 'weight_for_height' && heightCm

      ? pickWeightForHeightInterval(heightCm)

      : pickDefaultInterval(indicator, currentAgeMonths);

  const [intervalId, setIntervalId] = useState(defaultInterval.id);



  const activeInterval = useMemo(

    () => intervals.find((i) => i.id === intervalId) ?? defaultInterval,

    [intervals, intervalId, defaultInterval]

  );



  return (

    <div className="space-y-2">

      {intervals.length > 1 && (

        <div className="flex flex-wrap gap-1.5">

          {intervals.map((interval: MinsaludChartInterval) => (

            <button

              key={interval.id}

              type="button"

              onClick={() => setIntervalId(interval.id)}

              className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${

                interval.id === intervalId

                  ? 'bg-primary text-primary-foreground border-primary'

                  : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'

              }`}

            >

              {interval.label}

            </button>

          ))}

        </div>

      )}



      <WHOGrowthChart

        sex={sex}

        indicator={indicator}

        ageInterval={activeInterval}

        measurements={measurements}

        title={getMinsaludChartTitle(indicator, sex, activeInterval)}

        compact={compact}

      />

    </div>

  );

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



  const availableIndicators = useMemo(

    () => getAvailableIndicators(currentAgeMonths),

    [currentAgeMonths]

  );



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

    const history = weightHistory.length > 0 ? weightHistory : currentWeight;



    return {

      weight_for_age: history,

      length_for_age: buildCurrentMeasurement(currentAgeMonths, height, measurementDate),

      head_circumference: buildCurrentMeasurement(currentAgeMonths, head, measurementDate),

      bmi_for_age: buildBmiMeasurement(currentAgeMonths, weight, height, measurementDate),

      weight_for_height: buildWeightForHeightMeasurement(height ?? 0, weight, measurementDate),

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

            Las curvas del anexo MINSALUD 2465/2016 aplican hasta 17 años (204 meses).

            Edad actual: {currentAgeMonths.toFixed(1)} meses.

          </p>

        </CardContent>

      </Card>

    );

  }



  const defaultTab = availableIndicators[0] ?? 'length_for_age';

  const visibleZEntries = zScores

    ? (Object.entries(zScores.indicators) as [WhoIndicator, (typeof zScores.indicators)[string]][]).filter(

        ([key]) => availableIndicators.includes(key)

      )

    : [];



  const tabCols =

    availableIndicators.length <= 3

      ? 'grid-cols-3'

      : availableIndicators.length === 4

        ? 'grid-cols-4'

        : 'grid-cols-5';



  return (

    <Card className={`overflow-hidden ${compact ? 'border shadow-sm' : ''} ${className}`}>

      <CardHeader className={compact ? 'pb-2 pt-4 px-4' : 'pb-3'}>

        <div className="flex flex-wrap items-start justify-between gap-2">

          <div>

            <CardTitle className={compact ? 'text-sm' : 'text-base'}>

              Curvas OMS · MINSALUD 2465/2016

            </CardTitle>

            <p className="text-xs text-muted-foreground mt-0.5">

              {currentAgeMonths.toFixed(1)} meses · {sex === 'M' ? 'Niño' : 'Niña'} · por intervalo de edad

            </p>

          </div>

          {visibleZEntries.length > 0 && (

            <div className="flex flex-wrap gap-1.5">

              {visibleZEntries.map(([key, ind]) => (

                <Badge key={key} variant={classificationVariant(ind.classification)} className="text-[10px] px-1.5 py-0">

                  {INDICATOR_META[key].short}: Z {ind.zScore} (P{ind.percentile})

                </Badge>

              ))}

            </div>

          )}

        </div>

      </CardHeader>

      <CardContent className={compact ? 'space-y-3 px-4 pb-4 pt-0' : 'space-y-4'}>

        {!compact && visibleZEntries.length > 0 && (

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">

            {visibleZEntries.map(([key, ind]) => (

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

            ))}

          </div>

        )}



        <Tabs defaultValue={defaultTab} className="w-full">

          <TabsList className={`grid w-full ${tabCols} h-8`}>

            {availableIndicators.map((key) => (

              <TabsTrigger key={key} value={key} className="text-[10px] sm:text-xs gap-1 px-1">

                {INDICATOR_META[key].icon}

                <span className="truncate">{INDICATOR_META[key].short}</span>

              </TabsTrigger>

            ))}

          </TabsList>



          {availableIndicators.map((key) => (

            <TabsContent key={key} value={key} className="mt-2">

              <IndicatorChartBlock

                indicator={key}

                sex={sex}

                measurements={measurementsByIndicator[key]}

                currentAgeMonths={currentAgeMonths}

                heightCm={height}

                compact={compact}

              />

              {measurementsByIndicator[key].length === 0 && (

                <p className="text-xs text-muted-foreground text-center py-2">

                  Ingresa {INDICATOR_META[key].short.toLowerCase()} para ver la medición en la curva.

                </p>

              )}

            </TabsContent>

          ))}

        </Tabs>



        <p className="text-[10px] text-muted-foreground leading-relaxed border-t pt-2">

          {MINSALUD_RESOLUTION_REF}. Intervalos: peso/talla/edad 0–2 y 2–5 años; talla e IMC 5–17 años;

          peso/talla por talla (cm); perímetro cefálico 0–5 años.

        </p>

      </CardContent>

    </Card>

  );

};



export default PediatricGrowthPanel;

