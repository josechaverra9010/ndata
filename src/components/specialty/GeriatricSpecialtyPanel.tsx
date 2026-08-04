import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MNA_SF_QUESTIONS, scoreMnaSf } from '@/lib/specialtyModule';
import { Activity, AlertTriangle, Bone, Ruler } from 'lucide-react';
import type { SpecialtyPayload, SpecialtyTracking } from './types';

interface Props {
  data: SpecialtyPayload;
  onTrackingChange?: (tracking: SpecialtyTracking) => void;
  readOnly?: boolean;
}

export function GeriatricSpecialtyPanel({ data, onTrackingChange, readOnly }: Props) {
  const f1 = data.fase_1;
  const mnaAnswers = data.tracking.mna_sf?.answers || {};
  const mnaResult = useMemo(() => scoreMnaSf(mnaAnswers), [mnaAnswers]);

  const setMnaAnswer = (qId: string, value: number) => {
    if (readOnly || !onTrackingChange) return;
    const answers = { ...mnaAnswers, [qId]: value };
    const scored = scoreMnaSf(answers);
    onTrackingChange({
      ...data.tracking,
      mna_sf: { answers, score: scored.score, date: new Date().toISOString().slice(0, 10) },
    });
  };

  const sarcopeniaRisk = f1.riesgo_sarcopenia || (parseFloat(String(f1.hosp_perim_pantorrilla_cm ?? '')) < 31 ? 'Alto' : null);
  const pmb = f1.perimetro_muscular_brazo;
  const amb = f1.area_muscular_brazo;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Clasificación IMC</p>
            <p className="text-lg font-bold">{f1.clasificacion_imc || '—'}</p>
          </CardContent>
        </Card>
        <Card className={sarcopeniaRisk ? 'border-amber-500/40' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Riesgo sarcopenia
            </p>
            <p className="text-lg font-bold">{sarcopeniaRisk || 'Bajo / no evaluado'}</p>
            {parseFloat(String(f1.hosp_perim_pantorrilla_cm ?? f1.ger_perim_pantorrilla_cm ?? '')) > 0 && (
              <p className="text-xs text-muted-foreground">
                Pantorrilla: {f1.hosp_perim_pantorrilla_cm || f1.ger_perim_pantorrilla_cm} cm
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Requerimiento</p>
            <p className="text-lg font-bold">{f1.requerimiento_energetico ? `${Math.round(f1.requerimiento_energetico)} kcal` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {(pmb > 0 || amb > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bone className="h-4 w-4" />
              Evolución antropometría braquial (plan)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground block">PMB</span>
              <span className="font-bold">{pmb ? `${Number(pmb).toFixed(1)} mm` : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">AMB</span>
              <span className="font-bold">{amb ? `${Number(amb).toFixed(1)} mm²` : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">AGB</span>
              <span className="font-bold">{f1.area_grasa_brazo ? `${Number(f1.area_grasa_brazo).toFixed(1)} mm²` : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Adiposidad</span>
              <span className="font-bold">{f1.adiposidad ? Number(f1.adiposidad).toFixed(1) : '—'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {f1.talla_estimada_chumlea && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Ruler className="h-3 w-3" />
          Chumlea: talla est. {f1.talla_estimada_chumlea} cm · peso est. {f1.peso_estimado_chumlea} kg
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Escala MNA-SF
            {Object.keys(mnaAnswers).length === MNA_SF_QUESTIONS.length && (
              <Badge
                variant={mnaResult.score >= 12 ? 'default' : mnaResult.score >= 8 ? 'secondary' : 'destructive'}
                className="ml-auto text-[10px]"
              >
                {mnaResult.score}/14 — {mnaResult.classification}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MNA_SF_QUESTIONS.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium">{q.label}</Label>
              <RadioGroup
                value={mnaAnswers[q.id] != null ? String(mnaAnswers[q.id]) : undefined}
                onValueChange={(v) => setMnaAnswer(q.id, parseInt(v, 10))}
                className="flex flex-wrap gap-2"
                disabled={readOnly}
              >
                {q.options.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-1.5">
                    <RadioGroupItem value={String(opt.value)} id={`mna-${q.id}-${opt.value}`} />
                    <Label htmlFor={`mna-${q.id}-${opt.value}`} className="text-xs font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
