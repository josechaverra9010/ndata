import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Stethoscope } from 'lucide-react';
import { API_URL } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import { SPECIALTY_LABELS, isSpecialtyTipo } from '@/lib/specialtyModule';
import { PediatricSpecialtyPanel } from './PediatricSpecialtyPanel';
import { GestanteSpecialtyPanel } from './GestanteSpecialtyPanel';
import { GeriatricSpecialtyPanel } from './GeriatricSpecialtyPanel';
import { DeportistaSpecialtyPanel } from './DeportistaSpecialtyPanel';
import { HospitalizadoSpecialtyPanel } from './HospitalizadoSpecialtyPanel';
import type { SpecialtyPayload, SpecialtyTracking } from './types';

interface SpecialtyProgressHubProps {
  patientId: number;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
}

export function SpecialtyProgressHub({
  patientId,
  readOnly = false,
  compact = true,
  className = '',
}: SpecialtyProgressHubProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SpecialtyPayload | null>(null);

  const fetchSpecialty = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/specialty/patient/${patientId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('No se pudo cargar el módulo de especialidad');
      setData(await res.json());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast({ title: 'Especialidad', description: msg, variant: 'destructive' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    fetchSpecialty();
  }, [fetchSpecialty]);

  const saveTracking = async (tracking: SpecialtyTracking) => {
    if (readOnly) return;
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/specialty/patient/${patientId}/tracking`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ specialty_tracking: tracking }),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      const updated = await res.json();
      setData((prev) => (prev ? { ...prev, tracking: updated.tracking || tracking } : prev));
    } catch (e: unknown) {
      toast({
        title: 'Error al guardar',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Cargando módulo clínico…
        </CardContent>
      </Card>
    );
  }

  if (!data?.has_specialty || !isSpecialtyTipo(data.plan_tipo)) {
    return null;
  }

  const tipo = data.plan_tipo;
  const label = data.plan_tipo_label || SPECIALTY_LABELS[tipo] || tipo;

  return (
    <Card className={`rounded-2xl border-primary/20 ${className}`}>
      <CardHeader className={compact ? 'pb-2 pt-4 px-4' : 'pb-3'}>
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          Seguimiento {label}
          <Badge variant="outline" className="ml-auto text-[10px] font-normal">
            {data.plan_name}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? 'px-4 pb-4 pt-0' : ''}>
        {tipo === 'pediatria' && <PediatricSpecialtyPanel data={data} compact={compact} />}
        {(tipo === 'gestante' || tipo === 'gestante_adolescente') && (
          <GestanteSpecialtyPanel data={data} onTrackingChange={saveTracking} readOnly={readOnly} />
        )}
        {tipo === 'geriatrico' && (
          <GeriatricSpecialtyPanel data={data} onTrackingChange={saveTracking} readOnly={readOnly} />
        )}
        {tipo === 'deportista' && (
          <DeportistaSpecialtyPanel data={data} onTrackingChange={saveTracking} readOnly={readOnly} />
        )}
        {tipo === 'hospitalizado' && (
          <HospitalizadoSpecialtyPanel data={data} onTrackingChange={saveTracking} readOnly={readOnly} />
        )}
      </CardContent>
    </Card>
  );
}

export default SpecialtyProgressHub;
