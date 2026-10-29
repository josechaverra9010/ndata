import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PediatricGrowthPanel } from '@/components/pediatria/PediatricGrowthPanel';
import { buildPediatricZAlerts, PEDIATRIA_PERIMETROS, PEDIATRIA_PLIEGUES, parseNum, readPerimBrazoCm, toAreaCm2, toPmbCm } from '@/lib/specialtyModule';
import { buildWeightMeasurementsFromHistory } from '@/lib/pediatricGrowthUtils';
import { AlertTriangle, Baby, Calendar, Ruler, Scale } from 'lucide-react';
import type { SpecialtyPayload } from './types';

interface PediatricPanelProps {
  data: SpecialtyPayload;
  compact?: boolean;
}

export function PediatricSpecialtyPanel({ data, compact }: PediatricPanelProps) {
  const dc = data.patient.datos_clinicos || {};
  const headCm = dc.perimetro_cefalico ? parseFloat(String(dc.perimetro_cefalico)) : null;
  const weightHistory = data.weight_timeline.map((m) => ({
    ageMonths: 0,
    value: m.weight,
    date: m.date,
  }));

  const birthDate = data.patient.fecha_nacimiento;
  const alerts = buildPediatricZAlerts(
    birthDate,
    data.patient.genero || data.fase_1?.pediatria_sexo,
    data.patient.peso_actual,
    data.patient.altura,
    headCm
  );

  const f1 = data.fase_1 || {};
  const pmb = toPmbCm(f1.perimetro_muscular_brazo);
  const amb = toAreaCm2(f1.area_muscular_brazo);
  const agb = toAreaCm2(f1.area_grasa_brazo);
  const perimBraquial = readPerimBrazoCm(f1 as Record<string, unknown>, 'pediatria');
  const hasAntropometria =
    perimBraquial > 0 ||
    PEDIATRIA_PERIMETROS.some((c) => parseNum(f1[c.key]) != null) ||
    PEDIATRIA_PLIEGUES.some((c) => parseNum(f1[c.key]) != null) ||
    pmb != null;

  const timeline = data.weight_timeline;

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Alertas z-score OMS (P&lt;3 o P&gt;97)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="text-sm rounded-lg border border-destructive/20 bg-background p-2">
                {a.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Timeline de mediciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {timeline.slice().reverse().map((m) => (
                <div key={m.id || m.date} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{m.date}</span>
                  <span className="font-medium tabular-nums">
                    <Scale className="h-3 w-3 inline mr-1" />
                    {m.weight} kg
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasAntropometria && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Antropometría braquial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 text-sm">
              {PEDIATRIA_PERIMETROS.map((campo) => {
                const value = parseNum(f1[campo.key]);
                if (value == null) return null;
                return (
                  <div key={campo.key}>
                    <span className="text-muted-foreground block">{campo.label}</span>
                    <span className="font-bold">{value.toFixed(1)} {campo.unit}</span>
                  </div>
                );
              })}
              {PEDIATRIA_PLIEGUES.map((campo) => {
                const value = parseNum(f1[campo.key]);
                if (value == null) return null;
                return (
                  <div key={campo.key}>
                    <span className="text-muted-foreground block">{campo.label}</span>
                    <span className="font-bold">{value.toFixed(1)} {campo.unit}</span>
                  </div>
                );
              })}
            </div>
            {(pmb != null || amb != null) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t pt-3">
                <div>
                  <span className="text-muted-foreground block">PMB</span>
                  <span className="font-bold">{pmb != null ? `${pmb.toFixed(2)} cm` : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">AMB</span>
                  <span className="font-bold">{amb != null ? `${amb.toFixed(2)} cm²` : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">AGB</span>
                  <span className="font-bold">{agb != null ? `${agb.toFixed(2)} cm²` : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Adiposidad</span>
                  <span className="font-bold">
                    {parseNum(f1.adiposidad) != null ? `${Number(f1.adiposidad).toFixed(1)} mm` : '—'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PediatricGrowthPanel
        gender={data.patient.genero || data.fase_1?.pediatria_sexo}
        birthDate={birthDate}
        ageYears={data.fase_1?.pediatria_edad_anos}
        ageMonths={data.fase_1?.pediatria_edad_meses}
        weightKg={data.patient.peso_actual ?? data.fase_1?.pediatria_peso}
        heightCm={data.patient.altura ?? data.fase_1?.pediatria_talla_cm}
        headCircumferenceCm={headCm}
        weightHistory={
          birthDate
            ? buildWeightMeasurementsFromHistory(
                birthDate,
                data.weight_timeline.map((m) => ({ date: m.date, weight: m.weight }))
              )
            : []
        }
        compact={compact ?? true}
      />

      {data.fase_1?.catch_up_kcal > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Baby className="h-3 w-3" />
          Catch-up activo: +{Math.round(data.fase_1.catch_up_kcal)} kcal/día según plan
        </p>
      )}
    </div>
  );
}
