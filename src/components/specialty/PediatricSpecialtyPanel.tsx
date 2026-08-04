import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PediatricGrowthPanel } from '@/components/pediatria/PediatricGrowthPanel';
import { buildPediatricZAlerts } from '@/lib/specialtyModule';
import { buildWeightMeasurementsFromHistory } from '@/lib/pediatricGrowthUtils';
import { AlertTriangle, Baby, Calendar, Scale } from 'lucide-react';
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
