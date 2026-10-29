/**
 * IMC para la edad gestacional — Resolución MINSALUD 2465/2016
 */

import React, { useMemo } from 'react';
import { generateZScoreCurveData, interpolateLMS, calculateZScore } from '@/lib/whoGrowthCharts';
import { GESTATIONAL_BMI_BY_WEEK } from '@/lib/whoLmsExtended';
import {
  buildXSamples,
  GESTATIONAL_BMI_INTERVAL,
  MINSALUD_RESOLUTION_REF,
  Z_SCORE_COLORS,
  Z_SCORE_LINES,
} from '@/lib/minsalud2465ChartIntervals';
import { cn } from '@/lib/utils';

export interface GestationalMeasurement {
  week: number;
  bmi: number;
  date?: string;
}

interface GestationalBMIChartProps {
  /** Categoría Atalah pregestacional */
  atalahCategory: 'Bajo' | 'Normal' | 'Sobrepeso' | 'Obesidad' | '';
  measurements?: GestationalMeasurement[];
  title?: string;
  compact?: boolean;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Bajo: '#2563eb',
  Normal: '#16a34a',
  Sobrepeso: '#f97316',
  Obesidad: '#dc2626',
};

export function GestationalBMIChart({
  atalahCategory,
  measurements = [],
  title,
  compact = false,
  className,
}: GestationalBMIChartProps) {
  const width = compact ? 560 : 800;
  const height = compact ? 320 : 500;
  const margin = compact
    ? { top: 44, right: 52, bottom: 48, left: 52 }
    : { top: 72, right: 72, bottom: 72, left: 72 };

  const interval = GESTATIONAL_BMI_INTERVAL;
  const { xMin, xMax, yMin, yMax, xTickStep } = interval;
  const xSpan = xMax - xMin;
  const xSamples = useMemo(() => buildXSamples(interval, 1), [interval]);

  const referenceTable =
    GESTATIONAL_BMI_BY_WEEK[atalahCategory as keyof typeof GESTATIONAL_BMI_BY_WEEK] ??
    GESTATIONAL_BMI_BY_WEEK.Normal;

  const zScoreCurves = useMemo(() => {
    const curves: Record<number, Array<{ x: number; value: number }>> = {};
    for (const z of Z_SCORE_LINES) {
      curves[z] = generateZScoreCurveData(referenceTable, z, xSamples);
    }
    return curves;
  }, [referenceTable, xSamples]);

  const visibleMeasurements = measurements.filter(
    (m) => m.week >= xMin && m.week <= xMax && m.bmi > 0
  );

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const scaleX = (x: number) => margin.left + ((x - xMin) / xSpan) * plotWidth;
  const scaleY = (value: number) =>
    margin.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const currentZ =
    visibleMeasurements.length > 0
      ? (() => {
          const last = visibleMeasurements[visibleMeasurements.length - 1];
          const { L, M, S } = interpolateLMS(last.week, referenceTable);
          return calculateZScore(last.bmi, L, M, S);
        })()
      : null;

  const chartTitle =
    title ??
    `IMC para la Edad Gestacional${atalahCategory ? ` · ${atalahCategory}` : ''}`;

  const gridLines: React.ReactNode[] = [];
  for (let x = xMin; x <= xMax; x += xTickStep) {
    gridLines.push(
      <line
        key={`gx-${x}`}
        x1={scaleX(x)}
        y1={margin.top}
        x2={scaleX(x)}
        y2={margin.top + plotHeight}
        stroke="#e5e7eb"
      />
    );
  }

  const yStep = 4;
  for (let val = yMin; val <= yMax; val += yStep) {
    gridLines.push(
      <line
        key={`gy-${val}`}
        x1={margin.left}
        y1={scaleY(val)}
        x2={margin.left + plotWidth}
        y2={scaleY(val)}
        stroke="#e5e7eb"
      />
    );
  }

  const curves = Z_SCORE_LINES.map((z) => {
    const data = zScoreCurves[z];
    const d = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.value)}`)
      .join(' ');
    return (
      <path
        key={z}
        d={d}
        fill="none"
        stroke={Z_SCORE_COLORS[z]}
        strokeWidth={z === 0 ? 2.5 : 1.25}
        strokeDasharray={z === 0 ? 'none' : '4,3'}
        opacity={z === 0 ? 1 : 0.75}
      />
    );
  });

  const points = visibleMeasurements.map((m) => (
    <circle
      key={`${m.week}-${m.bmi}`}
      cx={scaleX(m.week)}
      cy={scaleY(m.bmi)}
      r={compact ? 5 : 6}
      fill={CATEGORY_COLORS[atalahCategory] || '#dc2626'}
      stroke="#fff"
      strokeWidth="2"
    />
  ));

  return (
    <div className={cn('w-full', className)}>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold">{chartTitle}</h3>
          {currentZ != null && (
            <span className="text-xs text-muted-foreground">
              Z actual: {currentZ.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        className="border border-border/60 rounded-md bg-white"
        role="img"
        aria-label={chartTitle}
      >
        <rect width={width} height={height} fill="white" />
        {compact && (
          <text x={margin.left} y={18} fontSize={10} fontWeight="600" fill="#1f2937">
            {chartTitle}
          </text>
        )}
        {gridLines}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#111" />
        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
          stroke="#111"
        />
        {curves}
        {points}
        <text x={width / 2} y={height - 8} textAnchor="middle" fontSize={11} fontWeight="600">
          Semanas de gestación
        </text>
        <text
          x={18}
          y={height / 2}
          textAnchor="middle"
          fontSize={11}
          fontWeight="600"
          transform={`rotate(-90 18 ${height / 2})`}
        >
          IMC (kg/m²)
        </text>
      </svg>

      <p className="text-[10px] text-muted-foreground mt-1.5">{MINSALUD_RESOLUTION_REF}</p>
    </div>
  );
}

export default GestationalBMIChart;
