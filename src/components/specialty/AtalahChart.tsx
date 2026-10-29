/**
 * Curva de Atalah — clasificación IMC pregestacional + ganancia acumulada vs semanas
 * EVANUT Gestante / Ges Adolescente
 */

import React, { useMemo } from 'react';
import {
  getGestanteDebioGanar,
  getGestanteExpectedGainKg,
  getGestAdolesExpectedGainKg,
} from '@/lib/foodNutrients';
import { cn } from '@/lib/utils';

export type AtalahCategory = 'Bajo' | 'Normal' | 'Sobrepeso' | 'Obesidad' | '';

export interface AtalahChartProps {
  imcPregestacional?: number | null;
  atalahCategory?: AtalahCategory;
  semanaGestacional?: number | null;
  gananciaPresentada?: number | null;
  t1Kg?: number;
  t23Kg?: number;
  /** Gestante adolescente: curva según puntaje Z */
  variant?: 'adult' | 'adolescent';
  zScore?: number | null;
  zClass?: string;
  compact?: boolean;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Bajo: '#2563eb',
  Normal: '#16a34a',
  Sobrepeso: '#f97316',
  Obesidad: '#dc2626',
};

const IMC_BANDS = [
  { key: 'Bajo', label: 'Bajo peso', min: 15, max: 20, color: '#dbeafe', stroke: '#2563eb' },
  { key: 'Normal', label: 'Normal', min: 20, max: 25, color: '#dcfce7', stroke: '#16a34a' },
  { key: 'Sobrepeso', label: 'Sobrepeso', min: 25, max: 30, color: '#ffedd5', stroke: '#f97316' },
  { key: 'Obesidad', label: 'Obesidad', min: 30, max: 45, color: '#fee2e2', stroke: '#dc2626' },
] as const;

function buildGainCurve(t1: number, t23: number, maxWeek = 40): Array<{ week: number; kg: number }> {
  const pts: Array<{ week: number; kg: number }> = [];
  for (let w = 0; w <= maxWeek; w++) {
    pts.push({ week: w, kg: getGestanteDebioGanar(w, t1, t23) });
  }
  return pts;
}

export function AtalahChart({
  imcPregestacional,
  atalahCategory = '',
  semanaGestacional,
  gananciaPresentada,
  t1Kg,
  t23Kg,
  variant = 'adult',
  zScore,
  zClass,
  compact = false,
  className,
}: AtalahChartProps) {
  const width = compact ? 400 : 520;
  const imcHeight = compact ? 56 : 72;
  const chartHeight = compact ? 240 : 300;
  const pad = compact ? 40 : 48;

  const activeCategory = atalahCategory || 'Normal';
  const activeColor = CATEGORY_COLORS[activeCategory] || CATEGORY_COLORS.Normal;

  const gains = useMemo(() => {
    if (t1Kg != null && t23Kg != null) return { t1: t1Kg, t23: t23Kg };
    if (variant === 'adolescent' && zScore != null && !Number.isNaN(zScore)) {
      return getGestAdolesExpectedGainKg(zScore);
    }
    return getGestanteExpectedGainKg(activeCategory);
  }, [t1Kg, t23Kg, variant, zScore, activeCategory]);

  const referenceCurves = useMemo(() => {
    if (variant === 'adolescent') {
      return [{ key: 'Ref. Z', ...gains, color: activeColor, bold: true }];
    }
    return (['Bajo', 'Normal', 'Sobrepeso', 'Obesidad'] as const).map((key) => {
      const g = getGestanteExpectedGainKg(key);
      return {
        key,
        ...g,
        color: CATEGORY_COLORS[key],
        bold: key === activeCategory,
      };
    });
  }, [variant, gains, activeCategory, activeColor]);

  const curves = useMemo(
    () =>
      referenceCurves.map((c) => ({
        ...c,
        points: buildGainCurve(c.t1, c.t23),
      })),
    [referenceCurves]
  );

  const yMax = useMemo(() => {
    const totals = curves.map((c) => c.t1 + c.t23);
    const gp = gananciaPresentada ?? 0;
    return Math.max(16, ...totals, gp + 2);
  }, [curves, gananciaPresentada]);

  const plotW = width - pad * 2;
  const plotH = chartHeight - pad - 24;
  const scaleX = (w: number) => pad + (w / 40) * plotW;
  const scaleY = (kg: number) => pad + plotH - (kg / yMax) * plotH;

  const imcMin = 15;
  const imcMax = 45;
  const scaleImcX = (imc: number) => pad + ((imc - imcMin) / (imcMax - imcMin)) * plotW;

  const hasPoint =
    (semanaGestacional ?? 0) > 0 &&
    gananciaPresentada != null &&
    Number.isFinite(gananciaPresentada);

  const title =
    variant === 'adolescent'
      ? `Curva de ganancia · Ges Adolescente${zClass ? ` (${zClass})` : ''}`
      : `Curva de Atalah · ${activeCategory || '—'}`;

  return (
    <div className={cn('w-full space-y-3', className)}>
      {!compact && <h4 className="font-semibold text-sm">{title}</h4>}

      {/* Banda IMC Atalah */}
      <div>
        {compact && (
          <p className="text-[11px] font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
            IMC pregestacional · Atalah
          </p>
        )}
        <svg
          viewBox={`0 0 ${width} ${imcHeight}`}
          width="100%"
          height="auto"
          className="border border-border/60 rounded-md bg-white dark:bg-slate-950 block max-w-full"
          role="img"
          aria-label="Clasificación IMC Atalah"
        >
          {IMC_BANDS.map((band) => {
            const x1 = scaleImcX(band.min);
            const x2 = scaleImcX(Math.min(band.max, imcMax));
            return (
              <g key={band.key}>
                <rect x={x1} y={12} width={x2 - x1} height={imcHeight - 28} fill={band.color} stroke={band.stroke} strokeWidth={band.key === activeCategory ? 2 : 0.5} />
                <text x={(x1 + x2) / 2} y={imcHeight - 6} textAnchor="middle" fontSize={compact ? 7 : 8} fill={band.stroke}>
                  {band.label}
                </text>
              </g>
            );
          })}
          {(imcPregestacional ?? 0) > 0 && (
            <>
              <line
                x1={scaleImcX(imcPregestacional!)}
                y1={8}
                x2={scaleImcX(imcPregestacional!)}
                y2={imcHeight - 18}
                stroke={activeColor}
                strokeWidth="2.5"
              />
              <circle cx={scaleImcX(imcPregestacional!)} cy={8} r={4} fill={activeColor} />
              <text
                x={scaleImcX(imcPregestacional!)}
                y={imcHeight - 1}
                textAnchor="middle"
                fontSize={9}
                fontWeight="700"
                fill={activeColor}
              >
                {imcPregestacional!.toFixed(1)}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Curva ganancia acumulada */}
      <div>
        {compact && (
          <p className="text-[11px] font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
            Ganancia acumulada (kg) vs semanas
          </p>
        )}
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          width="100%"
          height="auto"
          className="border border-border/60 rounded-md bg-white dark:bg-slate-950 block max-w-full"
          style={{ maxHeight: compact ? 260 : 320 }}
          role="img"
          aria-label={title}
        >
          {/* Grid Y */}
          {[0, 4, 8, 12, 16].filter((v) => v <= yMax).map((v) => (
            <g key={v}>
              <line x1={pad} y1={scaleY(v)} x2={width - pad} y2={scaleY(v)} stroke="#e2e8f0" />
              <text x={pad - 6} y={scaleY(v) + 3} textAnchor="end" fontSize={9} fill="#64748b">
                {v}
              </text>
            </g>
          ))}

          {/* Grid X */}
          {[0, 10, 20, 30, 40].map((w) => (
            <g key={w}>
              <line x1={scaleX(w)} y1={pad} x2={scaleX(w)} y2={pad + plotH} stroke="#e2e8f0" />
              <text x={scaleX(w)} y={chartHeight - 6} textAnchor="middle" fontSize={9} fill="#64748b">
                {w}s
              </text>
            </g>
          ))}

          <line x1={pad} y1={pad} x2={pad} y2={pad + plotH} stroke="#334155" strokeWidth="1.5" />
          <line x1={pad} y1={pad + plotH} x2={width - pad} y2={pad + plotH} stroke="#334155" strokeWidth="1.5" />

          {/* Curvas referencia */}
          {curves.map((curve) => {
            const d = curve.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.week)} ${scaleY(p.kg)}`)
              .join(' ');
            return (
              <path
                key={curve.key}
                d={d}
                fill="none"
                stroke={curve.color}
                strokeWidth={curve.bold ? 2.5 : 1}
                strokeDasharray={curve.bold ? undefined : '4,4'}
                opacity={curve.bold ? 1 : 0.45}
              />
            );
          })}

          {/* Punto actual */}
          {hasPoint && (
            <>
              <circle
                cx={scaleX(semanaGestacional!)}
                cy={scaleY(gananciaPresentada!)}
                r={compact ? 6 : 7}
                fill={activeColor}
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                x={scaleX(semanaGestacional!) + 10}
                y={scaleY(gananciaPresentada!) + 4}
                fontSize={9}
                fill="#64748b"
              >
                {gananciaPresentada!.toFixed(1)} kg (sem {semanaGestacional})
              </text>
            </>
          )}

          <text x={width / 2} y={14} textAnchor="middle" fontSize={compact ? 10 : 12} fontWeight="600" fill="#1f2937">
            {compact ? title : 'Ganancia acumulada (kg)'}
          </text>
          <text
            x={14}
            y={pad + plotH / 2}
            textAnchor="middle"
            fontSize={10}
            fontWeight="600"
            fill="#374151"
            transform={`rotate(-90 14 ${pad + plotH / 2})`}
          >
            kg
          </text>

          <text x={width - 8} y={chartHeight - 2} textAnchor="end" fontSize={7} fill="#94a3b8">
            EVANUT · Atalah
          </text>
        </svg>
      </div>

      {variant === 'adult' && (
        <div className="flex flex-wrap gap-2 justify-center text-[10px]">
          {(['Bajo', 'Normal', 'Sobrepeso', 'Obesidad'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: CATEGORY_COLORS[k] }} />
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default AtalahChart;
