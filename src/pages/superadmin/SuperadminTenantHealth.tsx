import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/config/api";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  UserCog,
  Calendar,
  MapPin,
  Activity,
  Loader2,
  BarChart3,
  Download,
  HeartPulse,
  AlertTriangle,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OrgRow {
  id: number;
  name: string;
  code: string;
  status: string;
  eps_program?: string;
  cities: string[];
  patients_count: number;
  nutritionists_count: number;
  sites_count: number;
  active_plans: number;
  active_patients_30d: number;
  appointments_month: number;
  meal_logs_30d: number;
  health_score: number;
  activity_score: number;
  adherence_score: number;
  appointments_score: number;
  meal_logs_score: number;
  dominant_plans: Record<string, number>;
  abandonment: {
    avg_score: number;
    patients_at_risk: number;
    patients_high_risk: number;
    risk_rate_pct: number;
  };
}

interface TenantHealth {
  generated_at: string;
  filters_applied: {
    eps_program?: string | null;
    city?: string | null;
    plan_type?: string | null;
    organization_id?: number | null;
  };
  filter_options: {
    eps_programs: string[];
    cities: string[];
    plan_types: Array<{ value: string; label: string }>;
    organizations: Array<{ id: number; name: string }>;
  };
  summary: {
    active_nutritionists: number;
    total_patients: number;
    total_organizations: number;
    appointments_this_month: number;
    total_sites: number;
    avg_health_score: number;
    platform_abandonment_score: number;
    patients_at_risk: number;
    patients_high_risk: number;
  };
  organizations: OrgRow[];
  module_usage: {
    appointments: { events_30d: number; label: string };
    meal_tracking: { patients_active_30d: number; logs_30d: number; label: string };
    clinical_colombia: { patients_with_labs: number; label: string };
    specialty_plans: { by_type: Record<string, number>; label: string };
  };
  sites: Array<{
    id: number;
    name: string;
    organization: string;
    organization_id: number;
    city?: string;
    nutritionists_count: number;
  }>;
  staff_roles: Record<string, { label: string; count: number }>;
}

interface ChurnOrg {
  id: number;
  name: string;
  churn_risk_score: number;
  churn_risk_level: string;
  churn_factors: string[];
  contract_end?: string | null;
  subscription_status?: string | null;
  health_score?: number | null;
}

interface ChurnRiskPayload {
  generated_at: string;
  summary: {
    organizations_scored: number;
    avg_churn_risk_score: number;
    by_level: Record<string, number>;
  };
  organizations: ChurnOrg[];
}

function healthColor(score: number) {
  if (score >= 75) return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
  if (score >= 50) return "text-amber-600 bg-amber-500/10 border-amber-500/30";
  return "text-destructive bg-destructive/10 border-destructive/30";
}

function abandonmentColor(score: number) {
  if (score >= 60) return "destructive";
  if (score >= 35) return "secondary";
  return "outline";
}

function churnLevelBadge(level: string) {
  if (level === "critical") return "destructive";
  if (level === "high") return "secondary";
  return "outline";
}

export default function SuperadminTenantHealth() {
  const [data, setData] = useState<TenantHealth | null>(null);
  const [churn, setChurn] = useState<ChurnRiskPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const [epsFilter, setEpsFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (epsFilter) params.set("eps_program", epsFilter);
    if (cityFilter) params.set("city", cityFilter);
    if (planFilter && planFilter !== "all") params.set("plan_type", planFilter);
    if (orgFilter && orgFilter !== "all") params.set("organization_id", orgFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [epsFilter, cityFilter, planFilter, orgFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const qs = buildQuery();
      const [healthRes, churnRes] = await Promise.all([
        fetch(`${API_URL}/superadmin/tenant-health${qs}`, { headers }),
        fetch(`${API_URL}/superadmin/tenant-health/churn-risk${qs}`, { headers }),
      ]);
      if (healthRes.ok) setData(await healthRes.json());
      else setData(null);
      if (churnRes.ok) setChurn(await churnRes.json());
      else setChurn(null);
    } catch {
      setData(null);
      setChurn(null);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const token = localStorage.getItem("userToken");
      const params = new URLSearchParams(buildQuery().replace(/^\?/, ""));
      params.set("format", format);
      const res = await fetch(`${API_URL}/superadmin/tenant-health/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenant-health-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const clearFilters = () => {
    setEpsFilter("");
    setCityFilter("");
    setPlanFilter("");
    setOrgFilter("");
  };

  if (loading && !data) {
    return (
      <SuperadminLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando salud del tenant…
        </div>
      </SuperadminLayout>
    );
  }

  if (!data) {
    return (
      <SuperadminLayout>
        <p className="p-8 text-muted-foreground">No se pudo cargar el panel.</p>
      </SuperadminLayout>
    );
  }

  const s = data.summary;

  return (
    <SuperadminLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Salud del tenant</h1>
            <p className="text-sm text-muted-foreground">
              Score por organización, predicción de abandono y exportación · {data.generated_at}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={!!exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              {exporting === "csv" ? "Exportando…" : "CSV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              {exporting === "pdf" ? "Exportando…" : "PDF"}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">EPS / Programa</Label>
                <Select value={epsFilter || "all-eps"} onValueChange={(v) => setEpsFilter(v === "all-eps" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-eps">Todas las EPS</SelectItem>
                    {data.filter_options.eps_programs.map((eps) => (
                      <SelectItem key={eps} value={eps}>{eps}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ciudad</Label>
                <Select value={cityFilter || "all-city"} onValueChange={(v) => setCityFilter(v === "all-city" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-city">Todas las ciudades</SelectItem>
                    {data.filter_options.cities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plan contratado</Label>
                <Select value={planFilter || "all"} onValueChange={setPlanFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los planes</SelectItem>
                    {data.filter_options.plan_types.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Organización</Label>
                <Select value={orgFilter || "all"} onValueChange={setOrgFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {data.filter_options.organizations.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs resumen */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{s.avg_health_score}</p>
                  <p className="text-xs text-muted-foreground">Score salud prom.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{s.platform_abandonment_score}</p>
                  <p className="text-xs text-muted-foreground">Abandono prom.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-destructive">{s.patients_high_risk}</p>
              <p className="text-xs text-muted-foreground">Alto riesgo (≥60)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-amber-600">{s.patients_at_risk}</p>
              <p className="text-xs text-muted-foreground">En riesgo (≥35)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-sky-600" />
                <div>
                  <p className="text-2xl font-bold">{s.total_patients}</p>
                  <p className="text-xs text-muted-foreground">Pacientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">{s.total_organizations}</p>
                  <p className="text-xs text-muted-foreground">Organizaciones</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-rose-600" />
                <div>
                  <p className="text-2xl font-bold">{s.appointments_this_month}</p>
                  <p className="text-xs text-muted-foreground">Citas mes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {churn && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Predicción de churn (nivel plataforma)
              </CardTitle>
              <CardDescription>
                Score 0–100 por organización · prom. {churn.summary.avg_churn_risk_score} ·{" "}
                {churn.summary.by_level.critical || 0} críticas · {churn.summary.by_level.high || 0} altas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {churn.organizations.slice(0, 8).map((o) => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(o.churn_factors || []).slice(0, 3).join(" · ") || "Sin factores"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Progress value={o.churn_risk_score} className="w-24 h-2" />
                    <Badge variant={churnLevelBadge(o.churn_risk_level) as "destructive" | "secondary" | "outline"}>
                      {o.churn_risk_score} · {o.churn_risk_level}
                    </Badge>
                  </div>
                </div>
              ))}
              {!churn.organizations.length && (
                <p className="text-sm text-muted-foreground">Sin organizaciones en riesgo con los filtros actuales.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabla organizaciones con score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score de salud por tenant (0–100)</CardTitle>
            <CardDescription>
              30% actividad · 30% adherencia · 20% citas · 20% logs de comidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3">Organización</th>
                    <th className="pb-2 pr-3">EPS</th>
                    <th className="pb-2 pr-3">Salud</th>
                    <th className="pb-2 pr-3">Actividad</th>
                    <th className="pb-2 pr-3">Adherencia</th>
                    <th className="pb-2 pr-3">Citas</th>
                    <th className="pb-2 pr-3">Logs</th>
                    <th className="pb-2 pr-3">Abandono</th>
                    <th className="pb-2 pr-3">En riesgo</th>
                    <th className="pb-2">Pacientes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.organizations.map((o) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{o.name}</p>
                        {o.cities?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {o.cities.join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs">{o.eps_program || "—"}</td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline" className={cn("font-bold", healthColor(o.health_score))}>
                          {o.health_score}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="w-16">
                          <Progress value={o.activity_score} className="h-1.5" />
                          <span className="text-[10px]">{o.activity_score}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">{o.adherence_score}%</td>
                      <td className="py-3 pr-3">{o.appointments_month}</td>
                      <td className="py-3 pr-3">{o.meal_logs_30d}</td>
                      <td className="py-3 pr-3">
                        <Badge variant={abandonmentColor(o.abandonment.avg_score)}>
                          {o.abandonment.avg_score}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-destructive font-medium">{o.abandonment.patients_high_risk}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span>{o.abandonment.patients_at_risk}</span>
                      </td>
                      <td className="py-3">{o.patients_count}</td>
                    </tr>
                  ))}
                  {data.organizations.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground">
                        Sin resultados para los filtros aplicados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Uso de módulos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-sm">{data.module_usage.appointments.label}</span>
                <Badge variant="secondary">{data.module_usage.appointments.events_30d} / mes</Badge>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-sm">{data.module_usage.meal_tracking.label}</span>
                <Badge variant="secondary">
                  {data.module_usage.meal_tracking.patients_active_30d} pac ·{" "}
                  {data.module_usage.meal_tracking.logs_30d} logs
                </Badge>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-sm">{data.module_usage.clinical_colombia.label}</span>
                <Badge variant="secondary">{data.module_usage.clinical_colombia.patients_with_labs} con labs</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Roles del staff
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(data.staff_roles).map(([key, val]) => (
                <div key={key} className="flex justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{val.label}</span>
                  <Badge>{val.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sedes por ciudad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.sites.map((site) => (
                <div key={site.id} className="rounded-xl border p-4">
                  <p className="font-medium">{site.name}</p>
                  <p className="text-xs text-muted-foreground">{site.organization}</p>
                  {site.city && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> {site.city}
                    </p>
                  )}
                  <Badge className="mt-2" variant="secondary">
                    {site.nutritionists_count} nutricionista(s)
                  </Badge>
                </div>
              ))}
              {data.sites.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Sin sedes para los filtros actuales
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
