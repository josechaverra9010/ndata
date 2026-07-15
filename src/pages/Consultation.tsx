import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScheduleAppointmentDialog } from "@/components/admin/ScheduleAppointmentDialog";
import { AssignPlanWithMenuDialog } from "@/components/admin/AssignPlanWithMenuDialog";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Scale,
  Stethoscope,
  TrendingUp,
  User,
  AlertTriangle,
} from "lucide-react";

interface QueueItem {
  appointment_id: number;
  date: string;
  date_label: string;
  time: string;
  duration: string;
  type: string;
  status: string;
  notes?: string;
  patient: {
    id: number;
    name: string;
    nombres: string;
    apellidos: string;
    foto_perfil: string | null;
    email: string;
    telefono: string | null;
    alergias: string[];
    peso_actual: number | null;
    peso_objetivo: number | null;
    progreso: number;
  };
  last_weight: number | null;
  last_weight_date: string | null;
  tiene_plan_activo: boolean;
  plan_activo: string | null;
}

interface PrepData {
  appointment: any;
  patient: any;
  last_metrics: { id: number; date: string; weight: number; notes?: string }[];
  notes: { id: number; note: string; created_at: string }[];
  plan_activo: string | null;
  tiene_plan_activo: boolean;
  checklist_defaults: Record<string, boolean>;
}

type ChecklistKey =
  | "confirm_attendance"
  | "update_weight"
  | "review_menu"
  | "schedule_next"
  | "add_note";

const checklistLabels: { key: ChecklistKey; label: string }[] = [
  { key: "confirm_attendance", label: "Confirmar asistencia" },
  { key: "update_weight", label: "Actualizar peso" },
  { key: "review_menu", label: "Revisar / ajustar menú" },
  { key: "schedule_next", label: "Agendar siguiente cita" },
  { key: "add_note", label: "Dejar nota clínica" },
];

export default function Consultation() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [prep, setPrep] = useState<PrepData | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    confirm_attendance: false,
    update_weight: false,
    review_menu: false,
    schedule_next: false,
    add_note: false,
  });
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const tokenHeaders = () => {
    const token = localStorage.getItem("userToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/consultation/queue?days=5`, {
        headers: tokenHeaders(),
      });
      if (!res.ok) throw new Error("No se pudo cargar la cola");
      const data = await res.json();
      setQueue(Array.isArray(data) ? data : []);
      const fromUrl = searchParams.get("appointmentId");
      if (fromUrl) {
        setSelectedId(Number(fromUrl));
      } else if (data?.length) {
        setSelectedId(data[0].appointment_id);
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error al cargar consultas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPrep = async (appointmentId: number) => {
    try {
      setPrepLoading(true);
      const res = await fetch(`${API_URL}/consultation/prep/${appointmentId}`, {
        headers: tokenHeaders(),
      });
      if (!res.ok) throw new Error("No se pudo cargar la ficha");
      const data: PrepData = await res.json();
      setPrep(data);
      const stored = localStorage.getItem(`consultation_checklist_${appointmentId}`);
      if (stored) {
        setChecklist({ ...data.checklist_defaults, ...JSON.parse(stored) });
      } else {
        setChecklist({
          confirm_attendance: !!data.checklist_defaults.confirm_attendance,
          update_weight: !!data.checklist_defaults.update_weight,
          review_menu: !!data.checklist_defaults.review_menu,
          schedule_next: !!data.checklist_defaults.schedule_next,
          add_note: !!data.checklist_defaults.add_note,
        });
      }
      setWeight(String(data.patient?.peso_actual ?? data.last_metrics?.[0]?.weight ?? ""));
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error al cargar preparación",
        variant: "destructive",
      });
    } finally {
      setPrepLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // Recordatorios 24h (best-effort, una vez al entrar)
    fetch(`${API_URL}/consultation/reminders/send-24h`, {
      method: "POST",
      headers: tokenHeaders(),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadPrep(selectedId);
      const next = new URLSearchParams(searchParams);
      next.set("appointmentId", String(selectedId));
      setSearchParams(next, { replace: true });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    localStorage.setItem(`consultation_checklist_${selectedId}`, JSON.stringify(checklist));
  }, [checklist, selectedId]);

  const selectedQueue = useMemo(
    () => queue.find((q) => q.appointment_id === selectedId) || null,
    [queue, selectedId]
  );

  const doneCount = checklistLabels.filter((c) => checklist[c.key]).length;

  const toggleCheck = (key: ChecklistKey, value: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  };

  const confirmAttendance = async () => {
    if (!selectedId) return;
    const res = await fetch(`${API_URL}/appointments/${selectedId}/status`, {
      method: "PATCH",
      headers: tokenHeaders(),
      body: JSON.stringify({ status: "confirmada" }),
    });
    if (!res.ok) {
      toast({ title: "Error", description: "No se pudo confirmar", variant: "destructive" });
      return;
    }
    toggleCheck("confirm_attendance", true);
    setQueue((prev) =>
      prev.map((q) =>
        q.appointment_id === selectedId ? { ...q, status: "confirmada" } : q
      )
    );
    toast({ title: "Asistencia confirmada" });
  };

  const saveWeight = async () => {
    if (!prep?.patient?.id || !weight) return;
    try {
      setSavingWeight(true);
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${API_URL}/progress/metrics`, {
        method: "POST",
        headers: tokenHeaders(),
        body: JSON.stringify({
          patient_id: prep.patient.id,
          date: today,
          weight: Number(weight),
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el peso");
      toggleCheck("update_weight", true);
      toast({ title: "Peso actualizado" });
      loadPrep(selectedId!);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingWeight(false);
    }
  };

  const saveNote = async () => {
    if (!prep?.patient?.id || !note.trim()) return;
    try {
      setSavingNote(true);
      const res = await fetch(`${API_URL}/progress/notes`, {
        method: "POST",
        headers: tokenHeaders(),
        body: JSON.stringify({ patient_id: prep.patient.id, note: note.trim() }),
      });
      if (!res.ok) throw new Error("No se pudo guardar la nota");
      setNote("");
      toggleCheck("add_note", true);
      toast({ title: "Nota guardada" });
      loadPrep(selectedId!);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Cargando consultas" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.07] p-5 sm:p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80 mb-1">
                Flujo de consulta
              </p>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Stethoscope className="h-6 w-6 text-primary" />
                Próxima consulta
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Prepara, atiende y cierra la cita en un solo lugar.
              </p>
            </div>
            <div className="rounded-xl border bg-background/70 px-3 py-2 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Checklist</p>
              <p className="text-lg font-bold tabular-nums">
                {doneCount}/{checklistLabels.length}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Queue */}
          <Card className="rounded-2xl overflow-hidden h-fit">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base">Cola ({queue.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
              {queue.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Sin citas en los próximos días
                  <div className="mt-3">
                    <Button size="sm" className="rounded-full" onClick={() => navigate("/appointments?action=new")}>
                      Agendar cita
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {queue.map((item) => (
                    <button
                      key={item.appointment_id}
                      type="button"
                      onClick={() => setSelectedId(item.appointment_id)}
                      className={`w-full text-left p-3.5 transition-colors hover:bg-muted/40 ${
                        selectedId === item.appointment_id ? "bg-primary/5 border-l-4 border-l-primary" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={item.patient.foto_perfil || undefined} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {item.patient.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{item.patient.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.date_label} · {item.time}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize text-[10px] shrink-0">
                          {item.status}
                        </Badge>
                      </div>
                      {!item.tiene_plan_activo && (
                        <p className="mt-1.5 text-[11px] text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Sin plan activo
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workspace */}
          <div className="space-y-4">
            {!selectedId || !prep ? (
              <Card className="rounded-2xl p-10 text-center text-muted-foreground">
                {prepLoading ? "Cargando ficha…" : "Selecciona una cita de la cola"}
              </Card>
            ) : (
              <>
                <Card className="rounded-2xl overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14 border-2 border-primary/15">
                          <AvatarImage src={prep.patient.foto_perfil || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">
                            {(prep.patient.nombres?.[0] || "") + (prep.patient.apellidos?.[0] || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h2 className="text-xl font-bold">
                            {prep.patient.nombres} {prep.patient.apellidos}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {selectedQueue?.date_label} · {selectedQueue?.time} ·{" "}
                            {selectedQueue?.type || prep.appointment?.type}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              Peso: {prep.patient.peso_actual ?? "—"} kg
                            </Badge>
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              Progreso: {prep.patient.progreso ?? 0}%
                            </Badge>
                            {prep.tiene_plan_activo ? (
                              <Badge className="rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 border-0">
                                {prep.plan_activo}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="rounded-full text-[10px]">
                                Sin plan
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => navigate(`/patients?patientId=${prep.patient.id}`)}
                        >
                          <User className="h-3.5 w-3.5 mr-1" />
                          Ficha
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => navigate(`/messages?patientId=${prep.patient.id}`)}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          Chat
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => navigate(`/progress?patientId=${prep.patient.id}`)}
                        >
                          <TrendingUp className="h-3.5 w-3.5 mr-1" />
                          Progreso
                        </Button>
                      </div>
                    </div>

                    {(prep.patient.alergias?.length > 0 || prep.patient.condiciones_medicas) && (
                      <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
                        <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> Alertas clínicas
                        </p>
                        {prep.patient.alergias?.length > 0 && (
                          <p>
                            <span className="text-muted-foreground">Alergias:</span>{" "}
                            {Array.isArray(prep.patient.alergias)
                              ? prep.patient.alergias.join(", ")
                              : prep.patient.alergias}
                          </p>
                        )}
                        {prep.patient.condiciones_medicas && (
                          <p>
                            <span className="text-muted-foreground">Condiciones:</span>{" "}
                            {prep.patient.condiciones_medicas}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Checklist de consulta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {checklistLabels.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={checklist[key]}
                            onCheckedChange={(v) => toggleCheck(key, !!v)}
                          />
                          <span className={`text-sm ${checklist[key] ? "text-muted-foreground line-through" : ""}`}>
                            {label}
                          </span>
                        </label>
                      ))}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {prep.appointment?.status !== "confirmada" && (
                          <Button size="sm" className="rounded-full" onClick={confirmAttendance}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Confirmar asistencia
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            setAssignOpen(true);
                            toggleCheck("review_menu", true);
                          }}
                        >
                          <ClipboardList className="h-3.5 w-3.5 mr-1" />
                          Ajustar menú
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            setScheduleOpen(true);
                            toggleCheck("schedule_next", true);
                          }}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          Siguiente cita
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="h-4 w-4 text-primary" />
                        Actualizar peso
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          className="rounded-xl mt-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Último registro:{" "}
                        {prep.last_metrics?.[0]
                          ? `${prep.last_metrics[0].weight} kg (${prep.last_metrics[0].date})`
                          : "sin métricas"}
                      </p>
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={savingWeight}
                        onClick={saveWeight}
                      >
                        {savingWeight ? "Guardando…" : "Guardar peso"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Nota rápida</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Observaciones de la consulta…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="rounded-xl min-h-[90px]"
                    />
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={savingNote || !note.trim()}
                      onClick={saveNote}
                    >
                      {savingNote ? "Guardando…" : "Guardar nota"}
                    </Button>
                    {prep.notes?.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        {prep.notes.slice(0, 3).map((n) => (
                          <div key={n.id} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                            <p className="text-[11px] text-muted-foreground mb-0.5">{n.created_at}</p>
                            <p>{n.note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {prep?.patient && (
        <>
          <ScheduleAppointmentDialog
            patient={prep.patient}
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            onSuccess={() => {
              toggleCheck("schedule_next", true);
              loadQueue();
            }}
          />
          <AssignPlanWithMenuDialog
            plan={null}
            open={assignOpen}
            onOpenChange={setAssignOpen}
            preselectedPatient={{
              id: prep.patient.id,
              nombres: prep.patient.nombres,
              apellidos: prep.patient.apellidos,
            }}
            onAssignSuccess={() => {
              toggleCheck("review_menu", true);
              if (selectedId) loadPrep(selectedId);
              loadQueue();
            }}
          />
        </>
      )}
    </AdminLayout>
  );
}
