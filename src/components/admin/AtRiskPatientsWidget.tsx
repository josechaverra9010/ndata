import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { WorkQueueData } from "./WorkQueuePanel";

const severityBadge: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  medium: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
};

interface AtRiskPatientsWidgetProps {
  data: WorkQueueData | null;
  loading?: boolean;
  limit?: number;
}

export function AtRiskPatientsWidget({
  data,
  loading = false,
  limit = 5,
}: AtRiskPatientsWidgetProps) {
  const navigate = useNavigate();
  const patients = (data?.at_risk_patients ?? []).slice(0, limit);

  if (loading) {
    return (
      <Card className="border-border/80 shadow-card h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Pacientes en riesgo hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-card h-full overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-card via-card to-destructive/[0.04]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Pacientes en riesgo hoy
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Baja adherencia, sin registros o cambios de peso
            </p>
          </div>
          {(data?.summary.patients_at_risk ?? 0) > 0 && (
            <Badge variant="destructive" className="tabular-nums shrink-0">
              {data?.summary.patients_at_risk}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <p className="font-medium text-foreground">Sin alertas activas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tus pacientes van bien en adherencia y seguimiento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => {
              const topAlert = patient.alerts[0];
              return (
                <div
                  key={patient.patient_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/progress?patientId=${patient.patient_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/progress?patientId=${patient.patient_id}`);
                    }
                  }}
                  className="rounded-xl border border-border/60 bg-muted/15 p-3.5 transition-colors hover:bg-muted/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={patient.avatar || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {patient.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{patient.name}</p>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] shrink-0", severityBadge[patient.severity])}
                        >
                          {patient.alerts_count} alerta{patient.alerts_count !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {patient.plan && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{patient.plan}</p>
                      )}
                      {topAlert && (
                        <p className="text-xs text-foreground/80 mt-1.5 line-clamp-2">{topAlert.message}</p>
                      )}
                      <div className="mt-2.5 flex items-center gap-2">
                        <Progress value={patient.adherence_pct} className="h-1.5 flex-1" />
                        <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">
                          {patient.adherence_pct}%
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                  </div>
                </div>
              );
            })}
            {(data?.at_risk_patients.length ?? 0) > limit && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => navigate("/analytics")}
              >
                Ver todos en adherencia
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
