import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ALTA_HOSPITAL_CHECKLIST } from '@/lib/specialtyModule';
import { Activity, ClipboardCheck, Droplets, Plus, Stethoscope } from 'lucide-react';
import { todayInColombiaISO } from '@/lib/timezone';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SpecialtyPayload, SpecialtyTracking } from './types';

interface Props {
  data: SpecialtyPayload;
  onTrackingChange?: (tracking: SpecialtyTracking) => void;
  readOnly?: boolean;
}

export function HospitalizadoSpecialtyPanel({ data, onTrackingChange, readOnly }: Props) {
  const f1 = data.fase_1;
  const daily = data.tracking.hospital_daily || [];
  const altaCheck = data.tracking.alta_hospital_checklist || {};
  const targetKcal = Math.round(parseFloat(String(f1.requerimiento_energetico ?? 0)) || 0);
  const [actualKcal, setActualKcal] = useState('');

  const addDaily = () => {
    if (readOnly || !onTrackingChange) return;
    onTrackingChange({
      ...data.tracking,
      hospital_daily: [
        ...daily,
        {
          date: todayInColombiaISO(),
          kcal_target: targetKcal,
          kcal_actual: parseInt(actualKcal, 10) || undefined,
        },
      ],
    });
    setActualKcal('');
  };

  const toggleAlta = (id: string, checked: boolean) => {
    if (readOnly || !onTrackingChange) return;
    onTrackingChange({
      ...data.tracking,
      alta_hospital_checklist: { ...altaCheck, [id]: checked },
    });
  };

  const chartData = daily.map((d) => ({
    date: d.date.slice(5),
    objetivo: d.kcal_target,
    real: d.kcal_actual ?? null,
  }));

  const pn = f1.nutricion_parenteral;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Req. diario</p>
            <p className="text-xl font-bold">{targetKcal ? `${targetKcal} kcal` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">{f1.metodo_energia || ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Droplets className="h-3 w-3" /> Líquidos</p>
            <p className="text-xl font-bold">{f1.liquidos_ml ? `${f1.liquidos_ml} ml/d` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">FA × FE</p>
            <p className="text-xl font-bold">
              {f1.hosp_factor_actividad ?? '—'} × {f1.hosp_factor_estres ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {pn && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Nutrición parenteral (plan)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><span className="text-muted-foreground block">Kcal</span><span className="font-bold">{pn.calorias}</span></div>
            <div><span className="text-muted-foreground block">Proteína</span><span className="font-bold">{pn.prot_g} g</span></div>
            <div><span className="text-muted-foreground block">CHO</span><span className="font-bold">{pn.cho_g} g</span></div>
            <div><span className="text-muted-foreground block">Lípidos</span><span className="font-bold">{pn.lip_g} g</span></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Evolución diaria de requerimientos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {chartData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="objetivo" stroke="hsl(var(--primary))" name="Objetivo" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="real" stroke="#10b981" name="Ingesta" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Registra la ingesta diaria para ver evolución</p>
          )}

          {!readOnly && (
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Kcal ingeridas hoy</Label>
                <Input type="number" value={actualKcal} onChange={(e) => setActualKcal(e.target.value)} className="max-w-[140px]" />
              </div>
              <Button size="sm" onClick={addDaily}>
                <Plus className="h-4 w-4 mr-1" />
                Registrar día
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Transición a alta domiciliaria
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {ALTA_HOSPITAL_CHECKLIST.filter((i) => altaCheck[i.id]).length}/{ALTA_HOSPITAL_CHECKLIST.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {ALTA_HOSPITAL_CHECKLIST.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`alta-${item.id}`}
                checked={!!altaCheck[item.id]}
                disabled={readOnly}
                onCheckedChange={(v) => toggleAlta(item.id, v === true)}
              />
              <Label htmlFor={`alta-${item.id}`} className="text-sm font-normal leading-snug cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
