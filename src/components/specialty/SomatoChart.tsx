/**
 * Somatocarta Heath-Carter — triángulo endo / meso / ecto (EVANUT deportista)
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface SomatoChartProps {
  endomorfia?: number | null;
  mesomorfia?: number | null;
  ectomorfia?: number | null;
  coordX?: number | null;
  coordY?: number | null;
  width?: number;
  height?: number;
  compact?: boolean;
  className?: string;
  title?: string;
}

const GRID_STEP = 2;
const MAX_SCALE = 12;

function computeCoords(
  endo?: number | null,
  meso?: number | null,
  ecto?: number | null,
  coordX?: number | null,
  coordY?: number | null
) {
  const e = Number(endo) || 0;
  const m = Number(meso) || 0;
  const ec = Number(ecto) || 0;
  const hasComponents = e > 0 || m > 0 || ec > 0;
  const x = coordX ?? (hasComponents ? ec - e : NaN);
  const y = coordY ?? (hasComponents ? 2 * m - (ec + e) : NaN);
  return { x, y, hasPoint: hasComponents && Number.isFinite(x) && Number.isFinite(y) };
}

/** Convierte coordenadas Heath-Carter (X,Y) a píxeles dentro del triángulo */
function xyToPixel(
  x: number,
  y: number,
  tri: { top: { x: number; y: number }; left: { x: number; y: number }; right: { x: number; y: number } }
) {
  const baseMid = {
    x: (tri.left.x + tri.right.x) / 2,
    y: (tri.left.y + tri.right.y) / 2,
  };
  const scaleX = (tri.right.x - tri.left.x) / 22;
  const scaleY = (baseMid.y - tri.top.y) / 15;
  return {
    px: baseMid.x + x * scaleX,
    py: baseMid.y - y * scaleY,
  };
}

/** Línea de grid paralela a un lado del triángulo (fracción 0–1 desde el vértice opuesto) */
function gridLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  t: number
) {
  const p1 = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const p2 = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t };
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
}

export function SomatoChart({
  endomorfia,
  mesomorfia,
  ectomorfia,
  coordX,
  coordY,
  width: widthProp,
  height: heightProp,
  compact = false,
  className,
  title = 'Somatocarta',
}: SomatoChartProps) {
  const width = widthProp ?? (compact ? 320 : 420);
  const height = heightProp ?? (compact ? 300 : 380);
  const pad = compact ? 36 : 48;

  const { x, y, hasPoint } = useMemo(
    () => computeCoords(endomorfia, mesomorfia, ectomorfia, coordX, coordY),
    [endomorfia, mesomorfia, ectomorfia, coordX, coordY]
  );

  const tri = useMemo(() => {
    const baseW = width - pad * 2;
    const triH = baseW * (Math.sqrt(3) / 2);
    const topY = pad + (compact ? 8 : 16);
    return {
      top: { x: width / 2, y: topY },
      left: { x: pad, y: topY + triH },
      right: { x: width - pad, y: topY + triH },
      triH,
    };
  }, [width, pad, compact]);

  const gridLines = useMemo(() => {
    const lines: string[] = [];
    for (let i = GRID_STEP; i <= MAX_SCALE; i += GRID_STEP) {
      const t = i / MAX_SCALE;
      lines.push(gridLine(tri.top, tri.left, tri.right, t));
      lines.push(gridLine(tri.left, tri.right, tri.top, t));
      lines.push(gridLine(tri.right, tri.top, tri.left, t));
    }
    return lines;
  }, [tri]);

  const trianglePath = `M ${tri.top.x} ${tri.top.y} L ${tri.left.x} ${tri.left.y} L ${tri.right.x} ${tri.right.y} Z`;

  const point = hasPoint ? xyToPixel(x, y, tri) : null;

  return (
    <div className={cn('w-full', className)}>
      {!compact && (
        <h4 className="font-semibold text-sm mb-2">{title}</h4>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        className="border border-border/60 rounded-lg bg-white dark:bg-slate-950 max-w-full block"
        style={{ maxHeight: compact ? 280 : 400 }}
        role="img"
        aria-label={`${title} Heath-Carter`}
      >
        <rect width={width} height={height} fill="transparent" />

        {compact && (
          <text x={pad} y={pad - 4} fontSize={11} fontWeight="600" fill="currentColor">
            {title}
          </text>
        )}

        {/* Grid */}
        {gridLines.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
        ))}

        {/* Triángulo principal */}
        <path d={trianglePath} fill="#f8fafc" stroke="#334155" strokeWidth="2" />

        {/* Etiquetas de vértices */}
        <text
          x={tri.top.x}
          y={tri.top.y - 8}
          textAnchor="middle"
          fontSize={compact ? 9 : 11}
          fontWeight="700"
          fill="#15803d"
        >
          MESOMORFIA
        </text>
        <text
          x={tri.left.x - 4}
          y={tri.left.y + 16}
          textAnchor="start"
          fontSize={compact ? 9 : 11}
          fontWeight="700"
          fill="#b45309"
        >
          ENDOMORFIA
        </text>
        <text
          x={tri.right.x + 4}
          y={tri.right.y + 16}
          textAnchor="end"
          fontSize={compact ? 9 : 11}
          fontWeight="700"
          fill="#2563eb"
        >
          ECTOMORFIA
        </text>

        {/* Punto del sujeto */}
        {point && (
          <>
            <circle cx={point.px} cy={point.py} r={compact ? 6 : 8} fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
            <text
              x={point.px + (compact ? 10 : 12)}
              y={point.py + 4}
              fontSize={compact ? 9 : 10}
              fill="#64748b"
            >
              X={x.toFixed(1)} Y={y.toFixed(1)}
            </text>
          </>
        )}

        {!hasPoint && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={11} fill="#94a3b8">
            Ingresa medidas para ver la somatocarta
          </text>
        )}

        <text x={width - pad} y={height - 8} textAnchor="end" fontSize={8} fill="#94a3b8">
          Heath-Carter · EVANUT
        </text>
      </svg>

      {hasPoint && (
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          E={Number(endomorfia).toFixed(1)} · M={Number(mesomorfia).toFixed(1)} · Ec=
          {Number(ectomorfia).toFixed(1)}
        </p>
      )}
    </div>
  );
}

export default SomatoChart;
