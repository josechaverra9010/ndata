import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCog,
  Building2,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  GaugeCircle,
  UserMinus,
  UserPlus,
  Target,
  Flame,
  Minus,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { API_URL } from "@/config/api";
import { cn } from "@/lib/utils";

interface MomMetric {
  current: number;
  previous: number;
  change_pct: number;
  change_label: string;
  trend: string;
}

interface DashboardAnalytics {
  generated_at: string;
  kpis: {
    active_users_7d: { value: number; label: string; description: string };
    active_users_30d: { value: number; label: string; description: string };
    new_registrations_month: { value: number; label: string; mom: MomMetric };
    patient_churn: { value: number; rate_pct: number; label: string; description: string };
    global_adherence_week: {
      value: number;
      previous_week: number;
      change_pp: number;
      label: string;
    };
  };
  mom_comparison: Record<string, MomMetric>;
  org_heatmap: Array<{
    org_id: number;
    name: string;
    code: string;
    eps_program?: string;
    patients: number;
    nutritionists: number;
    active_patients_30d: number;
    activity_score: number;
    adherence_pct: number;
    intensity: number;
  }>;
  critical_alerts: Array<{
    severity: string;
    type: string;
    title: string;
    message: string;
    org_id?: number;
    org_name?: string;
    count?: number;
  }>;
  charts: {
    monthly_registrations: Array<{ name: string; year: number; registrations: number; patients: number }>;
  };
  summary: {
    total_users: number;
    total_patients: number;
    total_nutritionists: number;
    total_organizations: number;
    new_orgs_this_month: number;
  };
}

interface DashboardOverviewResponse {
  stats: {
    total_users: { value: number; change: string; trend: string };
    nutritionists: { value: number; change: string; trend: string };
    organizations: { value: number; change: string; trend: string };
    revenue: { value: number; change: string; trend: string; monthly_collected_cop?: number };
  };
  charts: {
    user_growth: Array<{ name: string; usuarios: number; ingresos: number }>;
    monthly_revenue?: Array<{ name: string; ingresos: number }>;
  };
  recent_activity: Array<{ id: string | number; action: string; user: string; time: string; type: string }>;
}

interface DashboardStatsResponse {
  patients: { total: number; change: string; change_type: string };
  plans: { total: number; change: string; change_type: string };
  appointments: { total: number; pending_today: number; change: string; change_type: string };
  progress: { average: number; change: string; change_type: string };
}

interface WeeklyOverviewItem {
  day: string;
  appointments: number;
  new_patients: number;
  metrics: number;
}

interface TopPlanItem {
  id: number;
  name: string;
  patients: number;
  color: string;
}

interface NutritionChartItem {
  category: string;
  avg_protein: number;
  avg_carbs: number;
  avg_fat: number;
}

interface StatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

interface AppointmentsByTypeItem {
  type: string;
  count: number;
}

function TrendBadge({ trend, label }: { trend: string; label: string }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <p className={cn("text-xs flex items-center gap-1 mt-1", color)}>
      <Icon className="h-3 w-3" />
      {label}
    </p>
  );
}

function heatColor(intensity: number) {
  if (intensity >= 0.75) return "bg-emerald-500/80 text-white";
  if (intensity >= 0.5) return "bg-emerald-400/60 text-emerald-950";
  if (intensity >= 0.25) return "bg-amber-400/50 text-amber-950";
  if (intensity > 0) return "bg-orange-300/40 text-orange-950";
  return "bg-muted text-muted-foreground";
}

export default function SuperadminDashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyOverviewItem[]>([]);
  const [topPlans, setTopPlans] = useState<TopPlanItem[]>([]);
  const [nutritionChart, setNutritionChart] = useState<NutritionChartItem[]>([]);
  const [patientStatus, setPatientStatus] = useState<StatusDistributionItem[]>([]);
  const [appointmentsByType, setAppointmentsByType] = useState<AppointmentsByTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("userToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const [
          analyticsRes,
          overviewRes,
          dashboardStatsRes,
          weeklyOverviewRes,
          topPlansRes,
          nutritionChartRes,
          patientStatusRes,
          appointmentsByTypeRes,
        ] = await Promise.all([
          fetch(`${API_URL}/superadmin/dashboard/analytics`, { headers }),
          fetch(`${API_URL}/superadmin/dashboard/overview`, { headers }),
          fetch(`${API_URL}/dashboard/stats`, { headers }),
          fetch(`${API_URL}/dashboard/weekly-overview`, { headers }),
          fetch(`${API_URL}/dashboard/top-plans`, { headers }),
          fetch(`${API_URL}/dashboard/nutrition-chart`, { headers }),
          fetch(`${API_URL}/dashboard/patient-status-distribution`, { headers }),
          fetch(`${API_URL}/dashboard/appointments-by-type`, { headers }),
        ]);

        if (!analyticsRes.ok) throw new Error("No se pudo cargar analytics del dashboard");
        setAnalytics(await analyticsRes.json());

        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (dashboardStatsRes.ok) setDashboardStats(await dashboardStatsRes.json());
        if (weeklyOverviewRes.ok) setWeeklyOverview(await weeklyOverviewRes.json());
        if (topPlansRes.ok) setTopPlans(await topPlansRes.json());
        if (nutritionChartRes.ok) setNutritionChart(await nutritionChartRes.json());
        if (patientStatusRes.ok) setPatientStatus(await patientStatusRes.json());
        if (appointmentsByTypeRes.ok) setAppointmentsByType(await appointmentsByTypeRes.json());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error al cargar el dashboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const stats = overview?.stats;
  const kpis = analytics?.kpis;
  const monthlyChart = analytics?.charts.monthly_registrations ?? [];
  const alerts = analytics?.critical_alerts ?? [];
  const heatmap = analytics?.org_heatmap ?? [];
  const mom = analytics?.mom_comparison;
  const activity = overview?.recent_activity ?? [];
  const revenueChart =
    overview?.charts.monthly_revenue ??
    overview?.charts.user_growth?.map((row) => ({ name: row.name, ingresos: row.ingresos })) ??
    [];

  const formatCop = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  const alertStyles: Record<string, string> = {
    critical: "border-destructive/40 bg-destructive/5",
    warning: "border-amber-500/40 bg-amber-500/5",
    info: "border-sky-500/40 bg-sky-500/5",
  };

  return (
    <SuperadminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-fade-in flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Dashboard SuperAdmin</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              KPIs en tiempo real, alertas y salud por organización/EPS
            </p>
          </div>
          {analytics?.generated_at && (
            <p className="text-xs text-muted-foreground">Actualizado: {analytics.generated_at}</p>
          )}
        </div>

        {loading && (
          <Card className="border-border bg-card">
            <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
              Cargando datos del sistema...
            </CardContent>
          </Card>
        )}

        {error && !loading && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {/* KPIs tiempo real */}
        {kpis && !loading && (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5 animate-fade-in">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Activos 7d
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.active_users_7d.value}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{kpis.active_users_7d.description}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Activity className="h-4 w-4 text-primary" />
                  Activos 30d
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.active_users_30d.value}</div>
                {mom?.active_patients_30d && (
                  <TrendBadge trend={mom.active_patients_30d.trend} label={mom.active_patients_30d.change_label} />
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  Nuevos (mes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.new_registrations_month.value}</div>
                <TrendBadge
                  trend={kpis.new_registrations_month.mom.trend}
                  label={kpis.new_registrations_month.mom.change_label}
                />
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <UserMinus className="h-4 w-4 text-destructive" />
                  Churn 30d
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.patient_churn.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis.patient_churn.rate_pct}% del cohorte previo</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Target className="h-4 w-4 text-accent" />
                  Adherencia global
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kpis.global_adherence_week.value}
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p
                  className={cn(
                    "text-xs mt-1",
                    kpis.global_adherence_week.change_pp >= 0 ? "text-emerald-600" : "text-destructive"
                  )}
                >
                  {kpis.global_adherence_week.change_pp >= 0 ? "+" : ""}
                  {kpis.global_adherence_week.change_pp} pp vs semana anterior ({kpis.global_adherence_week.previous_week}%)
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alertas críticas */}
        {!loading && alerts.length > 0 && (
          <Card className="border-border bg-card animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Alertas críticas
                <Badge variant="destructive">{alerts.filter((a) => a.severity === "critical").length}</Badge>
              </CardTitle>
              <CardDescription>Requieren atención del superadmin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((alert, idx) => (
                <div
                  key={`${alert.type}-${idx}`}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3",
                    alertStyles[alert.severity] ?? alertStyles.info
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          alert.severity === "critical"
                            ? "destructive"
                            : alert.severity === "warning"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {alert.severity}
                      </Badge>
                      <p className="font-medium text-sm">{alert.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                  {alert.org_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/superadmin/organizations")}
                    >
                      Ver org
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* MOM + resumen plataforma */}
        {stats && mom && !loading && (
          <div className="grid gap-4 lg:grid-cols-2 animate-fade-in">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Comparativa mes vs mes (MOM)</CardTitle>
                <CardDescription>Periodo actual vs mes anterior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { key: "new_registrations", label: "Nuevos registros" },
                    { key: "new_patients", label: "Nuevos pacientes" },
                    { key: "active_patients_30d", label: "Pacientes activos (30d)" },
                    { key: "total_users", label: "Usuarios nuevos" },
                  ].map(({ key, label }) => {
                    const m = mom[key];
                    if (!m) return null;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <div className="text-right">
                          <span className="font-semibold">{m.current}</span>
                          <span className="text-muted-foreground mx-1">vs</span>
                          <span className="text-muted-foreground">{m.previous}</span>
                          <TrendBadge trend={m.trend} label={m.change_label} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total usuarios", value: stats.total_users.value, change: stats.total_users.change, icon: Users },
                { label: "Nutricionistas", value: stats.nutritionists.value, change: stats.nutritionists.change, icon: UserCog },
                { label: "Organizaciones", value: stats.organizations.value, change: stats.organizations.change, icon: Building2 },
                {
                  label: "MRR (COP)",
                  value: formatCop(stats.revenue.value),
                  change: stats.revenue.change,
                  icon: DollarSign,
                  raw: true,
                },
                {
                  label: "Pacientes activos",
                  value: analytics?.summary.total_patients ?? 0,
                  change: dashboardStats?.patients.change ?? "",
                  icon: GaugeCircle,
                },
              ].map(({ label, value, change, icon: Icon, raw }) => (
                <Card key={label} className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                    <Icon className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className={cn("font-bold", raw ? "text-lg sm:text-xl" : "text-2xl")}>{value}</div>
                    {change && <p className="text-xs text-muted-foreground mt-1">{change}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Mapa de calor por org/EPS */}
        {!loading && heatmap.length > 0 && (
          <Card className="border-border bg-card animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Mapa de calor — Organizaciones / EPS</CardTitle>
              <CardDescription>
                Intensidad = actividad de pacientes (30 días). Verde = alta actividad, ámbar/naranja = baja.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {heatmap.map((org) => (
                  <div
                    key={org.org_id}
                    className={cn(
                      "rounded-lg p-3 border border-border/50 transition-transform hover:scale-[1.02] cursor-default",
                      heatColor(org.intensity)
                    )}
                    title={`${org.name}: ${org.activity_score}% actividad, ${org.adherence_pct}% adherencia`}
                  >
                    <p className="font-semibold text-sm truncate">{org.name}</p>
                    <p className="text-[10px] opacity-80 truncate">{org.code}{org.eps_program ? ` · ${org.eps_program}` : ""}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                      <span>{org.patients} pac.</span>
                      <span>{org.nutritionists} nutri.</span>
                      <span>{org.active_patients_30d} activos</span>
                      <span>{org.adherence_pct}% adher.</span>
                    </div>
                  </div>
                ))}
              </div>
              {heatmap.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay organizaciones registradas.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ingresos mensuales */}
        {!loading && revenueChart.length > 0 && (
          <Card className="border-border bg-card animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Ingresos facturados (6 meses)
              </CardTitle>
              <CardDescription>Facturas marcadas como pagadas — datos reales de billing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCop(v)} />
                    <Bar dataKey="ingresos" fill="hsl(var(--primary))" name="Ingresos COP" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráficos principales */}
        {!loading && monthlyChart.length > 0 && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 animate-fade-in">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Registros por mes (6 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="registrations"
                        name="Registros"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                      />
                      <Area
                        type="monotone"
                        dataKey="patients"
                        name="Pacientes"
                        stroke="hsl(var(--accent))"
                        fill="hsl(var(--accent) / 0.15)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Actividad de la semana</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyOverview}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="appointments" stroke="hsl(var(--primary))" name="Citas" />
                      <Line type="monotone" dataKey="new_patients" stroke="hsl(var(--accent))" name="Nuevos pacientes" />
                      <Line type="monotone" dataKey="metrics" stroke="hsl(var(--info))" name="Métricas" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats clínicos + distribución */}
        {dashboardStats && !loading && (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Planes activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.plans.total}</div>
                <p className="text-xs text-muted-foreground mt-1">{dashboardStats.plans.change}</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Citas (semana)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.appointments.total}</div>
                <p className="text-xs text-muted-foreground mt-1">Hoy: {dashboardStats.appointments.pending_today}</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Progreso promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.progress.average}%</div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estado pacientes</CardTitle>
              </CardHeader>
              <CardContent className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={patientStatus} dataKey="count" nameKey="status" innerRadius={20} outerRadius={35}>
                      {patientStatus.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? "hsl(var(--success))" : i === 1 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Planes y citas */}
        {!loading && (topPlans.length > 0 || appointmentsByType.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {topPlans.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Planes más populares
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topPlans}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="patients" radius={[4, 4, 0, 0]}>
                        {topPlans.map((plan, i) => (
                          <Cell key={plan.id} fill={plan.color || `hsl(var(--primary) / ${0.4 + i * 0.1})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {appointmentsByType.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Citas por tipo
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={appointmentsByType} dataKey="count" nameKey="type" outerRadius={70} label>
                        {appointmentsByType.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Actividad reciente */}
        {!loading && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Actividad reciente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay actividad reciente.</p>
              )}
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.action}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.user}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </SuperadminLayout>
  );
}
