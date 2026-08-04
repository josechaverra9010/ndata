import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Bell,
  Building2,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";

interface FollowUpTask {
  id: number;
  patient_id: number;
  patient_name?: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  task_type_label: string;
}

export default function AdminClinicalHub() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reminderPreview, setReminderPreview] = useState<any>(null);
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);
  const [epsData, setEpsData] = useState<any>(null);
  const [clinicalDash, setClinicalDash] = useState<any>(null);
  const [abandonment, setAbandonment] = useState<any[]>([]);
  const [runningReminders, setRunningReminders] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: number; nombres: string; apellidos: string }>>([]);
  const [taskForm, setTaskForm] = useState({ patient_id: "", title: "", description: "", due_date: "", task_type: "custom" });

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prev, tasks, eps, dash, risk, pats] = await Promise.all([
        fetch(`${API_URL}/nutritionist/reminders/preview`, { headers: headers() }),
        fetch(`${API_URL}/nutritionist/follow-ups?status=pending`, { headers: headers() }),
        fetch(`${API_URL}/nutritionist/eps/dashboard`, { headers: headers() }),
        fetch(`${API_URL}/nutritionist/analytics/clinical-dashboard`, { headers: headers() }),
        fetch(`${API_URL}/nutritionist/analytics/abandonment-risk?limit=20`, { headers: headers() }),
        fetch(`${API_URL}/patients`, { headers: headers() }),
      ]);
      if (prev.ok) setReminderPreview(await prev.json());
      if (tasks.ok) setFollowUps(await tasks.json());
      if (eps.ok) setEpsData(await eps.json());
      if (dash.ok) setClinicalDash(await dash.json());
      if (risk.ok) setAbandonment(await risk.json());
      if (pats.ok) setPatients(await pats.json());
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el centro avanzado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runReminders = async () => {
    setRunningReminders(true);
    try {
      const res = await fetch(`${API_URL}/nutritionist/reminders/run-automatic?create_tasks=true`, {
        method: "POST",
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      toast({
        title: "Recordatorios enviados",
        description: `${data.notifications_sent} notificaciones · ${data.tasks_created} tareas creadas`,
      });
      loadAll();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setRunningReminders(false);
    }
  };

  const completeTask = async (id: number) => {
    await fetch(`${API_URL}/nutritionist/follow-ups/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status: "done" }),
    });
    loadAll();
  };

  const createTask = async () => {
    if (!taskForm.patient_id || !taskForm.title.trim()) return;
    const res = await fetch(`${API_URL}/nutritionist/follow-ups`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        patient_id: Number(taskForm.patient_id),
        title: taskForm.title,
        description: taskForm.description || undefined,
        due_date: taskForm.due_date || undefined,
        task_type: taskForm.task_type,
      }),
    });
    if (res.ok) {
      toast({ title: "Seguimiento creado" });
      setTaskDialogOpen(false);
      setTaskForm({ patient_id: "", title: "", description: "", due_date: "", task_type: "custom" });
      loadAll();
    }
  };

  const downloadMonthlyPdf = async () => {
    const res = await fetch(`${API_URL}/nutritionist/analytics/monthly-report?format=pdf`, { headers: headers() });
    if (!res.ok) {
      toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_mensual_${new Date().toISOString().slice(0, 7)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cs = clinicalDash?.summary;

  return (
    <AdminLayout>
      <LoadingGate loading={loading} message="Cargando centro avanzado">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              Centro avanzado
            </h1>
            <p className="text-muted-foreground mt-1">
              Recordatorios, panel EPS/programa y analítica clínica
            </p>
          </div>
          <Button variant="outline" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <Tabs defaultValue="reminders">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="reminders" className="gap-1">
              <Bell className="h-3.5 w-3.5" />
              Recordatorios
            </TabsTrigger>
            <TabsTrigger value="eps" className="gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Panel EPS
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Analítica
            </TabsTrigger>
          </TabsList>

          {/* Recordatorios */}
          <TabsContent value="reminders" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={runReminders} disabled={runningReminders}>
                {runningReminders ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
                Ejecutar recordatorios automáticos
              </Button>
              <Button variant="outline" onClick={() => setTaskDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo seguimiento
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview — pacientes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {(reminderPreview?.patient_notifications ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin recordatorios pendientes</p>
                  ) : (
                    reminderPreview.patient_notifications.map((n: any, i: number) => (
                      <div key={i} className="rounded-lg border p-2.5 text-sm">
                        <p className="font-medium">{n.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tareas sugeridas (nutricionista)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {(reminderPreview?.suggested_tasks ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin sugerencias automáticas</p>
                  ) : (
                    reminderPreview.suggested_tasks.map((t: any, i: number) => (
                      <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-sm">
                        <p className="font-medium">{t.patient_name}</p>
                        <p className="text-xs">{t.title}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agenda de seguimiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay tareas pendientes</p>
                ) : (
                  followUps.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.patient_name} · {t.task_type_label}
                          {t.due_date ? ` · vence ${t.due_date}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/progress?patientId=${t.patient_id}`)}>
                          Ver
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => completeTask(t.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Panel EPS */}
          <TabsContent value="eps" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatsCard title="Programas EPS" value={String(epsData?.summary?.total_programs ?? 0)} change="Activos" changeType="neutral" icon={Building2} iconColor="primary" />
              <StatsCard title="Pacientes" value={String(epsData?.summary?.total_patients ?? 0)} change="En programas" changeType="neutral" icon={Activity} iconColor="info" />
              <StatsCard title="En riesgo" value={String(epsData?.summary?.patients_at_risk ?? 0)} change="Requieren seguimiento" changeType="negative" icon={AlertTriangle} iconColor="warning" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {(epsData?.programs ?? []).map((prog: any) => (
                <Card key={prog.eps}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{prog.eps}</CardTitle>
                      <Badge variant="secondary">{prog.patient_count} pac.</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Adherencia prom: {prog.avg_adherence}%</span>
                      <span>En riesgo: {prog.at_risk}</span>
                      <span>Bio: {prog.with_bio}</span>
                    </div>
                    <Progress value={prog.avg_adherence} className="h-1.5" />
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {prog.patients.slice(0, 6).map((p: any) => (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          className="flex justify-between text-sm rounded px-2 py-1 hover:bg-muted/40 cursor-pointer"
                          onClick={() => navigate(`/progress?patientId=${p.id}`)}
                        >
                          <span className="truncate">{p.name}</span>
                          <Badge variant={p.abandonment_level === "high" ? "destructive" : "outline"} className="text-[10px]">
                            {p.adherence_pct}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analítica */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadMonthlyPdf}>
                <Download className="h-4 w-4 mr-2" />
                Reporte mensual PDF
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard title="Adherencia prom." value={`${cs?.avg_adherence ?? 0}%`} change={`${cs?.patients_on_track ?? 0} en meta`} changeType="positive" icon={TrendingUp} iconColor="primary" />
              <StatsCard title="En riesgo" value={String(cs?.patients_at_risk ?? 0)} change="Abandono / baja adherencia" changeType="negative" icon={AlertTriangle} iconColor="warning" />
              <StatsCard title="Progreso peso" value={`${cs?.avg_weight_progress ?? 0}%`} change="Promedio cohorte" changeType="neutral" icon={Activity} iconColor="accent" />
              <StatsCard title="Seguimientos" value={String(cs?.pending_follow_ups ?? 0)} change="Pendientes" changeType="neutral" icon={Bell} iconColor="info" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Predicción de abandono
                </CardTitle>
              </CardHeader>
              <CardContent>
                {abandonment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pacientes en riesgo elevado</p>
                ) : (
                  <div className="space-y-2">
                    {abandonment.map((p) => (
                      <div
                        key={p.patient_id}
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate(`/progress?patientId=${p.patient_id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.factors?.join(" · ")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold tabular-nums text-destructive">{p.score}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">{p.level}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </LoadingGate>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo seguimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Paciente</Label>
              <Select value={taskForm.patient_id} onValueChange={(v) => setTaskForm({ ...taskForm, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.nombres} {p.apellidos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ej. Control bioquímico en 3 meses" />
            </div>
            <div>
              <Label>Fecha límite</Label>
              <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createTask}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
