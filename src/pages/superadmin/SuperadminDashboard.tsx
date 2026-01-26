import { useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserCog,
  Building2,
  TrendingUp,
  Activity,
  DollarSign,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  GaugeCircle,
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

interface DashboardStatItem {
  value: number;
  change: string;
  trend: string;
}

interface UserGrowthItem {
  name: string;
  usuarios: number;
  ingresos: number;
}

interface DashboardActivityItem {
  id: string | number;
  action: string;
  user: string;
  time: string;
  type: string;
}

interface DashboardOverviewResponse {
  stats: {
    total_users: DashboardStatItem;
    nutritionists: DashboardStatItem;
    organizations: DashboardStatItem;
    revenue: DashboardStatItem;
  };
  charts: {
    user_growth: UserGrowthItem[];
  };
  recent_activity: DashboardActivityItem[];
}

interface DashboardStatsResponse {
  patients: {
    total: number;
    change: string;
    change_type: string;
  };
  plans: {
    total: number;
    change: string;
    change_type: string;
  };
  appointments: {
    total: number;
    pending_today: number;
    change: string;
    change_type: string;
  };
  progress: {
    average: number;
    change: string;
    change_type: string;
  };
}

interface WeeklyOverviewItem {
  day: string;
  date: string;
  appointments: number;
  new_patients: number;
  metrics: number;
  is_today: boolean;
}

interface TopPlanItem {
  id: number;
  name: string;
  category: string;
  color: string;
  patients: number;
}

interface NutritionChartItem {
  category: string;
  patients: number;
  avg_calories: number;
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

interface ProgressStatsResponse {
  total_patients: number;
  avg_adherence: number;
  patients_on_track: number;
  total_weight_lost: number;
}

export default function SuperadminDashboard() {
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyOverviewItem[]>([]);
  const [topPlans, setTopPlans] = useState<TopPlanItem[]>([]);
  const [nutritionChart, setNutritionChart] = useState<NutritionChartItem[]>([]);
  const [patientStatus, setPatientStatus] = useState<StatusDistributionItem[]>([]);
  const [appointmentsByType, setAppointmentsByType] = useState<AppointmentsByTypeItem[]>([]);
  const [progressStats, setProgressStats] = useState<ProgressStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);
        const [
          overviewRes,
          dashboardStatsRes,
          weeklyOverviewRes,
          topPlansRes,
          nutritionChartRes,
          patientStatusRes,
          appointmentsByTypeRes,
          progressStatsRes,
        ] = await Promise.all([
          fetch(`${API_URL}/superadmin/dashboard/overview`),
          fetch(`${API_URL}/dashboard/stats`),
          fetch(`${API_URL}/dashboard/weekly-overview`),
          fetch(`${API_URL}/dashboard/top-plans`),
          fetch(`${API_URL}/dashboard/nutrition-chart`),
          fetch(`${API_URL}/dashboard/patient-status-distribution`),
          fetch(`${API_URL}/dashboard/appointments-by-type`),
          fetch(`${API_URL}/progress/stats`),
        ]);

        if (!overviewRes.ok) throw new Error("No se pudo cargar el resumen de superadmin");

        const overviewData = await overviewRes.json();
        setOverview(overviewData);

        if (dashboardStatsRes.ok) {
          setDashboardStats(await dashboardStatsRes.json());
        }
        if (weeklyOverviewRes.ok) {
          setWeeklyOverview(await weeklyOverviewRes.json());
        }
        if (topPlansRes.ok) {
          setTopPlans(await topPlansRes.json());
        }
        if (nutritionChartRes.ok) {
          setNutritionChart(await nutritionChartRes.json());
        }
        if (patientStatusRes.ok) {
          setPatientStatus(await patientStatusRes.json());
        }
        if (appointmentsByTypeRes.ok) {
          setAppointmentsByType(await appointmentsByTypeRes.json());
        }
        if (progressStatsRes.ok) {
          setProgressStats(await progressStatsRes.json());
        }
      } catch (err: any) {
        console.error("Error cargando dashboard superadmin:", err);
        setError(err.message || "Error al cargar el dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const stats = overview?.stats;
  const chartData = overview?.charts.user_growth ?? [];
  const activity = overview?.recent_activity ?? [];

  return (
    <SuperadminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Dashboard SuperAdmin</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Vista general del sistema</p>
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
            <CardContent className="py-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Stats Grid - Usuarios / Nutris / Orgs / Ingresos */}
        {stats && !loading && (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in" style={{ animationDelay: "50ms" }}>
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Usuarios</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stats.total_users.value}</div>
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  {stats.total_users.change}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Nutricionistas</CardTitle>
                <UserCog className="h-5 w-5 text-info" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stats.nutritionists.value}</div>
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  {stats.nutritionists.change}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Organizaciones</CardTitle>
                <Building2 className="h-5 w-5 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stats.organizations.value}</div>
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  {stats.organizations.change}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Mensuales</CardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  ${stats.revenue.value.toLocaleString("es-CO")}
                </div>
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  {stats.revenue.change}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Grid - Pacientes / Planes / Citas / Progreso */}
        {dashboardStats && !loading && (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes Activos</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{dashboardStats.patients.total}</div>
                <p className="text-xs text-success mt-1">{dashboardStats.patients.change}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Planes Activos</CardTitle>
                <BarChart3 className="h-5 w-5 text-info" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{dashboardStats.plans.total}</div>
                <p className="text-xs text-success mt-1">{dashboardStats.plans.change}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Citas (semana)</CardTitle>
                <Activity className="h-5 w-5 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{dashboardStats.appointments.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pendientes hoy: {dashboardStats.appointments.pending_today}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Progreso Promedio</CardTitle>
                <GaugeCircle className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardStats.progress.average}
                  <span className="text-xs text-muted-foreground ml-1">%</span>
                </div>
                <p className="text-xs text-success mt-1">{dashboardStats.progress.change}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts - Crecimiento de usuarios / Ingresos */}
        {!loading && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Crecimiento de Usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
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
                        dataKey="usuarios"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Ingresos Mensuales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
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
                      <Bar dataKey="ingresos" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts - Semana en curso / Distribución pacientes */}
        {!loading && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Actividad de la Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyOverview}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line type="monotone" dataKey="appointments" stroke="hsl(var(--primary))" name="Citas" />
                      <Line type="monotone" dataKey="new_patients" stroke="hsl(var(--accent))" name="Nuevos Pacientes" />
                      <Line type="monotone" dataKey="metrics" stroke="hsl(var(--info))" name="Métricas Progreso" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Distribución de Pacientes por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={patientStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ status, percentage }) => `${status} (${percentage}%)`}
                      >
                        {patientStatus.map((s, index) => (
                          <Cell
                            key={s.status}
                            fill={
                              index === 0
                                ? "hsl(var(--success))"
                                : index === 1
                                ? "hsl(var(--warning))"
                                : "hsl(var(--muted-foreground))"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts - Planes / Citas por tipo / Macronutrientes */}
        {!loading && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Planes Más Populares</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topPlans}>
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
                      <Bar dataKey="patients" radius={[4, 4, 0, 0]}>
                        {topPlans.map((plan, index) => (
                          <Cell key={plan.id} fill={plan.color || `hsl(var(--primary) / ${0.4 + index * 0.1})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Citas por Tipo (Semana)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={appointmentsByType}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        label={({ type, count }) => `${type} (${count})`}
                      >
                        {appointmentsByType.map((item, index) => (
                          <Cell
                            key={item.type}
                            fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Distribución de Macronutrientes por Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nutritionChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="category" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="avg_protein" stackId="a" fill="hsl(var(--accent))" name="Proteína" />
                      <Bar dataKey="avg_carbs" stackId="a" fill="hsl(var(--primary))" name="Carbos" />
                      <Bar dataKey="avg_fat" stackId="a" fill="hsl(var(--warning))" name="Grasas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Activity */}
        {!loading && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activity.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay actividad reciente registrada.</p>
                )}
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        item.type === "alert"
                          ? "bg-destructive/10"
                          : item.type === "billing"
                          ? "bg-accent/10"
                          : item.type === "org"
                          ? "bg-warning/10"
                          : "bg-primary/10"
                      }`}
                    >
                      {item.type === "alert" ? (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      ) : item.type === "billing" ? (
                        <DollarSign className="h-5 w-5 text-accent" />
                      ) : item.type === "org" ? (
                        <Building2 className="h-5 w-5 text-warning" />
                      ) : (
                        <Users className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.action}</p>
                      <p className="text-sm text-muted-foreground">{item.user}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SuperadminLayout>
  );
}
