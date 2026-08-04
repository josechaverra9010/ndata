import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { StatsCard } from "@/components/admin/StatsCard";
import { useAuth } from "@/hooks/useAuth";
import { RecentPatients } from "@/components/admin/RecentPatients";
import { UpcomingAppointments } from "@/components/admin/UpcomingAppointments";
import { NutritionChart } from "@/components/admin/NutritionChart";
import { WorkQueuePanel, type WorkQueueData } from "@/components/admin/WorkQueuePanel";
import { AtRiskPatientsWidget } from "@/components/admin/AtRiskPatientsWidget";
import { Users, Calendar, TrendingUp, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// API Configuration
import { API_URL } from "@/config/api";
import { todayInColombiaISO, todayLabelColombia } from "@/lib/timezone";

interface DashboardStats {
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

interface RecentPatient {
  id: number;
  name: string;
  avatar: string | null;
  email: string;
  plan: string;
  status: string;
  joined: string;
  registered_at: string | null;
}

interface UpcomingAppointment {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_avatar: string | null;
  date: string;
  date_label: string;
  time: string;
  duration: string;
  type: string;
  status: string;
  notes?: string;
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [topPatients, setTopPatients] = useState<any[]>([]);
  const [workQueue, setWorkQueue] = useState<WorkQueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("userToken");
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        };

        const permsRes = await fetch(`${API_URL}/admin/me/permissions`, { headers });
        if (permsRes.ok) {
          const perms = await permsRes.json();
          if (perms.staff_role === "org_admin") {
            navigate("/eps", { replace: true });
            return;
          }
        }

        console.log('🔄 Iniciando fetch de datos del dashboard...');

        // Fetch stats, pacientes, citas y top progress en paralelo
        const [statsResponse, patientsResponse, appointmentsResponse, topPatientsResponse, workQueueResponse] = await Promise.all([
          fetch(`${API_URL}/dashboard/stats`, { headers }),
          fetch(`${API_URL}/dashboard/recent-patients?limit=5`, { headers }),
          fetch(`${API_URL}/dashboard/upcoming-appointments?limit=5`, { headers }),
          fetch(`${API_URL}/dashboard/top-patients-progress?limit=3`, { headers }),
          fetch(`${API_URL}/nutritionist/work-queue`, { headers }),
        ]);

        console.log('📊 Stats response status:', statsResponse.status);
        console.log('👥 Patients response status:', patientsResponse.status);
        console.log('📅 Appointments response status:', appointmentsResponse.status);
        console.log('🏆 Top patients response status:', topPatientsResponse.status);

        if (!statsResponse.ok) {
          throw new Error(`Error al cargar las estadísticas: ${statsResponse.status}`);
        }
        if (!patientsResponse.ok) {
          throw new Error(`Error al cargar pacientes recientes: ${patientsResponse.status}`);
        }
        if (!appointmentsResponse.ok) {
          throw new Error(`Error al cargar citas: ${appointmentsResponse.status}`);
        }
        if (!topPatientsResponse.ok) {
          throw new Error(`Error al cargar top pacientes: ${topPatientsResponse.status}`);
        }

        const [statsData, patientsData, appointmentsData, topPatientsData, workQueueData] = await Promise.all([
          statsResponse.json(),
          patientsResponse.json(),
          appointmentsResponse.json(),
          topPatientsResponse.json(),
          workQueueResponse.ok ? workQueueResponse.json() : null,
        ]);

        console.log('✅ Stats data:', statsData);
        console.log('✅ Patients data:', patientsData);
        console.log('✅ Appointments data:', appointmentsData);
        console.log('✅ Top patients data:', topPatientsData);

        setStats(statsData);
        setRecentPatients(patientsData);
        setUpcomingAppointments(appointmentsData);
        setTopPatients(topPatientsData);
        setWorkQueue(workQueueData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        console.error('❌ Error fetching dashboard data:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
        console.log('✔️ Fetch completado, loading = false');
      }
    };

    fetchDashboardData();
  }, []);

  const refreshDashboard = () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("userToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    Promise.all([
      fetch(`${API_URL}/dashboard/stats`, { headers }),
      fetch(`${API_URL}/dashboard/recent-patients?limit=5`, { headers }),
      fetch(`${API_URL}/dashboard/upcoming-appointments?limit=5`, { headers }),
      fetch(`${API_URL}/dashboard/top-patients-progress?limit=3`, { headers }),
      fetch(`${API_URL}/nutritionist/work-queue`, { headers }),
    ])
      .then(async ([statsResponse, patientsResponse, appointmentsResponse, topPatientsResponse, workQueueResponse]) => {
        if (!statsResponse.ok || !patientsResponse.ok || !appointmentsResponse.ok || !topPatientsResponse.ok) {
          throw new Error("Error al refrescar el dashboard");
        }
        const [statsData, patientsData, appointmentsData, topPatientsData, workQueueData] = await Promise.all([
          statsResponse.json(),
          patientsResponse.json(),
          appointmentsResponse.json(),
          topPatientsResponse.json(),
          workQueueResponse.ok ? workQueueResponse.json() : null,
        ]);
        setStats(statsData);
        setRecentPatients(patientsData);
        setUpcomingAppointments(appointmentsData);
        setTopPatients(topPatientsData);
        setWorkQueue(workQueueData);
      })
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        setError(errorMessage);
      })
      .finally(() => setLoading(false));
  };
  // Log cuando cambia el estado
  useEffect(() => {
    console.log('🔄 Estado actualizado:');
    console.log('  - Loading:', loading);
    console.log('  - Error:', error);
    console.log('  - Stats:', stats);
    console.log('  - Patients count:', recentPatients.length);
    console.log('  - Appointments count:', upcomingAppointments.length);
    console.log('  - Top patients count:', topPatients.length);
  }, [loading, error, stats, recentPatients, upcomingAppointments, topPatients]);

  // Mostrar error si existe (después de la animación de carga)
  const firstName =
    (user?.name || user?.email || "Nutricionista").split(" ")[0] || "Nutricionista";
  const todayLabel = todayLabelColombia();

  return (
    <AdminLayout>
      <LoadingGate loading={loading} message="Cargando dashboard" className="min-h-[50vh]">
        {error ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-card">
              <p className="text-destructive font-semibold mb-2">Error al cargar el dashboard</p>
              <p className="text-sm text-muted-foreground mb-5">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-full px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
      <div className="space-y-7">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.07] p-6 shadow-card animate-fade-in">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2">
                Panel del nutricionista
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground capitalize">
                Buen día, {firstName}
              </h1>
              <p className="mt-1.5 text-muted-foreground">
                Aquí tienes el resumen de tu práctica.{" "}
                <span className="capitalize text-foreground/80">{todayLabel}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Citas hoy</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {stats?.appointments.pending_today ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Promedio</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {stats?.progress.average ?? 0}%
                </p>
              </div>
              {(workQueue?.summary.patients_at_risk ?? 0) > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-center backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide text-destructive/80">En riesgo</p>
                  <p className="text-lg font-bold tabular-nums text-destructive">
                    {workQueue?.summary.patients_at_risk}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Pacientes Activos"
            value={stats?.patients.total.toString() || "0"}
            change={stats?.patients.change || "Sin cambios"}
            changeType={stats?.patients.change_type as "positive" | "negative" | "neutral"}
            icon={Users}
            iconColor="primary"
            style={{ animationDelay: "40ms" }}
            onClick={() => navigate("/patients")}
          />
          <StatsCard
            title="Citas Hoy"
            value={String(stats?.appointments.pending_today ?? 0)}
            change={stats?.appointments.change || "0 esta semana"}
            changeType={stats?.appointments.change_type as "positive" | "negative" | "neutral"}
            icon={Calendar}
            iconColor="info"
            style={{ animationDelay: "80ms" }}
            onClick={() => {
              const today = todayInColombiaISO();
              navigate(`/appointments?date=${today}&view=day`);
            }}
          />
          <StatsCard
            title="Citas Esta Semana"
            value={stats?.appointments.total.toString() || "0"}
            change="Ver calendario"
            changeType="neutral"
            icon={CalendarDays}
            iconColor="accent"
            style={{ animationDelay: "120ms" }}
            onClick={() => navigate("/appointments")}
          />
          <StatsCard
            title="Progreso Promedio"
            value={`${stats?.progress.average || 0}%`}
            change={stats?.progress.change || "Sin datos de peso"}
            changeType={stats?.progress.change_type as "positive" | "negative" | "neutral"}
            icon={TrendingUp}
            iconColor="warning"
            style={{ animationDelay: "160ms" }}
            onClick={() => navigate("/progress")}
          />
        </div>

        {/* Cola de trabajo + pacientes en riesgo */}
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <WorkQueuePanel data={workQueue} compact maxItems={6} />
          <AtRiskPatientsWidget data={workQueue} limit={5} />
        </div>

        {/* Main content grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="animate-fade-in" style={{ animationDelay: "180ms" }}>
            <NutritionChart />
          </div>

          <div
            className="rounded-2xl border border-border/80 bg-card/90 shadow-card backdrop-blur-sm overflow-hidden animate-fade-in h-full"
            style={{ animationDelay: "220ms" }}
          >
            <div className="border-b border-border/70 bg-gradient-to-br from-card via-card to-emerald-500/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Top progreso
                  </h3>
                  <p className="text-sm text-muted-foreground">Pacientes con mejor avance</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {topPatients.length > 0 ? (
                  topPatients.map((patient, index) => {
                    const colors = [
                      { bg: "from-emerald-500 to-teal-600", text: "text-emerald-600 dark:text-emerald-400", bar: "from-emerald-500 to-teal-400", ring: "ring-emerald-500/20" },
                      { bg: "from-sky-500 to-cyan-600", text: "text-sky-600 dark:text-sky-400", bar: "from-sky-500 to-cyan-400", ring: "ring-sky-500/20" },
                      { bg: "from-amber-500 to-orange-500", text: "text-amber-600 dark:text-amber-400", bar: "from-amber-500 to-orange-400", ring: "ring-amber-500/20" },
                    ];
                    const color = colors[index] || colors[2];
                    const progressPct = Math.min(
                      100,
                      Math.max(
                        0,
                        Number(
                          patient.progress_percentage ??
                            patient.progress_pct ??
                            patient.progreso ??
                            0
                        ) || 0
                      )
                    );

                    return (
                      <div
                        key={patient.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/progress?patientId=${patient.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/progress?patientId=${patient.id}`);
                          }
                        }}
                        className="rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/35 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ${color.ring}`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{patient.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {patient.plan_name || "Sin plan"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold tabular-nums ${color.text}`}>
                            {progressPct}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {patient.weight_change > 0 ? "+" : ""}
                            {patient.weight_change} kg
                          </p>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color.bar} transition-all duration-700`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                    );
                  })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/70 flex items-center justify-center mb-3 ring-1 ring-border/50">
                    <TrendingUp className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-foreground text-sm">Sin datos de progreso</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aparecerán cuando haya métricas registradas
                  </p>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-border/70">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-3 text-center">
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {stats?.progress.average || 0}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Progreso promedio</p>
                  </div>
                  <div className="rounded-xl bg-accent/15 border border-accent/20 px-3 py-3 text-center">
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {stats?.patients.total || 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Pacientes activos</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom grid */}
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: "260ms" }}>
          <UpcomingAppointments
            appointments={upcomingAppointments}
            loading={false}
            onUpdated={refreshDashboard}
          />
          <RecentPatients patients={recentPatients} loading={false} onRefresh={refreshDashboard} />
        </div>
      </div>
        )}
      </LoadingGate>
    </AdminLayout>
  );
};

export default Index;