/**
 * WHO Growth Chart Component
 * Displays growth charts with z-score curves and measurements
 */

import React, { useMemo } from 'react';
import { generatePercentileCurveData, WHO_LMS_DATA } from '@/lib/whoGrowthCharts';
import { cn } from '@/lib/utils';

interface Measurement {
  ageMonths: number;
  value: number;
  date?: string;
}

interface WHOGrowthChartProps {
  sex: 'M' | 'F';
  indicator: 'weight_for_age' | 'length_for_age' | 'head_circumference';
  measurements?: Measurement[];
  title?: string;
  /** Internal SVG coordinate width (responsive via viewBox) */
  width?: number;
  /** Internal SVG coordinate height (responsive via viewBox) */
  height?: number;
  /** Compact layout for modals / narrow containers */
  compact?: boolean;
  className?: string;
}

const CHART_CONFIG = {
  weight_for_age: {
    title: 'Peso para la edad (Estándares WHO)',
    yMin: 2,
    yMax: 22,
    yLabel: 'Peso (kg)',
    lmsKey: {
      M: 'weight_for_age_boys',
      F: 'weight_for_age_girls',
    },
  },
  length_for_age: {
    title: 'Talla para la edad (Estándares WHO)',
    yMin: 45,
    yMax: 115,
    yLabel: 'Talla (cm)',
    lmsKey: {
      M: 'length_for_age_boys',
      F: 'length_for_age_girls',
    },
  },
  head_circumference: {
    title: 'Perímetro cefálico para la edad (Estándares WHO)',
    yMin: 30,
    yMax: 55,
    yLabel: 'Perímetro cefálico (cm)',
    lmsKey: {
      M: 'head_circumference_boys',
      F: 'head_circumference_girls',
    },
  },
};

const PERCENTILE_COLORS: Record<number, string> = {
  3: '#d62728',
  10: '#ff7f0e',
  25: '#ffbb78',
  50: '#2ca02c',
  75: '#98df8a',
  90: '#1f77b4',
  97: '#aec7e8',
};

const PERCENTILES = [3, 10, 25, 50, 75, 90, 97];

export const WHOGrowthChart: React.FC<WHOGrowthChartProps> = ({
  sex,
  indicator,
  measurements = [],
  title,
  width: widthProp,
  height: heightProp,
  compact = false,
  className,
}) => {
  const width = widthProp ?? (compact ? 560 : 800);
  const height = heightProp ?? (compact ? 300 : 480);
  const margin = compact
    ? { top: 36, right: 16, bottom: 44, left: 48 }
    : { top: 60, right: 40, bottom: 80, left: 80 };

  const config = CHART_CONFIG[indicator];
  const lmsTableKey = config.lmsKey[sex] as keyof typeof WHO_LMS_DATA;
  const lmsTable = WHO_LMS_DATA[lmsTableKey];

  const percentileCurves = useMemo(() => {
    const curves: Record<number, Array<{ age: number; value: number }>> = {};
    for (const p of PERCENTILES) {
      curves[p] = generatePercentileCurveData(lmsTable as any, p);
    }
    return curves;
  }, [lmsTable]);

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (age: number) => margin.left + (age / 60) * plotWidth;
  const scaleY = (value: number) =>
    margin.top + plotHeight - ((value - config.yMin) / (config.yMax - config.yMin)) * plotHeight;

  const gridLines = [];
  for (let age = 0; age <= 60; age += 12) {
    gridLines.push(
      <line
        key={`grid-x-${age}`}
        x1={scaleX(age)}
        y1={margin.top}
        x2={scaleX(age)}
        y2={margin.top + plotHeight}
        stroke="#e0e0e0"
        strokeWidth="1"
      />
    );
  }

  const yStep = Math.max(1, Math.floor((config.yMax - config.yMin) / (compact ? 6 : 8)));
  for (let val = Math.ceil(config.yMin); val <= config.yMax; val += yStep) {
    gridLines.push(
      <line
        key={`grid-y-${val}`}
        x1={margin.left}
        y1={scaleY(val)}
        x2={margin.left + plotWidth}
        y2={scaleY(val)}
        stroke="#e0e0e0"
        strokeWidth="1"
      />
    );
  }

  const curves = [];
  for (const percentile of PERCENTILES) {
    const data = percentileCurves[percentile];
    const pathData = data
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(point.age)} ${scaleY(point.value)}`)
      .join(' ');

    curves.push(
      <path
        key={`percentile-${percentile}`}
        d={pathData}
        fill="none"
        stroke={PERCENTILE_COLORS[percentile]}
        strokeWidth={percentile === 50 ? 2 : 1}
        strokeDasharray={percentile === 50 ? 'none' : '4,3'}
        opacity={0.85}
      />
    );
  }

  const measurementPoints = [];
  const measurementPath: string[] = [];

  if (measurements.length > 0) {
    const sortedMeasurements = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);

    for (const measurement of sortedMeasurements) {
      const x = scaleX(measurement.ageMonths);
      const y = scaleY(measurement.value);

      measurementPoints.push(
        <circle
          key={`point-${measurement.ageMonths}-${measurement.value}`}
          cx={x}
          cy={y}
          r={compact ? 4 : 5}
          fill="red"
          stroke="darkred"
          strokeWidth="1.5"
        />
      );

      measurementPath.push(`${measurementPath.length === 0 ? 'M' : 'L'} ${x} ${y}`);
    }

    if (measurementPath.length > 0) {
      curves.push(
        <path
          key="measurement-line"
          d={measurementPath.join(' ')}
          fill="none"
          stroke="red"
          strokeWidth="1.5"
          opacity="0.5"
        />
      );
    }
  }

  const xLabels = [];
  for (let age = 0; age <= 60; age += 12) {
    xLabels.push(
      <text
        key={`label-x-${age}`}
        x={scaleX(age)}
        y={margin.top + plotHeight + (compact ? 16 : 25)}
        textAnchor="middle"
        fontSize={compact ? 10 : 12}
        fill="#666"
      >
        {age}
      </text>
    );
  }

  const yLabels = [];
  for (let val = Math.ceil(config.yMin); val <= config.yMax; val += yStep) {
    yLabels.push(
      <text
        key={`label-y-${val}`}
        x={margin.left - 6}
        y={scaleY(val) + 3}
        textAnchor="end"
        fontSize={compact ? 10 : 12}
        fill="#666"
      >
        {val}
      </text>
    );
  }

  const legendItems = compact ? (
    <g transform={`translate(${margin.left}, ${margin.top - 8})`}>
      {PERCENTILES.map((p, idx) => (
        <g key={`legend-${p}`} transform={`translate(${idx * 52}, 0)`}>
          <line x1="0" y1="0" x2="14" y2="0" stroke={PERCENTILE_COLORS[p]} strokeWidth="2" />
          <text x="18" y="3" fontSize="9" fill="#555">
            P{p}
          </text>
        </g>
      ))}
    </g>
  ) : (
    PERCENTILES.map((p, idx) => (
      <g key={`legend-${p}`} transform={`translate(${margin.left + 20}, ${margin.top + 20 + idx * 18})`}>
        <line x1="0" y1="0" x2="20" y2="0" stroke={PERCENTILE_COLORS[p]} strokeWidth="2" />
        <text x="30" y="4" fontSize="11" fill="#333">
          P{p}
        </text>
      </g>
    ))
  );

  const chartTitle = title || config.title;

  return (
    <div className={cn('w-full max-w-full', compact ? 'p-0' : 'bg-white p-4 rounded-lg shadow', className)}>
      {!compact && <h3 className="text-lg font-bold mb-4">{chartTitle}</h3>}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        className="border border-border/60 rounded-md bg-white block max-w-full"
        style={{ maxHeight: compact ? 260 : 420 }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={chartTitle}
      >
        <rect width={width} height={height} fill="white" />

        {gridLines}

        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotHeight}
          stroke="black"
          strokeWidth="1.5"
        />
        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
          stroke="black"
          strokeWidth="1.5"
        />

        {xLabels}
        {yLabels}

        <text
          x={width / 2}
          y={height - (compact ? 8 : 20)}
          textAnchor="middle"
          fontSize={compact ? 11 : 14}
          fontWeight="600"
        >
          Edad (meses)
        </text>
        <text
          x={compact ? 14 : 20}
          y={height / 2}
          textAnchor="middle"
          fontSize={compact ? 10 : 14}
          fontWeight="600"
          transform={`rotate(-90 ${compact ? 14 : 20} ${height / 2})`}
        >
          {config.yLabel}
        </text>

        {curves}
        {measurementPoints}
        {legendItems}

        {!compact && (
          <text x={width / 2} y="35" textAnchor="middle" fontSize="16" fontWeight="bold">
            {chartTitle}
          </text>
        )}

        <text
          x={width - (compact ? 8 : 20)}
          y={height - (compact ? 8 : 20)}
          textAnchor="end"
          fontSize={compact ? 9 : 11}
          fill="#666"
        >
          WHO · {sex === 'M' ? 'Niño' : 'Niña'}
        </text>
      </svg>

      {measurements.length > 0 && (
        <div className={cn('mt-2', compact && 'max-h-24 overflow-y-auto')}>
          {!compact && <h4 className="font-semibold mb-2 text-sm">Mediciones registradas</h4>}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="border border-border/60 px-2 py-1 text-left">Edad (m)</th>
                <th className="border border-border/60 px-2 py-1 text-left">Valor</th>
                <th className="border border-border/60 px-2 py-1 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((m, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="border border-border/60 px-2 py-1">{m.ageMonths.toFixed(1)}</td>
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
