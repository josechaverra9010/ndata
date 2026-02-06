import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StatsCard } from "@/components/admin/StatsCard";
import { useAuth } from "@/hooks/useAuth";
import { RecentPatients } from "@/components/admin/RecentPatients";
import { UpcomingAppointments } from "@/components/admin/UpcomingAppointments";
import { NutritionChart } from "@/components/admin/NutritionChart";
import { Users, Apple, Calendar, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

// API Configuration
import { API_URL } from "@/config/api";

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [topPatients, setTopPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('🔄 Iniciando fetch de datos del dashboard...');
        const token = localStorage.getItem("userToken");
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        };

        // Fetch stats, pacientes, citas y top progress en paralelo
        const [statsResponse, patientsResponse, appointmentsResponse, topPatientsResponse] = await Promise.all([
          fetch(`${API_URL}/dashboard/stats`, { headers }),
          fetch(`${API_URL}/dashboard/recent-patients?limit=5`, { headers }),
          fetch(`${API_URL}/dashboard/upcoming-appointments?limit=5`, { headers }),
          fetch(`${API_URL}/dashboard/top-patients-progress?limit=3`, { headers })
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

        const [statsData, patientsData, appointmentsData, topPatientsData] = await Promise.all([
          statsResponse.json(),
          patientsResponse.json(),
          appointmentsResponse.json(),
          topPatientsResponse.json()
        ]);

        console.log('✅ Stats data:', statsData);
        console.log('✅ Patients data:', patientsData);
        console.log('✅ Appointments data:', appointmentsData);
        console.log('✅ Top patients data:', topPatientsData);

        setStats(statsData);
        setRecentPatients(patientsData);
        setUpcomingAppointments(appointmentsData);
        setTopPatients(topPatientsData);
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

  // Mostrar estado de carga
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <LoadingScreen message="Cargando" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500 mb-2">Error al cargar el dashboard</p>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Reintentar
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenida, {user?.name || "Dra. García"}. Aquí está el resumen de tu día.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Pacientes Activos"
            value={stats?.patients.total.toString() || "0"}
            change={stats?.patients.change || "+0% este mes"}
            changeType={stats?.patients.change_type as "positive" | "negative" | "neutral"}
            icon={Users}
            iconColor="primary"
          />
          <StatsCard
            title="Planes Activos"
            value={stats?.plans.total.toString() || "0"}
            change={stats?.plans.change || "+0% este mes"}
            changeType={stats?.plans.change_type as "positive" | "negative" | "neutral"}
            icon={Apple}
            iconColor="accent"
          />
          <StatsCard
            title="Citas Esta Semana"
            value={stats?.appointments.total.toString() || "0"}
            change={stats?.appointments.change || "0 pendientes hoy"}
            changeType={stats?.appointments.change_type as "positive" | "negative" | "neutral"}
            icon={Calendar}
            iconColor="info"
          />
          <StatsCard
            title="Progreso Promedio"
            value={`${stats?.progress.average || 0}%`}
            change={stats?.progress.change || "+0% vs mes anterior"}
            changeType={stats?.progress.change_type as "positive" | "negative" | "neutral"}
            icon={TrendingUp}
            iconColor="warning"
          />
        </div>

        {/* Main content grid - Two Charts 50/50 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Nutrition Chart */}
          <NutritionChart />

          {/* Patient Progress Chart */}
          <div className="rounded-lg border border-border bg-card shadow-card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Progreso de Pacientes
                </h3>
              </div>
              <div className="space-y-4">
                {/* Dynamic Top Performers */}
                {topPatients.length > 0 ? (
                  topPatients.map((patient, index) => {
                    const colors = [
                      { bg: 'from-green-500 to-emerald-600', text: 'text-green-600', bar: 'from-green-500 to-emerald-500' },
                      { bg: 'from-blue-500 to-cyan-600', text: 'text-blue-600', bar: 'from-blue-500 to-cyan-500' },
                      { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600', bar: 'from-amber-500 to-orange-500' }
                    ];
                    const color = colors[index] || colors[2];

                    return (
                      <div key={patient.id} className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${color.bg} flex items-center justify-center text-white font-bold text-xs`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{patient.name}</p>
                              <p className="text-xs text-muted-foreground">{patient.plan_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${color.text}`}>
                              {patient.weight_change > 0 ? '+' : ''}{patient.weight_change} kg
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No hay datos de progreso disponibles</p>
                  </div>
                )}

                {/* Summary */}
                <div className="pt-4 mt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats?.progress.average || 0}%</p>
                      <p className="text-xs text-muted-foreground">Progreso Promedio</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats?.patients.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Pacientes Activos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          <UpcomingAppointments appointments={upcomingAppointments} loading={loading} />
          <RecentPatients patients={recentPatients} loading={loading} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default Index;