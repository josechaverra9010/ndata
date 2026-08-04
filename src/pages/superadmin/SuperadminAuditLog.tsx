import { useCallback, useEffect, useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { API_URL } from "@/config/api";
import { cn } from "@/lib/utils";
import {
  Shield,
  Loader2,
  FileText,
  User,
  Clock,
  AlertTriangle,
  Filter,
  RefreshCw,
  ChevronDown,
  Trash2,
  Settings2,
  GitCompare,
} from "lucide-react";

interface AuditDiff {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  patient_id: number | null;
  organization_id: number | null;
  summary: string;
  created_at: string;
  is_sensitive?: boolean;
  diff?: AuditDiff | null;
}

interface AuditAlert {
  id: string;
  type: "mass_transfer" | "deletion" | "superadmin_role_change";
  severity: "high" | "critical";
  title: string;
  message: string;
  actor_name?: string;
  created_at?: string;
  count?: number;
}

interface AuditResponse {
  generated_at: string;
  retention_days: number;
  retention_options: number[];
  total: number;
  filter_options: {
    actions: string[];
    entity_types: string[];
    actors: Array<{ id: number; name: string }>;
  };
  alerts: AuditAlert[];
  logs: AuditEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Modificación",
  delete: "Eliminación",
  transfer: "Transferencia",
  role_change: "Cambio de rol",
  escalate: "Escalamiento soporte",
  impersonation_start: "Inicio impersonación",
  impersonation_end: "Fin impersonación",
  feature_flags_update: "Feature flags",
};

const ENTITY_LABELS: Record<string, string> = {
  meal_plan: "Plan nutricional",
  clinical_history: "Historia clínica",
  organization: "Organización",
  patient: "Paciente",
  staff: "Staff",
  user: "Usuario",
  audit_settings: "Config. auditoría",
  audit_logs: "Logs auditoría",
  support_ticket: "Ticket soporte",
  feature_flags: "Feature flags",
  impersonation: "Impersonación",
};

const ALERT_STYLES: Record<string, string> = {
  mass_transfer: "border-amber-500/40 bg-amber-500/5",
  deletion: "border-destructive/40 bg-destructive/5",
  superadmin_role_change: "border-red-600/50 bg-red-600/10",
};

function DiffBlock({ diff }: { diff: AuditDiff }) {
  const formatValue = (val: unknown) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  };

  const before = diff.before || {};
  const after = diff.after || {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  if (keys.length === 0) {
    return (
      <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">
        {JSON.stringify(diff, null, 2)}
      </pre>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 text-xs">
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <p className="font-semibold text-destructive mb-2">Antes</p>
        {keys.map((key) => (
          <div key={`b-${key}`} className="mb-1">
            <span className="text-muted-foreground">{key}: </span>
            <span className="font-mono">{formatValue(before[key])}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Después</p>
        {keys.map((key) => (
          <div key={`a-${key}`} className="mb-1">
            <span className="text-muted-foreground">{key}: </span>
            <span className="font-mono">{formatValue(after[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperadminAuditLog() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRetention, setSavingRetention] = useState(false);
  const [purging, setPurging] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [retentionDays, setRetentionDays] = useState("180");

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (entityFilter !== "all") params.set("entity_type", entityFilter);
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (actorFilter !== "all") params.set("actor_id", actorFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (search.trim()) params.set("search", search.trim());

    fetch(`${API_URL}/superadmin/audit-logs?${params}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload && Array.isArray(payload.logs)) {
          setData(payload);
          setRetentionDays(String(payload.retention_days ?? 180));
        } else {
          setData(null);
        }
      })
      .finally(() => setLoading(false));
  }, [entityFilter, actionFilter, actorFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const saveRetention = async () => {
    setSavingRetention(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/audit-settings`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ retention_days: Number(retentionDays) }),
      });
      if (res.ok) fetchLogs();
    } finally {
      setSavingRetention(false);
    }
  };

  const purgeOldLogs = async () => {
    setPurging(true);
    try {
      const res = await fetch(`${API_URL}/superadmin/audit-logs/purge`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) fetchLogs();
    } finally {
      setPurging(false);
    }
  };

  const logs = data?.logs ?? [];
  const alerts = data?.alerts ?? [];

  return (
    <SuperadminLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              Auditoría (compliance)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Trazabilidad de cambios sensibles: roles, transferencias y eliminaciones
            </p>
            {data?.generated_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Actualizado: {data.generated_at}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={fetchLogs}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {alerts.length > 0 && (
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alertas de seguridad ({alerts.length})
              </CardTitle>
              <CardDescription>
                Transferencias masivas, eliminaciones y cambios de rol superadmin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-xl border p-3 text-sm",
                    ALERT_STYLES[alert.type] || "border-muted"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={alert.severity === "critical" ? "destructive" : "outline"}
                    >
                      {alert.type === "mass_transfer"
                        ? "Transferencia masiva"
                        : alert.type === "deletion"
                          ? "Eliminación"
                          : "Rol superadmin"}
                    </Badge>
                    <span className="font-medium">{alert.title}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{alert.message}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {alert.actor_name && <span>Actor: {alert.actor_name}</span>}
                    {alert.count != null && <span>{alert.count} eventos</span>}
                    {alert.created_at && <span>{alert.created_at}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Retención de logs
            </CardTitle>
            <CardDescription>
              Los registros anteriores al periodo configurado pueden purgarse manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="retention">Días de retención</Label>
              <Select value={retentionDays} onValueChange={setRetentionDays}>
                <SelectTrigger id="retention" className="w-40 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(data?.retention_options ?? [90, 180, 365]).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={saveRetention}
              disabled={savingRetention}
            >
              {savingRetention ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="rounded-xl" disabled={purging}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Purgar antiguos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Purgar logs antiguos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán permanentemente los registros de auditoría con más de{" "}
                    {retentionDays} días. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={purgeOldLogs}>Confirmar purge</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl"
                aria-label="Desde"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl"
                aria-label="Hasta"
              />
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Actor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los actores</SelectItem>
                  {(data?.filter_options.actors ?? []).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {(data?.filter_options.actions ?? Object.keys(ACTION_LABELS)).map((a) => (
                    <SelectItem key={a} value={a}>
                      {ACTION_LABELS[a] || a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las entidades</SelectItem>
                  {(data?.filter_options.entity_types ?? Object.keys(ENTITY_LABELS)).map((e) => (
                    <SelectItem key={e} value={e}>
                      {ENTITY_LABELS[e] || e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar resumen o actor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? "Cargando…" : `${data?.total ?? logs.length} eventos`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">
                Sin registros con los filtros actuales.
              </p>
            ) : (
              <div className="space-y-2 max-h-[640px] overflow-y-auto">
                {logs.map((log) => {
                  const hasDiff = Boolean(log.diff?.before || log.diff?.after);
                  const isOpen = expandedId === log.id;

                  return (
                    <Collapsible
                      key={log.id}
                      open={isOpen}
                      onOpenChange={(open) => setExpandedId(open ? log.id : null)}
                    >
                      <div
                        className={cn(
                          "rounded-xl border p-4 hover:bg-muted/30",
                          log.is_sensitive && "border-primary/20"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{log.summary || "—"}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {log.actor_name || "Sistema"} ({log.actor_role})
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {log.created_at}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 shrink-0">
                            <Badge variant="outline">
                              {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                            <Badge variant="secondary">
                              {ENTITY_LABELS[log.entity_type] || log.entity_type}
                            </Badge>
                            {log.patient_id && (
                              <Badge variant="outline">Pac. #{log.patient_id}</Badge>
                            )}
                            {log.is_sensitive && (
                              <Badge variant="destructive" className="text-[10px]">
                                Sensible
                              </Badge>
                            )}
                            {hasDiff && (
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 rounded-lg">
                                  <GitCompare className="h-3.5 w-3.5 mr-1" />
                                  Diff
                                  <ChevronDown
                                    className={cn(
                                      "h-3.5 w-3.5 ml-1 transition-transform",
                                      isOpen && "rotate-180"
                                    )}
                                  />
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </div>
                        </div>
                        {hasDiff && log.diff && (
                          <CollapsibleContent className="mt-4 pt-3 border-t">
                            <DiffBlock diff={log.diff} />
                          </CollapsibleContent>
                        )}
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
