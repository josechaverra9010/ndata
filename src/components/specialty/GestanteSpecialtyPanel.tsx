import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { buildGestanteSummary, PRENATAL_CHECKLIST_ITEMS } from '@/lib/specialtyModule';
import { Heart, Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { SpecialtyPayload, SpecialtyTracking } from './types';

interface Props {
  data: SpecialtyPayload;
  onTrackingChange?: (tracking: SpecialtyTracking) => void;
  readOnly?: boolean;
}

export function GestanteSpecialtyPanel({ data, onTrackingChange, readOnly }: Props) {
  const summary = useMemo(
    () => buildGestanteSummary(data.fase_1, data.patient.peso_actual),
    [data.fase_1, data.patient.peso_actual]
  );

  const checklist = data.tracking.prenatal_checklist || {};
  const checkedCount = PRENATAL_CHECKLIST_ITEMS.filter((i) => checklist[i.id]).length;

  const toggleCheck = (id: string, checked: boolean) => {
    if (readOnly || !onTrackingChange) return;
    onTrackingChange({
      ...data.tracking,
      prenatal_checklist: { ...checklist, [id]: checked },
    });
  };

  const trimestreLabel = ['', '1.er trimestre', '2.º trimestre', '3.er trimestre'][summary.trimestre] || '';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Semana gestacional</p>
            <p className="text-2xl font-bold">{summary.semana || '—'}</p>
            <Badge variant="outline" className="mt-1 text-[10px]">{trimestreLabel}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">IMC pregestacional · Atalah</p>
            <p className="text-2xl font-bold">{summary.imcPregestacional ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{summary.clasificacionAtalah || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Debió ganar (acum.)</p>
            <p className="text-2xl font-bold tabular-nums">{summary.debioGanar} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Ganancia presentada</p>
            <p className="text-2xl font-bold tabular-nums flex items-center gap-1">
              {summary.gananciaPresentada ?? '—'}
              {summary.gananciaPresentada != null && <span className="text-sm font-normal">kg</span>}
              {summary.status === 'above' && <TrendingUp className="h-4 w-4 text-amber-500" />}
              {summary.status === 'below' && <TrendingDown className="h-4 w-4 text-sky-500" />}
              {summary.status === 'on_track' && <Minus className="h-4 w-4 text-emerald-500" />}
            </p>
            {summary.diffVsEsperado != null && (
              <p className={`text-xs ${summary.status === 'on_track' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {summary.diffVsEsperado > 0 ? '+' : ''}{summary.diffVsEsperado} kg vs esperado
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {summary.gananciaPresentada != null && summary.debioGanar > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Ganancia vs curva IOM/Atalah
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={Math.min(100, (summary.gananciaPresentada / (summary.gananciaEsperadaTotal || 1)) * 100)}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0 kg</span>
              <span>Meta total ~{summary.gananciaEsperadaTotal} kg</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Checklist prenatal nutricional
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {checkedCount}/{PRENATAL_CHECKLIST_ITEMS.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {PRENATAL_CHECKLIST_ITEMS.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`preg-${item.id}`}
                checked={!!checklist[item.id]}
                disabled={readOnly}
                onCheckedChange={(v) => toggleCheck(item.id, v === true)}
              />
              <Label htmlFor={`preg-${item.id}`} className="text-sm font-normal leading-snug cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
