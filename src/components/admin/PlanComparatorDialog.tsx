import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp, GitCompare, Loader2, Minus, Activity, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInColombia } from "@/lib/timezone";

interface TimelineItem {
  assignment_id: number;
  status: string;
  assigned_date?: string;
  start_date?: string;
  end_date?: string | null;
  notes?: string | null;
  plan_name?: string;
  calories?: number;
  tipo_label?: string;
  snapshot_id?: number;
  captured_at?: string;
  has_frozen_snapshot?: boolean;
  peso_kg?: number | null;
  requerimiento_kcal?: number | null;
  macros_f2?: { kcal?: number | null; prot?: number | null; chos?: number | null; grasa?: number | null };
  grupos_con_porcion_f3?: number;
  has_fase4_detail?: boolean;
  imc?: number | null;
}

interface ChangeRow {
  field: string;
  label: string;
  unit: string;
  phase?: string;
  before: unknown;
  after: unknown;
  delta: number | null;
  direction: string;
}

interface PlanCompareData {
  patient: { id: number; name: string };
  left: {
    assignment_id: number;
    status: string;
    start_date?: string;
    notes?: string | null;
    plan: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
    has_frozen_snapshot?: boolean;
  };
  right: {
    assignment_id: number;
    status: string;
    start_date?: string;
    notes?: string | null;
    plan: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
    has_frozen_snapshot?: boolean;
  };
  changes: ChangeRow[];
  changes_by_phase?: Record<string, ChangeRow[]>;
  summary: {
    total_changes: number;
    calorie_delta: number;
    phases_with_changes?: string[];
  };
}

interface EvolutionRow {
  date?: string;
  plan_name?: string;
  peso_kg?: number | null;
  requerimiento_kcal?: number | null;
  calories?: number | null;
  imc?: number | null;
  assignment_id?: number;
}

interface ProgressMetric {
  id: number;
  patient_id?: number;
  date: string;
  weight?: number | null;
  body_fat?: number | null;
  muscle?: number | null;
  water?: number | null;
  waist?: number | null;
  hip?: number | null;
  chest?: number | null;
  arm?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

interface ProgressCompareData {
  patient: { id: number; name: string };
  left: ProgressMetric;
  right: ProgressMetric;
  changes: ChangeRow[];
  summary: {
    total_changes: number;
    weight_delta: number | null;
  };
  all_metrics?: ProgressMetric[];
}

interface PlanComparatorDialogProps {
  patientId: number;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PHASE_LABELS: Record<string, string> = {
  meta: "Plan (macros)",
  fase_1: "Fase 1 · Evaluación / RE",
  fase_2: "Fase 2 · Fórmula sintética",
  fase_3: "Fase 3 · Porciones",
  fase_4: "Fase 4 · Minuta",
};

const PROGRESS_COLS: { key: keyof ProgressMetric; label: string; unit?: string }[] = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "body_fat", label: "% Grasa", unit: "%" },
  { key: "muscle", label: "Músculo", unit: "%" },
  { key: "water", label: "Agua", unit: "%" },
  { key: "waist", label: "Cintura", unit: "cm" },
  { key: "hip", label: "Cadera", unit: "cm" },
  { key: "chest", label: "Pecho", unit: "cm" },
  { key: "arm", label: "Brazo", unit: "cm" },
];

function fmtMetric(v: unknown, unit?: string) {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return unit ? `${v} ${unit}` : String(v);
  return String(v);
}

export function PlanComparatorDialog({
  patientId,
  patientName,
  open,
  onOpenChange,
}: PlanComparatorDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mainTab, setMainTab] = useState<"planes" | "progreso">("planes");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [compare, setCompare] = useState<PlanCompareData | null>(null);
  const [evolution, setEvolution] = useState<EvolutionRow[]>([]);
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetric[]>([]);
  const [leftMetricId, setLeftMetricId] = useState<string>("");
  const [rightMetricId, setRightMetricId] = useState<string>("");
  const [progressCompare, setProgressCompare] = useState<ProgressCompareData | null>(null);

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (!open || !patientId) return;
    setLoading(true);
    setCompare(null);
    setProgressCompare(null);
    Promise.all([
      fetch(`${API_URL}/nutritionist/patients/${patientId}/plans/history`, { headers: headers() }),
      fetch(`${API_URL}/nutritionist/patients/${patientId}/clinical-timeline`, { headers: headers() }),
    ])
      .then(async ([histRes, clinRes]) => {
        if (!histRes.ok) throw new Error("No se pudo cargar historial");
        const data = await histRes.json();
        const items: TimelineItem[] = data.timeline || [];
        setTimeline(items);
        const left = data.defaults?.left_assignment_id;
        const right = data.defaults?.right_assignment_id;
        if (left) setLeftId(String(left));
        if (right) setRightId(String(right));

        if (clinRes.ok) {
          const clin = await clinRes.json();
          setEvolution(clin.evolution || []);
          const metrics: ProgressMetric[] = clin.progress_metrics || [];
          setProgressMetrics(metrics);
          const lm = clin.defaults?.left_metric_id;
          const rm = clin.defaults?.right_metric_id;
          if (lm) setLeftMetricId(String(lm));
          else if (metrics[0]) setLeftMetricId(String(metrics[0].id));
          if (rm) setRightMetricId(String(rm));
          else if (metrics[1]) setRightMetricId(String(metrics[1].id));

          if (items.length < 1 && metrics.length > 0) {
            setMainTab("progreso");
          }
        }
      })
      .catch((e) => {
        toast({
          title: "Error",
          description: e?.message || "Error al cargar historial",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [open, patientId, toast]);

  useEffect(() => {
    if (!open || !leftId || !rightId || leftId === rightId) {
      setCompare(null);
      return;
    }
    fetch(
      `${API_URL}/nutritionist/patients/${patientId}/plans/compare?left_assignment_id=${leftId}&right_assignment_id=${rightId}`,
      { headers: headers() }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo comparar");
        return res.json();
      })
      .then(setCompare)
      .catch(() => setCompare(null));
  }, [open, patientId, leftId, rightId]);

  useEffect(() => {
    if (!open || !leftMetricId || !rightMetricId || leftMetricId === rightMetricId) {
      setProgressCompare(null);
      return;
    }
    fetch(
      `${API_URL}/nutritionist/patients/${patientId}/progress/compare?left_metric_id=${leftMetricId}&right_metric_id=${rightMetricId}`,
      { headers: headers() }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo comparar progreso");
        return res.json();
      })
      .then(setProgressCompare)
      .catch(() => setProgressCompare(null));
  }, [open, patientId, leftMetricId, rightMetricId]);

  const planLabel = (id: string) => {
    const item = timeline.find((t) => String(t.assignment_id) === id);
    if (!item) return "Plan";
    const status = item.status === "active" ? " (activo)" : "";
    return `${item.plan_name || "Plan"}${status}`;
  };

  const metricLabel = (id: string) => {
    const m = progressMetrics.find((x) => String(x.id) === id);
    if (!m) return "Control";
    const d = m.date
      ? formatInColombia(m.date, { day: "2-digit", month: "short", year: "numeric" })
      : "—";
    return `${d}${m.weight != null ? ` · ${m.weight} kg` : ""}`;
  };

  const phaseTabs = useMemo(() => {
    const by = compare?.changes_by_phase || {};
    return (["meta", "fase_1", "fase_2", "fase_3", "fase_4"] as const).filter(
      (k) => (by[k] || []).length > 0 || k === "meta"
    );
  }, [compare]);

  const progressChrono = useMemo(
    () => [...progressMetrics].sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [progressMetrics]
  );

  const renderDelta = (change: ChangeRow) => {
    if (change.direction === "changed") {
      return (
        <span className="text-xs text-muted-foreground">
          {String(change.before ?? "—")} → {String(change.after ?? "—")}
        </span>
      );
    }
    if (change.delta === null || change.delta === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    const Icon = change.delta > 0 ? ArrowUp : ArrowDown;
    return (
      <span
        className={cn(
          "flex items-center gap-1 text-sm font-medium tabular-nums",
          change.delta > 0 ? "text-amber-600" : "text-emerald-600"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {change.delta > 0 ? "+" : ""}
        {change.delta}
        {change.unit ? ` ${change.unit}` : ""}
      </span>
    );
  };

  const renderChangeTable = (rows: ChangeRow[]) => {
    if (!rows.length) {
      return <p className="text-sm text-muted-foreground py-4">Sin diferencias en esta sección.</p>;
    }
    return (
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Métrica</th>
              <th className="text-right p-3 font-medium">Antes</th>
              <th className="text-right p-3 font-medium">Después</th>
              <th className="text-right p-3 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.field} className="border-t border-border/60">
                <td className="p-3">{c.label}</td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">
                  {c.unit && typeof c.before === "number" ? `${c.before} ${c.unit}` : String(c.before ?? "—")}
                </td>
                <td className="p-3 text-right tabular-nums font-medium">
                  {c.unit && typeof c.after === "number" ? `${c.after} ${c.unit}` : String(c.after ?? "—")}
                </td>
                <td className="p-3 text-right">{renderDelta(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const emptyBoth = timeline.length < 1 && progressMetrics.length < 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Historial y comparación — {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : emptyBoth ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aún no hay planes ni controles de progreso. Al asignar un plan se congela el snapshot de fases; los
            controles antropométricos quedan registrados para comparar.
          </p>
        ) : (
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "planes" | "progreso")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="planes" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Planes / fases
                {timeline.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">
                    {timeline.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="progreso" className="gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                Progreso
                {progressMetrics.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">
                    {progressMetrics.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="planes" className="mt-0 space-y-6">
              {timeline.length < 1 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay planes asignados. Usa la pestaña <strong>Progreso</strong> para comparar controles
                  antropométricos.
                </p>
              ) : (
                <>
                  {evolution.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-teal-600" />
                        Evolución entre visitas
                      </h4>
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-xs sm:text-sm min-w-[480px]">
                          <thead className="bg-teal-50/80">
                            <tr>
                              <th className="text-left p-2 font-medium">Fecha</th>
                              <th className="text-left p-2 font-medium">Plan</th>
                              <th className="text-right p-2 font-medium">Peso</th>
                              <th className="text-right p-2 font-medium">IMC</th>
                              <th className="text-right p-2 font-medium">RE</th>
                              <th className="text-right p-2 font-medium">Kcal plan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evolution.map((row, idx) => (
                              <tr key={`${row.assignment_id}-${idx}`} className="border-t">
                                <td className="p-2 text-muted-foreground">
                                  {row.date
                                    ? formatInColombia(row.date, {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : "—"}
                                </td>
                                <td className="p-2 font-medium truncate max-w-[140px]">
                                  {row.plan_name || "—"}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {row.peso_kg != null ? `${row.peso_kg} kg` : "—"}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {row.imc != null ? row.imc : "—"}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {row.requerimiento_kcal != null ? `${row.requerimiento_kcal}` : "—"}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {row.calories != null ? `${row.calories}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {timeline.length < 2 ? (
                    <p className="text-sm text-muted-foreground">
                      Se necesita al menos otra asignación para comparar fases. El historial de esta asignación ya
                      quedó congelado.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Plan A (actual / nuevo)</Label>
                          <Select value={leftId} onValueChange={setLeftId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {timeline.map((t) => (
                                <SelectItem key={t.assignment_id} value={String(t.assignment_id)}>
                                  {t.plan_name} — {t.status}
                                  {t.peso_kg != null ? ` · ${t.peso_kg} kg` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Plan B (anterior / referencia)</Label>
                          <Select value={rightId} onValueChange={setRightId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {timeline.map((t) => (
                                <SelectItem key={`r-${t.assignment_id}`} value={String(t.assignment_id)}>
                                  {t.plan_name} — {t.status}
                                  {t.peso_kg != null ? ` · ${t.peso_kg} kg` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {compare && (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                              <p className="text-xs uppercase tracking-wide text-primary/80 mb-1">Plan A</p>
                              <p className="font-semibold">
                                {String(compare.left.plan.name || planLabel(leftId))}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {compare.left.plan.calories as number} kcal ·{" "}
                                {String(compare.left.plan.tipo_label || "")}
                              </p>
                              {compare.left.has_frozen_snapshot && (
                                <Badge variant="outline" className="mt-2 text-[10px]">
                                  Snapshot congelado
                                </Badge>
                              )}
                            </div>
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Plan B</p>
                              <p className="font-semibold">
                                {String(compare.right.plan.name || planLabel(rightId))}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {compare.right.plan.calories as number} kcal ·{" "}
                                {String(compare.right.plan.tipo_label || "")}
                              </p>
                              {compare.right.has_frozen_snapshot && (
                                <Badge variant="outline" className="mt-2 text-[10px]">
                                  Snapshot congelado
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">Cambios por fase</h4>
                              <Badge variant="secondary">
                                {compare.summary.total_changes} diferencia
                                {compare.summary.total_changes !== 1 ? "s" : ""}
                              </Badge>
                            </div>

                            {compare.summary.total_changes === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Los planes seleccionados son equivalentes en macros y fases registradas.
                              </p>
                            ) : (
                              <Tabs defaultValue={phaseTabs[0] || "meta"} className="w-full">
                                <TabsList className="flex flex-wrap h-auto gap-1 mb-3">
                                  {phaseTabs.map((ph) => (
                                    <TabsTrigger key={ph} value={ph} className="text-xs">
                                      {PHASE_LABELS[ph] || ph}
                                      <span className="ml-1 opacity-60">
                                        ({(compare.changes_by_phase?.[ph] || []).length})
                                      </span>
                                    </TabsTrigger>
                                  ))}
                                </TabsList>
                                {phaseTabs.map((ph) => (
                                  <TabsContent key={ph} value={ph} className="mt-0">
                                    {renderChangeTable(compare.changes_by_phase?.[ph] || [])}
                                  </TabsContent>
                                ))}
                              </Tabs>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div>
                    <h4 className="font-medium mb-3">Historial de asignaciones (fases congeladas)</h4>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2 pr-3">
                        {timeline.map((t) => (
                          <div
                            key={t.assignment_id}
                            className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{t.plan_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatInColombia(t.start_date || t.assigned_date || "", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                                {t.calories ? ` · ${t.calories} kcal` : ""}
                                {t.peso_kg != null ? ` · ${t.peso_kg} kg` : ""}
                                {t.requerimiento_kcal != null ? ` · RE ${t.requerimiento_kcal}` : ""}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                F3: {t.grupos_con_porcion_f3 ?? 0} grupos
                                {t.has_fase4_detail ? " · F4 con detalle" : ""}
                                {t.has_frozen_snapshot ? " · snapshot ✓" : ""}
                              </p>
                              {t.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>
                              )}
                            </div>
                            <Badge variant={t.status === "active" ? "default" : "outline"}>{t.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="progreso" className="mt-0 space-y-6">
              {progressMetrics.length < 1 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay controles de progreso registrados. Cada control antropométrico queda guardado y se puede
                  comparar con cualquier otro.
                </p>
              ) : (
                <>
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-teal-600" />
                      Todos los controles ({progressMetrics.length})
                    </h4>
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-xs sm:text-sm min-w-[720px]">
                        <thead className="bg-teal-50/80">
                          <tr>
                            <th className="text-left p-2 font-medium sticky left-0 bg-teal-50/95">Fecha</th>
                            {PROGRESS_COLS.map((c) => (
                              <th key={c.key} className="text-right p-2 font-medium whitespace-nowrap">
                                {c.label}
                              </th>
                            ))}
                            <th className="text-left p-2 font-medium">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressChrono.map((m) => {
                            const selected =
                              String(m.id) === leftMetricId || String(m.id) === rightMetricId;
                            return (
                              <tr
                                key={m.id}
                                className={cn(
                                  "border-t cursor-pointer hover:bg-muted/40",
                                  selected && "bg-primary/5"
                                )}
                                onClick={() => {
                                  if (String(m.id) === leftMetricId) return;
                                  if (!rightMetricId || rightMetricId === leftMetricId) {
                                    setRightMetricId(String(m.id));
                                  } else {
                                    setLeftMetricId(String(m.id));
                                  }
                                }}
                              >
                                <td className="p-2 font-medium sticky left-0 bg-inherit whitespace-nowrap">
                                  {m.date
                                    ? formatInColombia(m.date, {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : "—"}
                                  {String(m.id) === leftMetricId && (
                                    <Badge className="ml-1 text-[9px] h-4 px-1" variant="default">
                                      A
                                    </Badge>
                                  )}
                                  {String(m.id) === rightMetricId && (
                                    <Badge className="ml-1 text-[9px] h-4 px-1" variant="outline">
                                      B
                                    </Badge>
                                  )}
                                </td>
                                {PROGRESS_COLS.map((c) => (
                                  <td key={c.key} className="p-2 text-right tabular-nums whitespace-nowrap">
                                    {fmtMetric(m[c.key], c.unit)}
                                  </td>
                                ))}
                                <td className="p-2 text-muted-foreground max-w-[160px] truncate">
                                  {m.notes || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Haz clic en una fila para elegir control A o B. También puedes usar los selectores.
                    </p>
                  </div>

                  {progressMetrics.length < 2 ? (
                    <p className="text-sm text-muted-foreground">
                      Se necesita al menos otro control para comparar. El registro actual ya quedó en el historial.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Control A (más reciente / después)
                          </Label>
                          <Select value={leftMetricId} onValueChange={setLeftMetricId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {progressMetrics.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                  {metricLabel(String(m.id))}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Control B (referencia / antes)
                          </Label>
                          <Select value={rightMetricId} onValueChange={setRightMetricId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {progressMetrics.map((m) => (
                                <SelectItem key={`r-${m.id}`} value={String(m.id)}>
                                  {metricLabel(String(m.id))}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {progressCompare && leftMetricId !== rightMetricId && (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                              <p className="text-xs uppercase tracking-wide text-primary/80 mb-1">Control A</p>
                              <p className="font-semibold">{metricLabel(leftMetricId)}</p>
                              {progressCompare.left.notes && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  {progressCompare.left.notes}
                                </p>
                              )}
                            </div>
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                Control B
                              </p>
                              <p className="font-semibold">{metricLabel(rightMetricId)}</p>
                              {progressCompare.right.notes && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  {progressCompare.right.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                              <h4 className="font-medium">Diferencias A vs B</h4>
                              <div className="flex items-center gap-2">
                                {progressCompare.summary.weight_delta != null && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "tabular-nums",
                                      progressCompare.summary.weight_delta < 0
                                        ? "text-emerald-700 border-emerald-300"
                                        : progressCompare.summary.weight_delta > 0
                                          ? "text-amber-700 border-amber-300"
                                          : ""
                                    )}
                                  >
                                    Peso{" "}
                                    {progressCompare.summary.weight_delta > 0 ? "+" : ""}
                                    {progressCompare.summary.weight_delta} kg
                                  </Badge>
                                )}
                                <Badge variant="secondary">
                                  {progressCompare.summary.total_changes} diferencia
                                  {progressCompare.summary.total_changes !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                            </div>
                            {progressCompare.summary.total_changes === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Los controles seleccionados tienen los mismos valores registrados.
                              </p>
                            ) : (
                              renderChangeTable(progressCompare.changes)
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
