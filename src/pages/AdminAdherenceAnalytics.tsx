import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { StatsCard } from "@/components/admin/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/api";
import { todayInColombiaISO } from "@/lib/timezone";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PatientAlert {
  type: string;
  severity: string;
  message: string;
}

interface PatientRow {
  id: number;
  name: string;
  avatar?: string;
  plan: string;
  plan_tipo: string;
  plan_tipo_label: string;
  programa_eps?: string;
  organization?: string;
  adherence_pct: number;
  completed_meals: number;
  total_meals: number;
  days_without_logs?: number | null;
  last_meal_log?: string | null;
  current_weight?: number | null;
  goal_weight?: number | null;
  weight_change?: number | null;
  alerts_count: number;
  alerts: PatientAlert[];
}

interface CohortTrend {
  label: string;
  patient_count: number;
  series: { week_start: string; week_label: string; avg_weight: number | null; sample_size: number }[];
}

interface DashboardData {
  period_days: number;
  period_start: string;
  period_end: string;
  summary: {
    total_patients: number;
    avg_adherence: number;
    patients_on_track: number;
    patients_at_risk: number;
    total_alerts: number;
  };
  patients: PatientRow[];
  cohort_trends: Record<string, CohortTrend>;
  alerts: (PatientAlert & { patient_id: number; patient_name: string })[];
  filter_options: {
    cohorts: { value: string; label: string }[];
    organizations: { id: number; name: string }[];
    eps_programs: string[];
  };
}

const COHORT_COLORS: Record<string, string> = {
  adulto: "hsl(var(--primary))",
  pediatria: "#6366f1",
  gestante: "#ec4899",
  gestante_adolescente: "#f472b6",
  hospitalizado: "#f59e0b",
  geriatrico: "#8b5cf6",
  deportista: "#10b981",
};

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "14", label: "Últimos 14 días" },
  { value: "30", label: "Últimos 30 días" },
];

function severityBadge(severity: string) {
  switch (severity) {
    case "high":
      return <Badge variant="destructive" className="text-[10px]">Alta</Badge>;
    case "warning":
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-[10px]">Peso</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">Media</Badge>;
  }
}

export default function AdminAdherenceAnalytics() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("7");
  const [cohort, setCohort] = useState("all");
  const [organizationId, setOrganizationId] = useState("all");
  const [programaEps, setProgramaEps] = useState("all");
  const [selectedCohortChart, setSelectedCohortChart] = useState<string>("all");

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({ days });
    if (cohort !== "all") params.set("cohort", cohort);
    if (organizationId !== "all") params.set("organization_id", organizationId);
    if (programaEps !== "all") params.set("programa_eps", programaEps);
    return params.toString();
  }, [days, cohort, organizationId, programaEps]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/analytics/adherence/dashboard?${buildQuery()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("No se pudo cargar el dashboard");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error al cargar analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [buildQuery, toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const token = localStorage.getItem("userToken");
      const params = new URLSearchParams({ format, ...Object.fromEntries(new URLSearchParams(buildQuery())) });
      const res = await fetch(`${API_URL}/analytics/adherence/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `adherencia_${todayInColombiaISO()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Exportación lista", description: `Reporte ${format.toUpperCase()} descargado` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const filteredPatients = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.patients;
    return data.patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.plan.toLowerCase().includes(q) ||
        (p.programa_eps || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const chartData = useMemo(() => {
    if (!data?.cohort_trends) return [];
    const keys =
      selectedCohortChart === "all"
        ? Object.keys(data.cohort_trends)
        : [selectedCohortChart].filter((k) => data.cohort_trends[k]);

    if (!keys.length) return [];

    const weekLabels = data.cohort_trends[keys[0]]?.series.map((s) => s.week_label) || [];
    return weekLabels.map((label, idx) => {
      const point: Record<string, string | number | null> = { week: label };
      for (const key of keys) {
        const series = data.cohort_trends[key]?.series[idx];
        point[key] = series?.avg_weight ?? null;
      }
      return point;
    });
  }, [data, selectedCohortChart]);

  const summary = data?.summary;

  return (
    <AdminLayout>
      <LoadingGate loading={loading && !data} message="Cargando centro de adherencia">
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/10 via-background to-primary/5 p-5 sm:p-6">
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Centro de adherencia</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cumplimiento de comidas, alertas y tendencias por cohorte
                  {data && (
                    <span className="font-medium text-foreground/80">
                      {" "}
                      · {data.period_start} → {data.period_end}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!!exporting}
                onClick={() => handleExport("csv")}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting === "csv" ? "Exportando…" : "CSV"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!!exporting}
                onClick={() => handleExport("pdf")}
              >
                <FileText className="h-4 w-4 mr-2" />
                {exporting === "pdf" ? "Exportando…" : "PDF"}
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cohort} onValueChange={setCohort}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Cohorte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cohortes</SelectItem>
                  {data?.filter_options.cohorts.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las organizaciones</SelectItem>
                  {data?.filter_options.organizations.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={programaEps} onValueChange={setProgramaEps}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="EPS / Programa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los programas</SelectItem>
                  {data?.filter_options.eps_programs.map((eps) => (
                    <SelectItem key={eps} value={eps}>
                      {eps}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard
              title="Pacientes activos"
              value={String(summary.total_patients)}
              icon={Users}
              iconColor="primary"
            />
            <StatsCard
              title="Adherencia prom."
              value={`${summary.avg_adherence}%`}
              change={`${summary.patients_on_track} en meta (≥80%)`}
              changeType={summary.avg_adherence >= 70 ? "positive" : "negative"}
              icon={Target}
              iconColor="accent"
            />
            <StatsCard
              title="En riesgo"
              value={String(summary.patients_at_risk)}
              change="Adherencia baja o alertas"
              changeType={summary.patients_at_risk > 0 ? "negative" : "positive"}
              icon={AlertTriangle}
              iconColor="warning"
            />
            <StatsCard
              title="Alertas activas"
              value={String(summary.total_alerts)}
              icon={Activity}
              iconColor="info"
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cohort weight trends */}
          <Card className="lg:col-span-2 rounded-2xl">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tendencia de peso por cohorte
              </CardTitle>
              <Select value={selectedCohortChart} onValueChange={setSelectedCohortChart}>
                <SelectTrigger className="w-[180px] h-8 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas visibles</SelectItem>
                  {Object.entries(data?.cohort_trends || {}).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label} ({val.patient_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" kg" domain={["auto", "auto"]} />
                      <Tooltip
                        formatter={(v: number) => (v != null ? [`${v} kg`, "Peso prom."] : ["—", ""])}
                        labelFormatter={(l) => `Semana ${l}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {(selectedCohortChart === "all"
                        ? Object.keys(data?.cohort_trends || {})
                        : [selectedCohortChart]
                      ).map((key) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={data?.cohort_trends[key]?.label || key}
                          stroke={COHORT_COLORS[key] || "hsl(var(--primary))"}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No hay datos de peso suficientes para las cohortes seleccionadas.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alerts panel */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
              {data?.alerts.length ? (
                data.alerts.slice(0, 15).map((alert, idx) => (
                  <button
                    key={`${alert.patient_id}-${idx}`}
                    type="button"
                    onClick={() => navigate(`/progress?patient=${alert.patient_id}`)}
                    className="w-full text-left rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium truncate">{alert.patient_name}</p>
                      {severityBadge(alert.severity)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sin alertas en este periodo 🎉
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Patients table */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Adherencia por paciente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-3 font-medium">Paciente</th>
                    <th className="p-3 font-medium hidden md:table-cell">Cohorte</th>
                    <th className="p-3 font-medium hidden lg:table-cell">EPS / Org.</th>
                    <th className="p-3 font-medium">Adherencia</th>
                    <th className="p-3 font-medium hidden sm:table-cell">Comidas</th>
                    <th className="p-3 font-medium hidden md:table-cell">Último registro</th>
                    <th className="p-3 font-medium">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/progress?patient=${p.id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {p.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.plan}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {p.plan_tipo_label}
                        </Badge>
                      </td>
                      <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground max-w-[140px] truncate">
                        {p.programa_eps || p.organization || "—"}
                      </td>
                      <td className="p-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold tabular-nums ${
                              p.adherence_pct >= 80
                                ? "text-emerald-600"
                                : p.adherence_pct >= 50
                                  ? "text-amber-600"
                                  : "text-destructive"
                            }`}
                          >
                            {p.adherence_pct}%
                          </span>
                          <Progress value={p.adherence_pct} className="h-1.5 flex-1 max-w-[60px]" />
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell tabular-nums text-muted-foreground">
                        {p.completed_meals}/{p.total_meals}
                      </td>
                      <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                        {p.last_meal_log || (p.days_without_logs != null ? `Hace ${p.days_without_logs}d` : "—")}
                      </td>
                      <td className="p-3">
                        {p.alerts_count > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {p.alerts_count}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredPatients.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No hay pacientes con plan activo para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </LoadingGate>
    </AdminLayout>
  );
}
