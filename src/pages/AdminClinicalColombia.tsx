import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/layouts/AdminLayout';
import { LoadingGate } from '@/components/LoadingGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { API_URL } from '@/config/api';
import { todayInColombiaISO } from '@/lib/timezone';
import {
  BIO_CSV_TEMPLATE,
  flagAbnormalValues,
  parseBioquimicosStorage,
  type BioquimicosStorage,
} from '@/lib/bioquimicosHistory';
import { suggestMipressSupplements } from '@/lib/mipressClinicalRules';
import { MIPRESS_CATEGORIAS, filterMipressSuplementos } from '@/lib/mipressSuplementos';
import { downloadJson, ripsToCsvFlat } from '@/lib/clinicalExport';
import { BioquimicosForm } from '@/components/shared/BioquimicosForm';
import {
  Building2,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Pill,
  Upload,
  AlertTriangle,
  Users,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getBioTrend } from '@/lib/bioquimicosHistory';

interface PatientOption {
  id: number;
  name: string;
  programa_eps?: string;
}

interface EpsReport {
  summary: {
    total_patients: number;
    with_bioquimicos: number;
    with_mipress_rx: number;
    by_eps: { eps: string; count: number }[];
  };
  patients: {
    id: number;
    name: string;
    programa_eps?: string;
    has_bio: boolean;
    has_mipress_rx: boolean;
    last_bio_date?: string;
  }[];
}

export default function AdminClinicalColombia() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [bioStorage, setBioStorage] = useState<BioquimicosStorage | null>(null);
  const [csvText, setCsvText] = useState('');
  const [mipressSuggestions, setMipressSuggestions] = useState<ReturnType<typeof suggestMipressSupplements>>([]);
  const [currentRx, setCurrentRx] = useState<Record<string, unknown> | null>(null);
  const [epsFilter, setEpsFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [epsReport, setEpsReport] = useState<EpsReport | null>(null);
  const [organizations, setOrganizations] = useState<{ id: number; name: string }[]>([]);
  const [mipressSearch, setMipressSearch] = useState('');
  const [mipressCat, setMipressCat] = useState('__all__');

  const token = () => localStorage.getItem('userToken');
  const headers = () => ({
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  useEffect(() => {
    (async () => {
      try {
        const [patRes, orgRes] = await Promise.all([
          fetch(`${API_URL}/patients`, { headers: headers() }),
          fetch(`${API_URL}/analytics/adherence/dashboard?days=7`, { headers: headers() }).catch(() => null),
        ]);
        if (patRes.ok) {
          const data = await patRes.json();
          setPatients(
            (Array.isArray(data) ? data : data.patients || []).map((p: any) => ({
              id: p.id,
              name: p.name || `${p.nombres} ${p.apellidos}`,
              programa_eps: p.programa_eps,
            }))
          );
        }
        if (orgRes?.ok) {
          const dash = await orgRes.json();
          setOrganizations(dash.filter_options?.organizations || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPatientBio = useCallback(async (pid: number) => {
    const res = await fetch(`${API_URL}/clinical/patients/${pid}/bioquimicos`, { headers: headers() });
    if (!res.ok) throw new Error('Error cargando bioquímicos');
    const data = await res.json();
    setBioStorage(parseBioquimicosStorage(data));
  }, []);

  const loadMipress = useCallback(async (pid: number) => {
    const res = await fetch(`${API_URL}/clinical/patients/${pid}/mipress/suggest`, { headers: headers() });
    if (!res.ok) return;
    const data = await res.json();
    setCurrentRx(data.current_prescription || null);
    const patient = patients.find((p) => p.id === pid);
    if (bioStorage) {
      setMipressSuggestions(
        suggestMipressSupplements(bioStorage.current, {
          programa_eps: patient?.programa_eps,
        })
      );
    }
  }, [bioStorage, patients]);

  useEffect(() => {
    if (!selectedPatientId) return;
    const pid = parseInt(selectedPatientId, 10);
    loadPatientBio(pid).then(() => loadMipress(pid)).catch(() => {});
  }, [selectedPatientId, loadPatientBio, loadMipress]);

  useEffect(() => {
    if (bioStorage && selectedPatientId) {
      const pid = parseInt(selectedPatientId, 10);
      const patient = patients.find((p) => p.id === pid);
      setMipressSuggestions(
        suggestMipressSupplements(bioStorage.current, { programa_eps: patient?.programa_eps })
      );
    }
  }, [bioStorage, selectedPatientId, patients]);

  const handleImportCsv = async () => {
    if (!selectedPatientId || !csvText.trim()) return;
    try {
      const res = await fetch(`${API_URL}/clinical/patients/${selectedPatientId}/bioquimicos/import-csv`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ csv_text: csvText, set_as_current: true }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Error importando');
      const data = await res.json();
      setBioStorage(parseBioquimicosStorage(data.storage));
      setCsvText('');
      toast({ title: 'CSV importado', description: `${data.imported} registro(s) agregados al historial` });
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const handleSaveManualBio = async () => {
    if (!selectedPatientId || !bioStorage) return;
    try {
      const res = await fetch(`${API_URL}/clinical/patients/${selectedPatientId}/bioquimicos/entry`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ values: bioStorage.current, fecha: bioStorage.current.bio_fecha_examenes || todayInColombiaISO() }),
      });
      if (!res.ok) throw new Error('Error guardando');
      const data = await res.json();
      setBioStorage(parseBioquimicosStorage(data.storage));
      toast({ title: 'Bioquímicos guardados en historial' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const handlePrescribe = async (mipressId: string, indicacion: string) => {
    if (!selectedPatientId) return;
    const res = await fetch(`${API_URL}/clinical/patients/${selectedPatientId}/mipress/prescribe`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ mipress_id: mipressId, porciones_dia: 1, indicacion }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentRx(data.prescription);
      toast({ title: 'Prescripción MIPRESS registrada' });
    }
  };

  const loadEpsReport = async () => {
    const params = new URLSearchParams();
    if (epsFilter !== 'all') params.set('programa_eps', epsFilter);
    if (orgFilter !== 'all') params.set('organization_id', orgFilter);
    const res = await fetch(`${API_URL}/clinical/reports/eps?${params}`, { headers: headers() });
    if (res.ok) setEpsReport(await res.json());
  };

  const handleExportRips = async () => {
    const params = new URLSearchParams();
    if (epsFilter !== 'all') params.set('programa_eps', epsFilter);
    if (orgFilter !== 'all') params.set('organization_id', orgFilter);
    const res = await fetch(`${API_URL}/clinical/export/rips?${params}`, { headers: headers() });
    if (!res.ok) return;
    const data = await res.json();
    downloadJson(data, `RIPS_${todayInColombiaISO()}.json`);
    toast({ title: 'RIPS exportado (JSON)' });
  };

  const handleExportRipsCsv = async () => {
    const params = new URLSearchParams();
    if (epsFilter !== 'all') params.set('programa_eps', epsFilter);
    if (orgFilter !== 'all') params.set('organization_id', orgFilter);
    const res = await fetch(`${API_URL}/clinical/export/rips?${params}`, { headers: headers() });
    if (!res.ok) return;
    const data = await res.json();
    const csv = ripsToCsvFlat(data as any);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RIPS_${todayInColombiaISO()}.csv`;
    a.click();
  };

  const handleExportHc = async () => {
    if (!selectedPatientId) return;
    const res = await fetch(`${API_URL}/clinical/export/hc/${selectedPatientId}`, { headers: headers() });
    if (res.ok) downloadJson(await res.json(), `HC_${selectedPatientId}_${todayInColombiaISO()}.json`);
  };

  const epsOptions = [...new Set(patients.map((p) => p.programa_eps).filter(Boolean))] as string[];
  const abnormal = bioStorage ? flagAbnormalValues(bioStorage.current) : [];
  const albuminaTrend = bioStorage ? getBioTrend(bioStorage, 'bio_albumina') : [];

  return (
    <AdminLayout>
      <LoadingGate loading={loading} message="Cargando integración clínica">
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-500/10 via-background to-primary/5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Integración clínica Colombia</h1>
              <p className="text-sm text-muted-foreground">Bioquímicos · MIPRESS · EPS · RIPS / HC</p>
            </div>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="pt-4">
            <Label className="text-xs text-muted-foreground">Paciente</Label>
            <Select value={selectedPatientId || undefined} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="mt-1 rounded-xl max-w-md">
                <SelectValue placeholder="Selecciona paciente para bioquímicos / MIPRESS" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} {p.programa_eps ? `· ${p.programa_eps}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs defaultValue="bio" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
            <TabsTrigger value="bio" className="gap-1.5 text-xs sm:text-sm">
              <FlaskConical className="h-4 w-4" /> Bioquímicos
            </TabsTrigger>
            <TabsTrigger value="mipress" className="gap-1.5 text-xs sm:text-sm">
              <Pill className="h-4 w-4" /> MIPRESS
            </TabsTrigger>
            <TabsTrigger value="eps" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" /> Reporte EPS
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1.5 text-xs sm:text-sm">
              <Download className="h-4 w-4" /> Exportación
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bio" className="space-y-4 mt-4">
            {!selectedPatientId ? (
              <p className="text-sm text-muted-foreground text-center py-8">Selecciona un paciente</p>
            ) : (
              <>
                {abnormal.length > 0 && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Valores fuera de rango
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {abnormal.map((a) => (
                        <Badge key={a.key} variant="outline" className="text-xs">
                          {a.label}: {a.value} ({a.flag})
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Registro manual</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bioStorage && (
                      <BioquimicosForm
                        value={bioStorage.current}
                        onChange={(next) => setBioStorage({ ...bioStorage, current: next })}
                      />
                    )}
                    <Button onClick={handleSaveManualBio} disabled={!bioStorage}>
                      Guardar en historial
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Importar CSV
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Pega CSV con header: fecha, hb, glicemia, creatinina, albumina..."
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={5}
                      className="font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCsvText(BIO_CSV_TEMPLATE)}>
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        Plantilla
                      </Button>
                      <Button size="sm" onClick={handleImportCsv} disabled={!csvText.trim()}>
                        Importar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {albuminaTrend.length > 1 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Tendencia albúmina</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={albuminaTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {bioStorage && bioStorage.history.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Historial ({bioStorage.history.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto space-y-2">
                      {bioStorage.history.map((h) => (
                        <div key={h.id} className="flex justify-between text-sm border-b pb-2">
                          <span>{h.fecha} · {h.source}</span>
                          <span className="text-muted-foreground">
                            Hb {h.values.bio_hb || '—'} · Alb {h.values.bio_albumina || '—'}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="mipress" className="space-y-4 mt-4">
            {!selectedPatientId ? (
              <p className="text-sm text-muted-foreground text-center py-8">Selecciona un paciente</p>
            ) : (
              <>
                {currentRx && (
                  <Card className="border-primary/30">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Prescripción activa</p>
                      <p className="font-medium">{String((currentRx as any).mipress_id)} · {(currentRx as any).indicacion}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sugerencias según bioquímicos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mipressSuggestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin sugerencias — completa bioquímicos o condiciones clínicas</p>
                    ) : (
                      mipressSuggestions.map((s) => (
                        <div key={s.suplemento.id} className="flex items-start justify-between gap-2 border rounded-lg p-3">
                          <div>
                            <p className="font-medium text-sm">{s.suplemento.nombre}</p>
                            <p className="text-xs text-muted-foreground">{s.suplemento.categoria}</p>
                            <p className="text-xs mt-1">{s.reason}</p>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => handlePrescribe(s.suplemento.id, s.reason)}>
                            Prescribir
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Catálogo MIPRESS ({filterMipressSuplementos(mipressCat === '__all__' ? null : mipressCat, mipressSearch).length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input placeholder="Buscar..." value={mipressSearch} onChange={(e) => setMipressSearch(e.target.value)} className="max-w-xs" />
                      <Select value={mipressCat} onValueChange={setMipressCat}>
                        <SelectTrigger className="max-w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todas las categorías</SelectItem>
                          {MIPRESS_CATEGORIAS.map((c) => (
                            <SelectItem key={c} value={c}>{c.split('–')[0].trim()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {filterMipressSuplementos(mipressCat === '__all__' ? null : mipressCat, mipressSearch).slice(0, 30).map((s) => (
                        <div key={s.id} className="flex justify-between items-center text-xs border-b py-1.5">
                          <span>{s.nombre} <span className="text-muted-foreground">· {s.kcal} kcal</span></span>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handlePrescribe(s.id, 'Prescripción manual')}>
                            +
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="eps" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <Select value={epsFilter} onValueChange={setEpsFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="EPS" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las EPS</SelectItem>
                  {epsOptions.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Organización" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={loadEpsReport}>Generar reporte</Button>
            </div>

            {epsReport && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pacientes</p><p className="text-2xl font-bold">{epsReport.summary.total_patients}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Con bioquímicos</p><p className="text-2xl font-bold">{epsReport.summary.with_bioquimicos}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Prescripción MIPRESS</p><p className="text-2xl font-bold">{epsReport.summary.with_mipress_rx}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">EPS distintas</p><p className="text-2xl font-bold">{epsReport.summary.by_eps.length}</p></CardContent></Card>
                </div>
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/40"><th className="p-2 text-left">Paciente</th><th className="p-2">EPS</th><th className="p-2">Bio</th><th className="p-2">MIPRESS</th></tr></thead>
                      <tbody>
                        {epsReport.patients.map((r) => (
                          <tr key={r.id} className="border-b">
                            <td className="p-2">{r.name}</td>
                            <td className="p-2 text-muted-foreground">{r.programa_eps || '—'}</td>
                            <td className="p-2 text-center">{r.has_bio ? '✓' : '—'}</td>
                            <td className="p-2 text-center">{r.has_mipress_rx ? '✓' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exportación RIPS (Res. 2275/2023 simplificado)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Genera archivos US (usuarios) + AC (consultas nutrición CUPS 890201) filtrables por EPS u organización.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleExportRips}><Download className="h-4 w-4 mr-1" /> RIPS JSON</Button>
                  <Button variant="outline" onClick={handleExportRipsCsv}><FileSpreadsheet className="h-4 w-4 mr-1" /> RIPS CSV</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial clínico (HC)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  JSON estructurado con datos demográficos, bioquímicos, citas y prescripción — compatible con importación a HC.
                </p>
                <Button onClick={handleExportHc} disabled={!selectedPatientId}>
                  Exportar HC del paciente seleccionado
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </LoadingGate>
    </AdminLayout>
  );
}
