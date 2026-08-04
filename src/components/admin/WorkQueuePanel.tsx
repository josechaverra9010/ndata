import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  FileWarning,
  Target,
  UserX,
} from "lucide-react";

export interface WorkQueueItem {
  id: string;
  category: string;
  priority: number;
  severity: string;
  title: string;
  description: string;
  action_path: string;
  action_label: string;
  patient_id?: number | null;
  appointment_id?: number | null;
  patient?: {
    id: number;
    name: string;
    avatar?: string | null;
  } | null;
  meta?: Record<string, unknown>;
}

export interface WorkQueueData {
  generated_at: string;
  summary: {
    total_items: number;
    appointments_today: number;
    patients_at_risk: number;
    undocumented_appointments: number;
    no_active_plan: number;
    plans_expiring_soon: number;
  };
  items: WorkQueueItem[];
  at_risk_patients: Array<{
    patient_id: number;
    name: string;
    avatar?: string | null;
    plan?: string | null;
    adherence_pct: number;
    days_without_logs?: number | null;
    alerts_count: number;
    alerts: Array<{ type: string; severity: string; message: string }>;
    severity: string;
  }>;
}

const categoryIcons: Record<string, typeof Calendar> = {
  appointment_today: Calendar,
  undocumented_appointment: FileWarning,
  at_risk: AlertTriangle,
  no_active_plan: UserX,
  plan_expiring: Clock,
};

const severityStyles: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  medium: "border-orange-500/25 bg-orange-500/5",
  low: "border-border bg-muted/20",
};

interface WorkQueuePanelProps {
  data: WorkQueueData | null;
  loading?: boolean;
  compact?: boolean;
  maxItems?: number;
}

export function WorkQueuePanel({
  data,
  loading = false,
  compact = false,
  maxItems = 8,
}: WorkQueuePanelProps) {
  const navigate = useNavigate();
  const items = (data?.items ?? []).slice(0, compact ? maxItems : undefined);
  const summary = data?.summary;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Cola de trabajo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-card overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Cola de trabajo
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Prioridades para hoy — citas, riesgo y seguimiento pendiente
            </p>
          </div>
          {summary && summary.total_items > 0 && (
            <Badge variant="secondary" className="w-fit tabular-nums">
              {summary.total_items} pendiente{summary.total_items !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2 pt-1">
            {summary.appointments_today > 0 && (
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {summary.appointments_today} cita{summary.appointments_today !== 1 ? "s" : ""} hoy
              </Badge>
            )}
            {summary.patients_at_risk > 0 && (
              <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {summary.patients_at_risk} en riesgo
              </Badge>
            )}
            {summary.undocumented_appointments > 0 && (
              <Badge variant="outline" className="gap-1">
                <FileWarning className="h-3 w-3" />
                {summary.undocumented_appointments} sin documentar
              </Badge>
            )}
            {summary.plans_expiring_soon > 0 && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {summary.plans_expiring_soon} plan{summary.plans_expiring_soon !== 1 ? "es" : ""} por vencer
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Target className="h-7 w-7" />
            </div>
            <p className="font-medium text-foreground">¡Al día!</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No hay tareas urgentes. Revisa pacientes o el centro de adherencia cuando quieras.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/analytics")}>
              Ver adherencia
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = categoryIcons[item.category] ?? ClipboardList;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/30",
                    severityStyles[item.severity] ?? severityStyles.low
                  )}
                >
                  {item.patient ? (
                    <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
                      <AvatarImage src={item.patient.avatar || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {item.patient.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => navigate(item.action_path)}
                  >
                    {item.action_label}
                  </Button>
                </div>
              );
            })}
            {compact && (data?.items.length ?? 0) > maxItems && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => navigate("/work-queue")}
              >
                Ver cola completa ({data?.items.length} tareas)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
