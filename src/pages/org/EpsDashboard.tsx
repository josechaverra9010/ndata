import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { StatsCard } from "@/components/admin/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { API_URL } from "@/config/api";
import {
  Building2,
  Users,
  UserCog,
  Calendar,
  HeartPulse,
  MapPin,
  Gift,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useOrgBranding } from "@/hooks/useOrgBranding";

interface EpsDashboardData {
  organization: {
    name: string;
    eps_program?: string;
    logo_url?: string;
    primary_color?: string;
    max_patients?: number | null;
    max_nutritionists?: number | null;
    patients_used?: number;
    nutritionists_used?: number;
    enabled_modules?: string[];
    module_labels?: Record<string, string>;
    contract_end?: string;
  };
  kpis: {
    patients: number;
    nutritionists: number;
    sites: number;
    active_plans: number;
    appointments_month: number;
    health_score: number;
    adherence_score: number;
  };
  org_metrics?: {
    active_patients_30d?: number;
    abandonment?: { patients_at_risk?: number; patients_high_risk?: number };
  };
  recent_patients: Array<{ id: number; name: string; email: string; joined?: string }>;
  upcoming_appointments: Array<{
    id: number;
    patient_name: string;
    date: string;
    time: string;
    type: string;
  }>;
  benefit_codes: Array<{
    code: string;
    benefit_label: string;
    uses_count: number;
    max_uses?: number | null;
    uses_remaining?: number | null;
    expires_at?: string;
    is_expired?: boolean;
  }>;
  module_usage?: Record<string, { label: string; events_30d?: number; logs_30d?: number }>;
}

export default function EpsDashboard() {
  const navigate = useNavigate();
  const { branding } = useOrgBranding();
  const [data, setData] = useState<EpsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    fetch(`${API_URL}/admin/me/permissions`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((perms) => {
        if (perms && perms.staff_role !== "org_admin" && perms.staff_role !== "superadmin") {
          navigate("/admin", { replace: true });
        }
      })
      .catch(() => {});

    fetch(`${API_URL}/org/dashboard`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [navigate]);

  const org = data?.organization;
  const color = org?.primary_color || branding?.primary_color || undefined;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-muted-foreground">
          No se pudo cargar el panel EPS. Verifica que tengas una organización asignada.
        </div>
      </AdminLayout>
    );
  }

  const patientPct =
    org?.max_patients && org.max_patients > 0
      ? Math.min(100, Math.round(((org.patients_used || 0) / org.max_patients) * 100))
      : null;

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {org?.logo_url ? (
              <img src={org.logo_url} alt="" className="h-12 w-12 rounded-xl object-contain border" />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: color || "hsl(var(--primary))" }}
              >
                <Building2 className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{org?.name || "Panel EPS"}</h1>
              <p className="text-sm text-muted-foreground">
                {org?.eps_program || "Dashboard agregado de la organización"}
              </p>
            </div>
          </div>
          {org?.contract_end && (
            <Badge variant="outline">Contrato hasta {org.contract_end}</Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Pacientes" value={data.kpis.patients} icon={Users} />
          <StatsCard title="Nutricionistas" value={data.kpis.nutritionists} icon={UserCog} />
          <StatsCard title="Citas del mes" value={data.kpis.appointments_month} icon={Calendar} />
          <StatsCard
            title="Score salud"
            value={`${data.kpis.health_score}%`}
            icon={HeartPulse}
          />
        </div>

        {(org?.max_patients || org?.max_nutritionists) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Uso del contrato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {org.max_patients != null && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Pacientes</span>
                    <span>
                      {org.patients_used}/{org.max_patients}
                    </span>
                  </div>
                  <Progress value={patientPct ?? 0} className="h-2" />
                </div>
              )}
              {org.max_nutritionists != null && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Nutricionistas</span>
                    <span>
                      {org.nutritionists_used}/{org.max_nutritionists}
                    </span>
                  </div>
                  <Progress
                    value={
                      org.max_nutritionists
                        ? Math.min(
                            100,
                            Math.round(
                              ((org.nutritionists_used || 0) / org.max_nutritionists) * 100
                            )
                          )
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Pacientes recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recent_patients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pacientes adscritos</p>
              ) : (
                data.recent_patients.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm rounded-lg border p-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground text-xs">{p.joined?.slice(0, 10)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Próximas citas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcoming_appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin citas programadas</p>
              ) : (
                data.upcoming_appointments.map((a) => (
                  <div key={a.id} className="flex justify-between text-sm rounded-lg border p-2">
                    <div>
                      <p className="font-medium">{a.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{a.type}</p>
                    </div>
                    <span className="text-xs">
                      {a.date} {a.time}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {org?.enabled_modules && org.enabled_modules.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Módulos habilitados
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {org.enabled_modules.map((m) => (
                <Badge key={m} variant="secondary">
                  {org.module_labels?.[m] || m}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {data.benefit_codes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Códigos de beneficio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.benefit_codes.map((bc) => (
                <div
                  key={bc.code}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <span className="font-mono font-semibold">{bc.code}</span>
                    <span className="text-muted-foreground ml-2">{bc.benefit_label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span>
                      {bc.uses_count}
                      {bc.max_uses != null ? `/${bc.max_uses}` : ""} usos
                    </span>
                    {bc.expires_at && (
                      <Badge variant={bc.is_expired ? "destructive" : "outline"}>
                        {bc.is_expired ? "Expirado" : `Vence ${bc.expires_at.slice(0, 10)}`}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.org_metrics?.abandonment && (
          <Card className="border-amber-500/30">
            <CardContent className="pt-6 flex flex-wrap gap-6">
              <div>
                <p className="text-2xl font-bold">{data.org_metrics.abandonment.patients_at_risk ?? 0}</p>
                <p className="text-xs text-muted-foreground">Pacientes en riesgo</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">
                  {data.org_metrics.abandonment.patients_high_risk ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Riesgo alto</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.kpis.adherence_score}%</p>
                <p className="text-xs text-muted-foreground">Adherencia org</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {data.kpis.sites} sedes
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
