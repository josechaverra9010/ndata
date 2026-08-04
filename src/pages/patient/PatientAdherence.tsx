import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  CalendarDays,
  Utensils,
  Lightbulb,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdherenceData {
  summary: {
    today_pct: number;
    week_pct: number;
    previous_week_pct: number;
    change: number;
    level: string;
    message: string;
    days_without_logs?: number | null;
    completed_meals_week: number;
    total_meals_week: number;
  };
  daily_series: Array<{
    date: string;
    label: string;
    adherence_pct: number;
    completed_meals: number;
    total_meals: number;
  }>;
  next_action: { type: string; label: string; path: string };
  plan_name?: string;
  tips: string[];
}

const levelStyles: Record<string, string> = {
  excellent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  good: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  fair: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "bg-destructive/10 text-destructive",
};

const levelLabels: Record<string, string> = {
  excellent: "Excelente",
  good: "Buena",
  fair: "Regular",
  low: "Baja",
};

export default function PatientAdherence() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdherenceData | null>(null);

  const patientId = user?.id;

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/adherence?days=7`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary;
  const TrendIcon =
    s && s.change > 0 ? TrendingUp : s && s.change < 0 ? TrendingDown : Minus;

  return (
    <PatientLayout>
      <LoadingGate loading={loading} message="Cargando tu adherencia">
        {!data || !s ? (
          <div className="text-center py-16 text-muted-foreground">
            No se pudo cargar la adherencia.
            <Button variant="outline" className="mt-4" onClick={load}>
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Target className="h-7 w-7 text-primary" />
                Mi adherencia
              </h1>
              <p className="text-muted-foreground mt-1">
                Qué tan bien estás siguiendo tu plan alimentario
                {data.plan_name ? ` · ${data.plan_name}` : ""}
              </p>
            </div>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Esta semana</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-4xl font-bold tabular-nums">{s.week_pct}%</span>
                      <Badge className={levelStyles[s.level] || levelStyles.fair}>
                        {levelLabels[s.level] || s.level}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{s.message}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendIcon
                      className={`h-4 w-4 ${
                        s.change > 0
                          ? "text-emerald-600"
                          : s.change < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    />
                    <span>
                      {s.change > 0 ? "+" : ""}
                      {s.change}% vs semana anterior
                    </span>
                  </div>
                </div>
                <Progress value={s.week_pct} className="h-2 mt-4" />
                <p className="text-xs text-muted-foreground mt-2">
                  {s.completed_meals_week} de {s.total_meals_week} comidas registradas esta semana
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Hoy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{s.today_pct}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Sin registro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">
                    {s.days_without_logs ?? "—"}
                    {s.days_without_logs != null && (
                      <span className="text-sm font-normal text-muted-foreground ml-1">días</span>
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    Próxima acción
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => navigate(data.next_action.path)}
                  >
                    <span className="truncate text-left">{data.next_action.label}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Adherencia diaria (7 días)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily_series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, "Adherencia"]}
                      labelFormatter={(label) => `Día ${label}`}
                    />
                    <Bar dataKey="adherence_pct" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Consejos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.tips.map((tip) => (
                  <p key={tip} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </p>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/patient/meals")}>
                <Utensils className="h-4 w-4 mr-2" />
                Registrar comidas
              </Button>
              <Button variant="outline" onClick={() => navigate("/patient/my-plan")}>
                Ver mi plan
              </Button>
            </div>
          </div>
        )}
      </LoadingGate>
    </PatientLayout>
  );
}
