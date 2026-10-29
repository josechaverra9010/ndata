import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DEPORTISTA_PHASES,
  DEPORTISTA_PLIEGUES_ENDOMORFIA,
  getDeportistaSumatoriaPliegues,
  parseNum,
} from '@/lib/specialtyModule';
import { Droplets, Dumbbell, Flame, Plus, Trash2 } from 'lucide-react';
import { todayInColombiaISO } from '@/lib/timezone';
import { SomatoChart } from '@/components/specialty/SomatoChart';
import type { SpecialtyPayload, SpecialtyTracking } from './types';

interface Props {
  data: SpecialtyPayload;
  onTrackingChange?: (tracking: SpecialtyTracking) => void;
  readOnly?: boolean;
}

export function DeportistaSpecialtyPanel({ data, onTrackingChange, readOnly }: Props) {
  const f1 = data.fase_1;
  const sessions = data.tracking.hydration_sessions || [];
  const [mlInput, setMlInput] = useState('');
  const [phase, setPhase] = useState<'pre' | 'during' | 'post'>(data.tracking.deportista_phase || 'pre');

  const addSession = () => {
    if (readOnly || !onTrackingChange || !mlInput) return;
    const entry = {
      id: `${Date.now()}`,
      date: todayInColombiaISO(),
      phase,
      ml: parseInt(mlInput, 10) || 0,
    };
    onTrackingChange({
      ...data.tracking,
      deportista_phase: phase,
      hydration_sessions: [...sessions, entry],
    });
    setMlInput('');
  };

  const removeSession = (id: string) => {
    if (readOnly || !onTrackingChange) return;
    onTrackingChange({
      ...data.tracking,
      hydration_sessions: sessions.filter((s) => s.id !== id),
    });
  };

  const phaseTotals = DEPORTISTA_PHASES.map((p) => ({
    ...p,
    total: sessions.filter((s) => s.phase === p.id).reduce((sum, s) => sum + s.ml, 0),
  }));

  const sumatoriaPliegues =
    parseNum(f1.sumatoria) ?? getDeportistaSumatoriaPliegues(f1 as Record<string, unknown>);
  const hasPliegues =
    sumatoriaPliegues != null ||
    DEPORTISTA_PLIEGUES_ENDOMORFIA.some((p) => parseNum(f1[p.key]) != null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">% Grasa</p>
            <p className="text-xl font-bold">{f1.pct_grasa_seleccionado ? `${Number(f1.pct_grasa_seleccionado).toFixed(1)}%` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">{f1.metodo_grasa || f1.clasificacion_aks || ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Masa libre grasa</p>
            <p className="text-xl font-bold">{f1.masa_libre_grasa ? `${Number(f1.masa_libre_grasa).toFixed(1)} kg` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Somatotipo</p>
            <p className="text-sm font-bold">
              E{f1.endomorfia?.toFixed?.(1) ?? '—'} · M{f1.mesomorfia?.toFixed?.(1) ?? '—'} · Ec{f1.ectomorfia?.toFixed?.(1) ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="h-3 w-3" /> Req. energético</p>
            <p className="text-xl font-bold">{f1.requerimiento_energetico ? `${Math.round(f1.requerimiento_energetico)} kcal` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {hasPliegues && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pliegues cutáneos (endomorfia)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {DEPORTISTA_PLIEGUES_ENDOMORFIA.map((pliegue) => {
                const value = parseNum(f1[pliegue.key]);
                return (
                  <div key={pliegue.key} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-sm font-semibold">{pliegue.label}</p>
                    <p className="text-[11px] text-muted-foreground italic">{pliegue.apellido}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pliegue.site}</p>
                    <p className="text-xl font-bold mt-2">
                      {value != null ? `${value.toFixed(1)} mm` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
            {sumatoriaPliegues != null && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Sumatoria (tríceps + subescapular + supraespinal)</span>
                <span className="font-bold">{sumatoriaPliegues.toFixed(2)} mm</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Somatocarta (Heath-Carter)</CardTitle>
        </CardHeader>
        <CardContent>
          <SomatoChart
            endomorfia={Number(f1.endomorfia) || undefined}
            mesomorfia={Number(f1.mesomorfia) || undefined}
            ectomorfia={Number(f1.ectomorfia) || undefined}
            coordX={Number(f1.coordenada_x ?? f1.coordX) || undefined}
            coordY={Number(f1.coordenada_y ?? f1.coordY) || undefined}
            compact
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Periodización nutricional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={phase} onValueChange={(v) => setPhase(v as typeof phase)}>
            <TabsList className="grid w-full grid-cols-3 h-9">
              {DEPORTISTA_PHASES.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="text-xs">
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {DEPORTISTA_PHASES.map((p) => (
              <TabsContent key={p.id} value={p.id} className="mt-3">
                <p className="text-sm text-muted-foreground mb-3">{p.hint}</p>
                <Badge variant="outline">{phaseTotals.find((x) => x.id === p.id)?.total || 0} ml registrados</Badge>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-500" />
              Hidratación por sesión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="ml"
                value={mlInput}
                onChange={(e) => setMlInput(e.target.value)}
                className="max-w-[120px]"
              />
              <Button size="sm" onClick={addSession} disabled={!mlInput}>
                <Plus className="h-4 w-4 mr-1" />
                Registrar ({DEPORTISTA_PHASES.find((p) => p.id === phase)?.label})
              </Button>
            </div>
            {sessions.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...sessions].reverse().slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm border rounded-lg px-2 py-1">
                    <span>{s.date} · {s.phase} · {s.ml} ml</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSession(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
