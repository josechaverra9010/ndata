/**
 * Curvas OMS — Resolución MINSALUD 2465/2016 (puntuación Z por intervalo)
 */

import React, { useMemo } from 'react';
import { generateZScoreCurveData, resolveLmsTable } from '@/lib/whoGrowthCharts';
import {
  buildXSamples,
  filterMeasurementsToInterval,
  formatXAxisLabel,
  getXAxisLabel,
  MINSALUD_RESOLUTION_REF,
  Z_SCORE_COLORS,
  Z_SCORE_LINES,
  type MinsaludChartInterval,
} from '@/lib/minsalud2465ChartIntervals';
import type { WhoIndicator } from '@/lib/pediatricGrowthUtils';
import { cn } from '@/lib/utils';

interface Measurement {
  x?: number;
  ageMonths?: number;
  value: number;
  date?: string;
}

interface WHOGrowthChartProps {
  sex: 'M' | 'F';
  indicator: WhoIndicator;
  /** Intervalo etario según anexo técnico MINSALUD */
  ageInterval: MinsaludChartInterval;
  measurements?: Measurement[];
  title?: string;
  width?: number;
  height?: number;
  compact?: boolean;
  className?: string;
}

const CHART_CONFIG: Record<
  WhoIndicator,
  { yLabel: string; lmsKey: { M: string; F: string } }
> = {
  weight_for_age: {
    yLabel: 'Peso (kg)',
    lmsKey: { M: 'weight_for_age_boys', F: 'weight_for_age_girls' },
  },
  length_for_age: {
    yLabel: 'Talla (cm)',
    lmsKey: { M: 'height_for_age_boys', F: 'height_for_age_girls' },
  },
  head_circumference: {
    yLabel: 'Perímetro cefálico (cm)',
    lmsKey: { M: 'head_circumference_boys', F: 'head_circumference_girls' },
  },
  bmi_for_age: {
    yLabel: 'IMC (kg/m²)',
    lmsKey: { M: 'bmi_for_age_boys', F: 'bmi_for_age_girls' },
  },
  weight_for_height: {
    yLabel: 'Peso (kg)',
    lmsKey: { M: 'weight_for_length_boys', F: 'weight_for_length_girls' },
  },
};

function measurementX(m: Measurement): number {
  return m.x ?? m.ageMonths ?? 0;
}

export const WHOGrowthChart: React.FC<WHOGrowthChartProps> = ({
  sex,
  indicator,
  ageInterval,
  measurements = [],
  title,
  width: widthProp,
  height: heightProp,
  compact = false,
  className,
}) => {
  const width = widthProp ?? (compact ? 560 : 800);
  const height = heightProp ?? (compact ? 320 : 500);
  const margin = compact
    ? { top: 44, right: 52, bottom: 48, left: 52 }
    : { top: 72, right: 72, bottom: 72, left: 72 };

  const config = CHART_CONFIG[indicator];
  const { xMin, xMax, yMin, yMax, xTickStep } = ageInterval;
  const xSpan = xMax - xMin;

  const lmsTable = useMemo(() => {
    if (indicator === 'weight_for_height') {
      return resolveLmsTable(indicator, sex, { weightForHeightIntervalId: ageInterval.id });
    }
    return resolveLmsTable(indicator, sex);
  }, [indicator, sex, ageInterval.id]);

  const xSamples = useMemo(() => buildXSamples(ageInterval), [ageInterval]);

  const zScoreCurves = useMemo(() => {
    const curves: Record<number, Array<{ x: number; value: number }>> = {};
    for (const z of Z_SCORE_LINES) {
      curves[z] = generateZScoreCurveData(lmsTable, z, xSamples);
    }
    return curves;
  }, [lmsTable, xSamples]);

  const visibleMeasurements = useMemo(
    () => filterMeasurementsToInterval(measurements, ageInterval),
    [measurements, ageInterval]
  );

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (x: number) => margin.left + ((x - xMin) / xSpan) * plotWidth;
  const scaleY = (value: number) =>
    margin.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const gridLines: React.ReactNode[] = [];
  for (let x = xMin; x <= xMax; x += xTickStep) {
    gridLines.push(
      <line
        key={`grid-x-${x}`}
        x1={scaleX(x)}
        y1={margin.top}
        x2={scaleX(x)}
        y2={margin.top + plotHeight}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
    );
  }

  const yStep = Math.max(1, Math.floor((yMax - yMin) / (compact ? 6 : 8)));
  for (let val = Math.ceil(yMin); val <= yMax; val += yStep) {
    gridLines.push(
      <line
        key={`grid-y-${val}`}
        x1={margin.left}
        y1={scaleY(val)}
        x2={margin.left + plotWidth}
        y2={scaleY(val)}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
    );
  }

  const curves: React.ReactNode[] = [];
  for (const z of Z_SCORE_LINES) {
    const data = zScoreCurves[z];
    const pathData = data
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.value)}`)
      .join(' ');

    curves.push(
      <path
        key={`z-${z}`}
        d={pathData}
        fill="none"
        stroke={Z_SCORE_COLORS[z]}
        strokeWidth={z === 0 ? 2.5 : z === -2 || z === 2 ? 1.75 : 1.25}
        strokeDasharray={z === 0 ? 'none' : z === -2 || z === 2 ? '6,4' : '3,3'}
        opacity={z === 0 ? 1 : 0.88}
      />
    );
  }

  const measurementPoints: React.ReactNode[] = [];
  const measurementPath: string[] = [];

  if (visibleMeasurements.length > 0) {
    const sorted = [...visibleMeasurements].sort((a, b) => measurementX(a) - measurementX(b));
    for (const m of sorted) {
      const mx = measurementX(m);
      const x = scaleX(mx);
      const y = scaleY(m.value);
      measurementPoints.push(
        <circle
          key={`point-${mx}-${m.value}`}
          cx={x}
          cy={y}
          r={compact ? 4.5 : 5.5}
          fill="#dc2626"
          stroke="#7f1d1d"
          strokeWidth="1.5"
        />
      );
      measurementPath.push(`${measurementPath.length === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    if (measurementPath.length > 1) {
      curves.push(
        <path
          key="measurement-line"
          d={measurementPath.join(' ')}
          fill="none"
          stroke="#dc2626"
          strokeWidth="2"
          opacity="0.45"
        />
      );
    }
  }

  const xLabels: React.ReactNode[] = [];
  for (let x = xMin; x <= xMax; x += xTickStep) {
    xLabels.push(
      <text
        key={`label-x-${x}`}
        x={scaleX(x)}
        y={margin.top + plotHeight + (compact ? 18 : 24)}
        textAnchor="middle"
        fontSize={compact ? 9 : 11}
        fill="#555"
      >
        {formatXAxisLabel(x, ageInterval)}
      </text>
    );
  }

  const yLabels: React.ReactNode[] = [];
  for (let val = Math.ceil(yMin); val <= yMax; val += yStep) {
    yLabels.push(
      <text
        key={`label-y-${val}`}
        x={margin.left - 8}
        y={scaleY(val) + 3}
        textAnchor="end"
        fontSize={compact ? 9 : 11}
        fill="#555"
      >
        {val}
      </text>
    );
  }

  const zLegend = Z_SCORE_LINES.map((z, idx) => (
    <g key={`zlegend-${z}`} transform={`translate(0, ${idx * (compact ? 13 : 16)})`}>
      <line
        x1="0"
        y1="0"
        x2={compact ? 12 : 16}
        y2="0"
        stroke={Z_SCORE_COLORS[z]}
        strokeWidth={z === 0 ? 2.5 : 1.5}
      />
      <text x={compact ? 16 : 20} y="3" fontSize={compact ? 8 : 10} fill="#444">
        {z > 0 ? `+${z}` : z}
      </text>
    </g>
  ));

  const chartTitle = title ?? `Curva OMS · ${ageInterval.label}`;
  const xAxisLabel = getXAxisLabel(ageInterval);
  const xColLabel =
    ageInterval.xAxis === 'height_cm'
      ? 'Talla (cm)'
      : ageInterval.xAxis === 'gestational_weeks'
        ? 'Semanas'
        : 'Edad (m)';

  return (
    <div className={cn('w-full max-w-full', compact ? 'p-0' : 'bg-white p-4 rounded-lg shadow', className)}>
      {!compact && <h3 className="text-base font-bold mb-3 leading-snug">{chartTitle}</h3>}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        className="border border-border/60 rounded-md bg-white block max-w-full"
        style={{ maxHeight: compact ? 280 : 440 }}
        preserveAspectRatio="xMidYMid meet"
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

        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotHeight}
          stroke="#111"
          strokeWidth="1.5"
        />
        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
          stroke="#111"
          strokeWidth="1.5"
        />

        {xLabels}
        {yLabels}

        <text
          x={width / 2}
          y={height - (compact ? 6 : 12)}
          textAnchor="middle"
          fontSize={compact ? 10 : 12}
          fontWeight="600"
          fill="#374151"
        >
          {xAxisLabel}
        </text>
        <text
          x={compact ? 16 : 22}
          y={height / 2}
          textAnchor="middle"
          fontSize={compact ? 10 : 12}
          fontWeight="600"
          fill="#374151"
          transform={`rotate(-90 ${compact ? 16 : 22} ${height / 2})`}
        >
          {config.yLabel}
        </text>

        <text
          x={width - margin.right}
          y={margin.top + 12}
          textAnchor="end"
          fontSize={compact ? 8 : 10}
          fill="#6b7280"
        >
          Puntuación Z
        </text>
        <g transform={`translate(${width - margin.right - (compact ? 28 : 34)}, ${margin.top + 18})`}>
          {zLegend}
        </g>

        {curves}
        {measurementPoints}

        {!compact && (
          <text x={width / 2} y={28} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#111">
            {chartTitle}
          </text>
        )}

        <text x={width - 8} y={height - 8} textAnchor="end" fontSize={compact ? 7 : 9} fill="#9ca3af">
          OMS · MINSALUD 2465/2016
        </text>
      </svg>

      <p className={cn('text-[10px] text-muted-foreground mt-1.5', compact && 'px-0.5')}>
        {MINSALUD_RESOLUTION_REF}
      </p>

      {visibleMeasurements.length > 0 && !compact && (
        <div className="mt-3">
          <h4 className="font-semibold mb-2 text-sm">Mediciones en este intervalo</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="border border-border/60 px-2 py-1 text-left">{xColLabel}</th>
                <th className="border border-border/60 px-2 py-1 text-left">Valor</th>
                <th className="border border-border/60 px-2 py-1 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {visibleMeasurements.map((m, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="border border-border/60 px-2 py-1">{measurementX(m).toFixed(1)}</td>
                  <td className="border border-border/60 px-2 py-1">{m.value.toFixed(2)}</td>
                  <td className="border border-border/60 px-2 py-1">{m.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WHOGrowthChart;
