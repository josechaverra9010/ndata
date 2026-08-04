import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { API_URL } from "@/config/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Timer,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";

interface ServiceHealth {
  id: string;
  label: string;
  status: string;
  latency_ms?: number | null;
  message?: string;
}

interface Overview {
  generated_at: string;
  overall_status: string;
  services: ServiceHealth[];
  api_metrics: {
    requests_total: number;
    errors_5xx_24h: number;
    uptime_seconds: number;
  };
  database: { status: string; latency_ms?: number; pool?: Record<string, number | null> };
  job_queue: {
    pending: number;
    running: number;
    completed_24h: number;
    failed_24h: number;
    scheduled_articles: number;
    recent_jobs: JobRow[];
  };
  storage_summary: { total_bytes: number; file_count: number; path?: string };
  offline_sync_summary: { total_24h: number; ok_24h: number; failed_24h: number };
  recent_errors_5xx: ErrorRow[];
  top_latency_endpoints: LatencyRow[];
}

interface ErrorRow {
  at: string;
  method: string;
  path: string;
  endpoint: string;
  status_code: number;
  duration_ms: number;
}

interface LatencyRow {
  endpoint: string;
  count: number;
  avg_ms: number;
  max_ms: number;
  errors: number;
  errors_5xx: number;
}

interface JobRow {
  id: number;
  job_type: string;
  title: string;
  status: string;
  created_at?: string;
  finished_at?: string;
  error_message?: string;
}

interface SyncLog {
  id: number;
  patient_id: number;
  patient_name: string;
  client_id: string;
  action: string;
  status: string;
  created_at?: string;
}

interface StorageDetail {
  path: string;
  total_bytes: number;
  file_count: number;
  by_extension: { extension: string; count: number; bytes: number }[];
  largest_files: { path: string; bytes: number; url: string }[];
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function statusIcon(status: string) {
  if (status === "healthy") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "degraded") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "unhealthy") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function statusBadge(status: string) {
  const variant =
    status === "healthy" ? "default" : status === "degraded" ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default function SuperadminOps() {
  const token = () => localStorage.getItem("userToken");
  const headers = () => ({
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [latency, setLatency] = useState<LatencyRow[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [storage, setStorage] = useState<StorageDetail | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const [ovRes, errRes, latRes, syncRes, jobRes, storRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/ops/overview`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/ops/errors?hours=24&limit=100`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/ops/latency?limit=50`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/ops/offline-sync-logs?limit=80`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/ops/jobs?limit=40`, { headers: headers() }),
        fetch(`${API_URL}/superadmin/ops/storage`, { headers: headers() }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (errRes.ok) {
        const d = await errRes.json();
        setErrors(d.errors || []);
      }
      if (latRes.ok) {
        const d = await latRes.json();
        setLatency(d.endpoints || []);
      }
      if (syncRes.ok) {
        const d = await syncRes.json();
        setSyncLogs(d.logs || []);
      }
      if (jobRes.ok) {
        const d = await jobRes.json();
        setJobs(d.jobs || []);
      }
      if (storRes.ok) setStorage(await storRes.json());
    } catch {
      toast.error("Error al cargar observabilidad");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 60000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading && !overview) {
    return (
      <SuperadminLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SuperadminLayout>
    );
  }

  const ov = overview!;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Monitoreo y observabilidad</h1>
            <p className="text-muted-foreground text-sm">
              API, base de datos, jobs, errores 5xx, latencia y sync offline
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(ov.overall_status)}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => load(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-primary opacity-80" />
                <div>
                  <p className="text-xs text-muted-foreground">Requests API</p>
                  <p className="text-2xl font-bold">{ov.api_metrics.requests_total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Uptime {formatUptime(ov.api_metrics.uptime_seconds)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive opacity-80" />
                <div>
                  <p className="text-xs text-muted-foreground">Errores 5xx (24h)</p>
                  <p className="text-2xl font-bold">{ov.api_metrics.errors_5xx_24h}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-primary opacity-80" />
                <div>
                  <p className="text-xs text-muted-foreground">Base de datos</p>
                  <p className="text-lg font-semibold capitalize">{ov.database.status}</p>
                  {ov.database.latency_ms != null && (
                    <p className="text-xs text-muted-foreground">{ov.database.latency_ms} ms</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <HardDrive className="h-8 w-8 text-primary opacity-80" />
                <div>
                  <p className="text-xs text-muted-foreground">/uploads</p>
                  <p className="text-lg font-semibold">{formatBytes(ov.storage_summary.total_bytes)}</p>
                  <p className="text-xs text-muted-foreground">{ov.storage_summary.file_count} archivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Health by service */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" /> Health check por servicio
            </CardTitle>
            <CardDescription>Generado {ov.generated_at}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ov.services.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4",
                    s.status === "unhealthy" && "border-destructive/40 bg-destructive/5",
                    s.status === "degraded" && "border-amber-500/40 bg-amber-500/5"
                  )}
                >
                  {statusIcon(s.status)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{s.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.message}</p>
                    {s.latency_ms != null && (
                      <p className="text-xs font-mono mt-1">{s.latency_ms} ms</p>
                    )}
                  </div>
                  {statusBadge(s.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="latency" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="latency" className="gap-1.5">
              <Timer className="h-3.5 w-3.5" /> Latencia
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Errores 5xx
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Cola jobs
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-1.5">
              <Wifi className="h-3.5 w-3.5" /> Sync offline
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> Almacenamiento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="latency">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latencia por endpoint</CardTitle>
                <CardDescription>Promedio desde el último reinicio del API</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead className="text-right">Reqs</TableHead>
                      <TableHead className="text-right">Avg ms</TableHead>
                      <TableHead className="text-right">Max ms</TableHead>
                      <TableHead className="text-right">5xx</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latency.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sin tráfico registrado aún
                        </TableCell>
                      </TableRow>
                    ) : (
                      latency.map((row) => (
                        <TableRow key={row.endpoint}>
                          <TableCell className="font-mono text-xs max-w-md truncate">{row.endpoint}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">{row.avg_ms}</TableCell>
                          <TableCell className="text-right">{row.max_ms}</TableCell>
                          <TableCell className="text-right">{row.errors_5xx}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Errores 5xx — últimas 24 h</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora (UTC)</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                      <TableHead className="text-right">ms</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-emerald-600">
                          Sin errores 5xx en 24 h
                        </TableCell>
                      </TableRow>
                    ) : (
                      errors.map((e, i) => (
                        <TableRow key={`${e.at}-${i}`}>
                          <TableCell className="text-xs">{e.at}</TableCell>
                          <TableCell>{e.method}</TableCell>
                          <TableCell className="font-mono text-xs max-w-xs truncate">{e.path}</TableCell>
                          <TableCell className="text-right">{e.status_code}</TableCell>
                          <TableCell className="text-right">{e.duration_ms}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <div className="grid gap-4 lg:grid-cols-4 mb-4">
              {[
                { label: "Pendientes", value: ov.job_queue.pending },
                { label: "En ejecución", value: ov.job_queue.running },
                { label: "Completados 24h", value: ov.job_queue.completed_24h },
                { label: "Fallidos 24h", value: ov.job_queue.failed_24h },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {ov.job_queue.scheduled_articles > 0 && (
              <p className="text-sm text-muted-foreground mb-3">
                + {ov.job_queue.scheduled_articles} artículos programados para publicación
              </p>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Jobs recientes</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Cola vacía — los jobs aparecen al ejecutar tareas (recordatorios, webhooks…)
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((j) => (
                        <TableRow key={j.id}>
                          <TableCell>{j.id}</TableCell>
                          <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                          <TableCell>{j.title}</TableCell>
                          <TableCell>
                            <Badge variant={j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{j.created_at || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync">
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Sync 24h</p>
                  <p className="text-2xl font-bold">{ov.offline_sync_summary.total_24h}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">OK</p>
                  <p className="text-2xl font-bold text-emerald-600">{ov.offline_sync_summary.ok_24h}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Fallidos / otros</p>
                  <p className="text-2xl font-bold text-amber-600">{ov.offline_sync_summary.failed_24h}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Logs sync offline (Fase 4)</CardTitle>
                <CardDescription>Acciones sincronizadas desde PWA del paciente</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Client ID</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sin logs de sync offline
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.patient_name}</TableCell>
                          <TableCell className="font-mono text-xs">{log.action}</TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-[120px]">{log.client_id}</TableCell>
                          <TableCell>
                            <Badge variant={log.status === "ok" ? "secondary" : "outline"}>{log.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.created_at || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Uso de almacenamiento</CardTitle>
                <CardDescription>{storage?.path || ov.storage_summary.path}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{formatBytes(storage?.total_bytes ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Archivos</p>
                    <p className="text-xl font-bold">{storage?.file_count ?? 0}</p>
                  </div>
                </div>
                {storage?.by_extension && storage.by_extension.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Por extensión</p>
                    <div className="flex flex-wrap gap-2">
                      {storage.by_extension.slice(0, 12).map((e) => (
                        <Badge key={e.extension} variant="outline">
                          {e.extension}: {e.count} ({formatBytes(e.bytes)})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {storage?.largest_files && storage.largest_files.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Archivos más grandes</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Archivo</TableHead>
                          <TableHead className="text-right">Tamaño</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storage.largest_files.map((f) => (
                          <TableRow key={f.path}>
                            <TableCell className="font-mono text-xs truncate max-w-md">{f.path}</TableCell>
                            <TableCell className="text-right">{formatBytes(f.bytes)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperadminLayout>
  );
}
