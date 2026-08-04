import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  BarChart3,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Overview {
  generated_at: string;
  funnel_summary: {
    registered: number;
    profile_complete: number;
    first_plan: number;
    adherence_70: number;
  };
  nps_score: number;
  post_consultation_nps: number;
  avg_session_minutes: number;
  top_patient_module?: { label: string; events: number } | null;
  top_nutritionist_module?: { label: string; events: number } | null;
}

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  conversion_from_previous_pct: number;
  conversion_from_registration_pct: number;
}

interface CohortRow {
  cohort_month: string;
  size: number;
  profile_complete_pct: number;
  first_plan_pct: number;
  adherence_70_pct: number;
  retention: { month_offset: number; month: string; active_users: number; retention_pct: number }[];
}

interface ModuleRow {
  module_key: string;
  label: string;
  unique_users: number;
  events: number;
}

interface NpsData {
  nps_score: number;
  post_consultation_nps: number;
  total_responses: number;
  avg_score: number;
  promoters: number;
  passives: number;
  detractors: number;
  distribution: { score: number; count: number }[];
  recent: {
    id: number;
    score: number;
    category: string;
    comment?: string;
    user_name: string;
    created_at?: string;
  }[];
}

const FUNNEL_COLORS = ["#7a9b76", "#5b8a72", "#3d7968", "#1f685e"];

function authHeaders() {
  return {
    ...(localStorage.getItem("userToken")
      ? { Authorization: `Bearer ${localStorage.getItem("userToken")}` }
      : {}),
  };
}

export default function SuperadminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [modules, setModules] = useState<{ patient: ModuleRow[]; nutritionist: ModuleRow[]; source: string } | null>(null);
  const [sessions, setSessions] = useState<{
    avg_duration_minutes: number;
    total_sessions: number;
    by_role: Record<string, { sessions: number; avg_duration_minutes: number }>;
    daily: { date: string; sessions: number }[];
  } | null>(null);
  const [nps, setNps] = useState<NpsData | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, fu, co, mo, se, np] = await Promise.all([
        fetch(`${API_URL}/superadmin/analytics/overview`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/analytics/funnel`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/analytics/cohorts?months=12`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/analytics/modules?days=30`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/analytics/sessions?days=30`, { headers: authHeaders() }),
        fetch(`${API_URL}/superadmin/analytics/nps?days=90`, { headers: authHeaders() }),
      ]);
      if (!ov.ok) throw new Error("Error cargando analítica");
      const ovData = await ov.json();
      setOverview(ovData);
      if (fu.ok) {
        const fuData = await fu.json();
        setFunnel(fuData.stages || []);
      }
      if (co.ok) {
        const coData = await co.json();
        setCohorts(coData.cohorts || []);
      }
      if (mo.ok) setModules(await mo.json());
      if (se.ok) setSessions(await se.json());
      if (np.ok) setNps(await np.json());
    } catch {
      toast.error("No se pudo cargar la analítica de plataforma");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const npsColor = (score: number) =>
    score >= 50 ? "text-emerald-600" : score >= 0 ? "text-amber-600" : "text-red-600";

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Analítica de plataforma
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Embudo de conversión, cohortes, módulos, sesiones y NPS post-consulta
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const token = localStorage.getItem("userToken");
                  const res = await fetch(`${API_URL}/superadmin/analytics/export?days=30`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  if (!res.ok) throw new Error();
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "analytics-30d.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Error al exportar");
                }
              }}
            >
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Actualizar</span>
            </Button>
          </div>
        </div>

        {loading && !overview ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pacientes registrados</CardDescription>
                  <CardTitle className="text-3xl">{overview?.funnel_summary.registered ?? 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {overview?.funnel_summary.adherence_70 ?? 0} con adherencia ≥70%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>NPS global (90d)</CardDescription>
                  <CardTitle className={`text-3xl ${npsColor(overview?.nps_score ?? 0)}`}>
                    {overview?.nps_score ?? 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Post-consulta: {overview?.post_consultation_nps ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Tiempo medio en app</CardDescription>
                  <CardTitle className="text-3xl">{overview?.avg_session_minutes ?? 0} min</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Últimos 30 días
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Módulo más usado</CardDescription>
                  <CardTitle className="text-lg truncate">
                    {overview?.top_patient_module?.label ?? "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Nutri: {overview?.top_nutritionist_module?.label ?? "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="funnel" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="funnel">Embudo</TabsTrigger>
                <TabsTrigger value="cohorts">Cohortes</TabsTrigger>
                <TabsTrigger value="modules">Módulos</TabsTrigger>
                <TabsTrigger value="sessions">Sesiones</TabsTrigger>
                <TabsTrigger value="nps">NPS</TabsTrigger>
              </TabsList>

              <TabsContent value="funnel" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Embudo de activación
                    </CardTitle>
                    <CardDescription>
                      Registro → Perfil completo → Primer plan → Adherencia ≥70%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnel} layout="vertical" margin={{ left: 120 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(v: number, _n, p) => [
                              `${v} (${(p.payload as FunnelStage).conversion_from_registration_pct}% del total)`,
                              "Usuarios",
                            ]}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {funnel.map((_, i) => (
                              <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <Table className="mt-6">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Usuarios</TableHead>
                          <TableHead className="text-right">Conv. etapa anterior</TableHead>
                          <TableHead className="text-right">Conv. desde registro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funnel.map((s) => (
                          <TableRow key={s.key}>
                            <TableCell className="font-medium">{s.label}</TableCell>
                            <TableCell className="text-right">{s.count}</TableCell>
                            <TableCell className="text-right">{s.conversion_from_previous_pct}%</TableCell>
                            <TableCell className="text-right">{s.conversion_from_registration_pct}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cohorts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Cohortes por mes de registro
                    </CardTitle>
                    <CardDescription>Retención mensual y hitos por cohorte</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cohorte</TableHead>
                          <TableHead className="text-right">Tamaño</TableHead>
                          <TableHead className="text-right">Perfil %</TableHead>
                          <TableHead className="text-right">Plan %</TableHead>
                          <TableHead className="text-right">Adh. 70%</TableHead>
                          <TableHead className="text-right">M+1 ret.</TableHead>
                          <TableHead className="text-right">M+3 ret.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cohorts.map((c) => (
                          <TableRow key={c.cohort_month}>
                            <TableCell className="font-medium">{c.cohort_month}</TableCell>
                            <TableCell className="text-right">{c.size}</TableCell>
                            <TableCell className="text-right">{c.profile_complete_pct}%</TableCell>
                            <TableCell className="text-right">{c.first_plan_pct}%</TableCell>
                            <TableCell className="text-right">{c.adherence_70_pct}%</TableCell>
                            <TableCell className="text-right">
                              {c.retention.find((r) => r.month_offset === 1)?.retention_pct ?? "—"}%
                            </TableCell>
                            <TableCell className="text-right">
                              {c.retention.find((r) => r.month_offset === 3)?.retention_pct ?? "—"}%
                            </TableCell>
                          </TableRow>
                        ))}
                        {!cohorts.length && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              Sin datos de cohortes
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="modules" className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">
                    Fuente: {modules?.source === "tracked" ? "Tracking en vivo" : "Datos derivados"}
                  </Badge>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Paciente — módulos más usados</CardTitle>
                      <CardDescription>Últimos 30 días</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(modules?.patient || []).slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="events" fill="#7a9b76" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Nutricionista — módulos más usados</CardTitle>
                      <CardDescription>Últimos 30 días</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(modules?.nutritionist || []).slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="events" fill="#3d7968" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sessions" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Sesiones totales</CardDescription>
                      <CardTitle className="text-2xl">{sessions?.total_sessions ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Duración media</CardDescription>
                      <CardTitle className="text-2xl">{sessions?.avg_duration_minutes ?? 0} min</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Pacientes / Nutricionistas</CardDescription>
                      <CardTitle className="text-sm font-normal mt-1">
                        {sessions?.by_role?.patient?.avg_duration_minutes ?? 0} min /{" "}
                        {sessions?.by_role?.admin?.avg_duration_minutes ?? 0} min
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Sesiones por día</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sessions?.daily || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="sessions" stroke="#7a9b76" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="nps" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>NPS score</CardDescription>
                      <CardTitle className={`text-3xl ${npsColor(nps?.nps_score ?? 0)}`}>
                        {nps?.nps_score ?? 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Post-consulta</CardDescription>
                      <CardTitle className="text-3xl">{nps?.post_consultation_nps ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Promedio 0–10</CardDescription>
                      <CardTitle className="text-3xl">{nps?.avg_score ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Respuestas</CardDescription>
                      <CardTitle className="text-3xl">{nps?.total_responses ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribución de scores</CardTitle>
                    </CardHeader>
                    <CardContent className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={nps?.distribution || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="score" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#7a9b76" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Segmentos NPS</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Promotores (9–10)</span>
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-0">{nps?.promoters ?? 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Pasivos (7–8)</span>
                        <Badge className="bg-amber-500/15 text-amber-700 border-0">{nps?.passives ?? 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Detractores (0–6)</span>
                        <Badge className="bg-red-500/15 text-red-700 border-0">{nps?.detractors ?? 0}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Encuestas recientes</CardTitle>
                    <CardDescription>Feedback post-consulta y general</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Paciente</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Comentario</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(nps?.recent || []).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.user_name}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  r.category === "promoter"
                                    ? "bg-emerald-500/15 text-emerald-700 border-0"
                                    : r.category === "passive"
                                      ? "bg-amber-500/15 text-amber-700 border-0"
                                      : "bg-red-500/15 text-red-700 border-0"
                                }
                              >
                                {r.score}
                              </Badge>
                            </TableCell>
                            <TableCell>{r.category}</TableCell>
                            <TableCell className="max-w-xs truncate">{r.comment || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{r.created_at || "—"}</TableCell>
                          </TableRow>
                        ))}
                        {!nps?.recent?.length && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              Aún no hay encuestas NPS
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </SuperadminLayout>
  );
}
