import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Target,
  Flame,
  ArrowRight,
} from "lucide-react";

interface ProgramData {
  programa_eps?: string | null;
  organization?: {
    name: string;
    code: string;
    benefit_label: string;
    eps_program?: string;
  } | null;
  plan_name?: string | null;
  adherence_week_pct: number;
  streak_days: number;
  last_bioquimicos_date?: string | null;
  next_appointment?: {
    id: number;
    date: string;
    time: string;
    type: string;
    status: string;
  } | null;
  pending_controls: Array<{ type: string; label: string; priority: string }>;
  compliance_status: string;
}

export default function PatientProgram() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProgramData | null>(null);

  const patientId = user?.id;

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/program`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast({ title: "Error", description: "No se pudo cargar tu programa", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onTrack = data?.compliance_status === "on_track";

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              Mi Programa
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Resumen de tu programa EPS, beneficios y cumplimiento
            </p>
          </div>

          {data && (
            <>
              <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/[0.04]">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {data.programa_eps || data.organization?.eps_program || "Programa nutricional"}
                  </CardTitle>
                  {data.organization && (
                    <CardDescription className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {data.organization.name} · Código {data.organization.code}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.organization?.benefit_label && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <Gift className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium">{data.organization.benefit_label}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {onTrack ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-0 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        En buen camino
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-500/30 gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Requiere atención
                      </Badge>
                    )}
                    {data.plan_name && (
                      <Badge variant="secondary">{data.plan_name}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Adherencia semanal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{data.adherence_week_pct}%</p>
                    <Progress value={data.adherence_week_pct} className="h-2 mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Racha de registro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{data.streak_days}</p>
                    <p className="text-xs text-muted-foreground">días consecutivos</p>
                  </CardContent>
                </Card>
              </div>

              {data.next_appointment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Próxima cita
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{data.next_appointment.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.next_appointment.date} · {data.next_appointment.time}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/patient/appointments")}>
                      Ver citas
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {data.pending_controls.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Controles pendientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.pending_controls.map((c) => (
                      <div
                        key={c.type}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <span>{c.label}</span>
                        <Badge variant={c.priority === "high" ? "destructive" : "secondary"} className="text-[10px]">
                          {c.priority === "high" ? "Urgente" : "Pendiente"}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.last_bioquimicos_date && (
                <p className="text-xs text-muted-foreground text-center">
                  Último control bioquímico: {data.last_bioquimicos_date}
                </p>
              )}
            </>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
