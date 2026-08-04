import { useEffect, useState } from "react";
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
import { ArrowDown, ArrowUp, GitCompare, Loader2, Minus } from "lucide-react";
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
}

interface PlanCompareData {
  patient: { id: number; name: string };
  left: {
    assignment_id: number;
    status: string;
    start_date?: string;
    notes?: string | null;
    plan: Record<string, unknown>;
  };
  right: {
    assignment_id: number;
    status: string;
    start_date?: string;
    notes?: string | null;
    plan: Record<string, unknown>;
  };
  changes: Array<{
    field: string;
    label: string;
    unit: string;
    before: unknown;
    after: unknown;
    delta: number | null;
    direction: string;
  }>;
  summary: { total_changes: number; calorie_delta: number };
}

interface PlanComparatorDialogProps {
  patientId: number;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanComparatorDialog({
  patientId,
  patientName,
  open,
  onOpenChange,
}: PlanComparatorDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [compare, setCompare] = useState<PlanCompareData | null>(null);

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
    fetch(`${API_URL}/nutritionist/patients/${patientId}/plans/history`, { headers: headers() })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar historial");
        return res.json();
      })
      .then((data) => {
        const items: TimelineItem[] = data.timeline || [];
        setTimeline(items);
        const left = data.defaults?.left_assignment_id;
        const right = data.defaults?.right_assignment_id;
        if (left) setLeftId(String(left));
        if (right) setRightId(String(right));
      })
      .catch((e) => {
        toast({
          title: "Error",
          description: e?.message || "Error al cargar planes",
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

  const planLabel = (id: string) => {
    const item = timeline.find((t) => String(t.assignment_id) === id);
    if (!item) return "Plan";
    const status = item.status === "active" ? " (activo)" : "";
    return `${item.plan_name || "Plan"}${status}`;
  };

  const renderDelta = (change: PlanCompareData["changes"][0]) => {
    if (change.direction === "changed") {
      return (
        <span className="text-xs text-muted-foreground">
          {String(change.before)} → {String(change.after)}
        </span>
      );
    }
    if (change.delta === null || change.delta === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    const Icon = change.delta > 0 ? ArrowUp : ArrowDown;
    return (
      <span className={cn("flex items-center gap-1 text-sm font-medium tabular-nums", change.delta > 0 ? "text-amber-600" : "text-emerald-600")}>
        <Icon className="h-3.5 w-3.5" />
        {change.delta > 0 ? "+" : ""}{change.delta}{change.unit ? ` ${change.unit}` : ""}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Comparador de planes — {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : timeline.length < 2 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Se necesitan al menos 2 asignaciones de plan para comparar.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Plan actual / nuevo</Label>
                <Select value={leftId} onValueChange={setLeftId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {timeline.map((t) => (
                      <SelectItem key={t.assignment_id} value={String(t.assignment_id)}>
                        {t.plan_name} — {t.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plan anterior / referencia</Label>
                <Select value={rightId} onValueChange={setRightId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {timeline.map((t) => (
                      <SelectItem key={t.assignment_id} value={String(t.assignment_id)}>
                        {t.plan_name} — {t.status}
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
                    <p className="font-semibold">{String(compare.left.plan.name || planLabel(leftId))}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {compare.left.plan.calories as number} kcal · {String(compare.left.plan.tipo_label || "")}
                    </p>
                    {compare.left.notes && (
                      <p className="text-xs mt-2 text-muted-foreground">Nota: {compare.left.notes}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Plan B</p>
                    <p className="font-semibold">{String(compare.right.plan.name || planLabel(rightId))}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {compare.right.plan.calories as number} kcal · {String(compare.right.plan.tipo_label || "")}
                    </p>
                    {compare.right.notes && (
                      <p className="text-xs mt-2 text-muted-foreground">Nota: {compare.right.notes}</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Cambios detectados</h4>
                    <Badge variant="secondary">{compare.summary.total_changes} diferencia{compare.summary.total_changes !== 1 ? "s" : ""}</Badge>
                  </div>
                  {compare.changes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Los planes seleccionados son equivalentes en macros y tipo.</p>
                  ) : (
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
                          {compare.changes.map((c) => (
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
                  )}
                </div>
              </>
            )}

            <div>
              <h4 className="font-medium mb-3">Historial de asignaciones</h4>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2 pr-3">
                  {timeline.map((t) => (
                    <div key={t.assignment_id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{t.plan_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInColombia(t.start_date || t.assigned_date || "", { day: "2-digit", month: "short", year: "numeric" })}
                          {t.calories ? ` · ${t.calories} kcal` : ""}
                        </p>
                        {t.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>}
                      </div>
                      <Badge variant={t.status === "active" ? "default" : "outline"}>{t.status}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
