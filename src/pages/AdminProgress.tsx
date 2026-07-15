import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Target,
  Scale,
  Activity,
  ChevronRight,
  Award,
  Flame,
  Droplets,
  Apple,
  LineChart,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  Plus,
  Calendar,
  MoreHorizontal,
  Trash2,
  History,
  MessageSquare,
  X,
  Users,
} from "lucide-react";
import { API_URL } from "@/config/api";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

interface Metric {
  id?: number;
  date: string;
  weight: number;
  body_fat?: number;
  muscle?: number;
  water?: number;
  waist?: number;
  hip?: number;
  chest?: number;
  arm?: number;
}

interface PatientProgress {
  id: number;
  name: string;
  avatar?: string;
  plan: string;
  plan_id?: number;
  start_date: string;
  current_weight: number;
  initial_weight: number;
  goal_weight: number;
  weekly_adherence: number;
  trend: "up" | "down" | "stable";
  last_update: string;
  progress_percentage: number;
}

interface PatientProgressDetails extends PatientProgress {
  metrics: Metric[];
  achievements: string[];
  achievementsList?: { id: number; title: string; description: string; date: string }[];
  notes: string[];
  notesList?: { id: number; content: string; date: string }[];
  metricsHistory?: {
    id: number;
    date: string;
    weight: number;
    body_fat?: number;
    muscle?: number;
    water?: number;
    waist?: number;
    hip?: number;
    chest?: number;
    arm?: number;
    notes?: string
  }[];
}

interface Stats {
  total_patients: number;
  avg_adherence: number;
  patients_on_track: number;
  total_weight_lost: number;
}

const AdminProgress = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTrend, setFilterTrend] = useState<string>("all");
  const [patients, setPatients] = useState<PatientProgress[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientProgressDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total_patients: 0,
    avg_adherence: 0,
    patients_on_track: 0,
    total_weight_lost: 0
  });

  // Estados para agregar métrica
  const [addMetricOpen, setAddMetricOpen] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<number | null>(null);
  const [metricForm, setMetricForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: "",
    body_fat: "",
    muscle: "",
    water: "",
    waist: "",
    hip: "",
    chest: "",
    arm: "",
    notes: ""
  });

  const [addAchievementOpen, setAddAchievementOpen] = useState(false);
  const [editingAchievementId, setEditingAchievementId] = useState<number | null>(null);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    description: "",
    achieved_date: new Date().toISOString().split('T')[0]
  });

  // Estados para agregar nota
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteForm, setNoteForm] = useState({ note: "" });

  // Estados para eliminar
  const [deleteTarget, setDeleteTarget] = useState<
    null | { type: "metric" | "achievement" | "note"; id: number; label: string }
  >(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const isInitialLoad = useRef(true);
  const openedFromUrl = useRef<number | null>(null);

  // Stats una vez al montar
  useEffect(() => {
    fetchStats();
  }, []);

  // Listado: debounce de búsqueda + filtro de tendencia (sin doble fetch)
  useEffect(() => {
    const delay = searchTerm ? 300 : 0;
    const timer = setTimeout(() => {
      fetchPatients();
    }, delay);
    return () => clearTimeout(timer);
  }, [searchTerm, filterTrend]);

  // Deep-link ?patientId= abre detalle aunque no esté en la lista filtrada
  useEffect(() => {
    if (loading) return;
    const patientIdParam = searchParams.get("patientId");
    if (!patientIdParam) return;
    const patientId = parseInt(patientIdParam, 10);
    if (Number.isNaN(patientId)) return;
    if (openedFromUrl.current === patientId) return;
    openedFromUrl.current = patientId;
    fetchPatientDetails(patientId);
  }, [loading, searchParams]);

  const authHeaders = () => {
    const token = localStorage.getItem("userToken");
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchPatients = async () => {
    try {
      if (isInitialLoad.current) setLoading(true);
      const params = new URLSearchParams({
        trend: filterTrend || "all",
        search: searchTerm || "",
      });
      const response = await fetch(`${API_URL}/progress/patients?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Error al cargar pacientes");
      const data = await response.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/progress/stats`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Error al cargar estadísticas");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas de progreso",
        variant: "destructive",
      });
    }
  };

  const fetchPatientDetails = async (patientId: number) => {
    try {
      const response = await fetch(`${API_URL}/progress/patients/${patientId}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Error al cargar detalles");
      const data = await response.json();
      setSelectedPatient(data);
      setDetailsOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del paciente",
        variant: "destructive"
      });
    }
  };

  const handleAddMetric = async () => {
    if (!selectedPatient || !metricForm.weight) {
      toast({
        title: "Error",
        description: "El peso es obligatorio",
        variant: "destructive"
      });
      return;
    }

    try {
      const url = editingMetricId
        ? `${API_URL}/progress/metrics/${editingMetricId}`
        : `${API_URL}/progress/metrics`;

      const response = await fetch(url.trim(), {
        method: editingMetricId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          date: metricForm.date,
          weight: parseFloat(metricForm.weight),
          body_fat: metricForm.body_fat ? parseFloat(metricForm.body_fat) : null,
          muscle: metricForm.muscle ? parseFloat(metricForm.muscle) : null,
          water: metricForm.water ? parseFloat(metricForm.water) : null,
          waist: metricForm.waist ? parseFloat(metricForm.waist) : null,
          hip: metricForm.hip ? parseFloat(metricForm.hip) : null,
          chest: metricForm.chest ? parseFloat(metricForm.chest) : null,
          arm: metricForm.arm ? parseFloat(metricForm.arm) : null,
          notes: metricForm.notes || null
        })
      });

      if (!response.ok) throw new Error(editingMetricId ? "Error al actualizar métrica" : "Error al crear métrica");

      toast({
        title: "Éxito",
        description: editingMetricId ? "Métrica actualizada correctamente" : "Métrica registrada correctamente"
      });

      setAddMetricOpen(false);
      setEditingMetricId(null);
      setMetricForm({
        date: new Date().toISOString().split('T')[0],
        weight: "",
        body_fat: "",
        muscle: "",
        water: "",
        waist: "",
        hip: "",
        chest: "",
        arm: "",
        notes: ""
      });

      // Recargar datos
      fetchPatientDetails(selectedPatient.id);
      fetchPatients();
      fetchStats();
    } catch (error) {
      toast({
        title: "Error",
        description: editingMetricId ? "No se pudo actualizar la métrica" : "No se pudo registrar la métrica",
        variant: "destructive"
      });
    }
  };

  const handleEditClick = (metric: any) => {
    setEditingMetricId(metric.id);
    setMetricForm({
      date: metric.date.split('T')[0],
      weight: metric.weight.toString(),
      body_fat: metric.body_fat?.toString() || "",
      muscle: metric.muscle?.toString() || "",
      water: metric.water?.toString() || "",
      waist: metric.waist?.toString() || "",
      hip: metric.hip?.toString() || "",
      chest: metric.chest?.toString() || "",
      arm: metric.arm?.toString() || "",
      notes: metric.notes || ""
    });
    setAddMetricOpen(true);
  };

  const handleAddAchievement = async () => {
    if (!selectedPatient || !achievementForm.title) {
      toast({
        title: "Error",
        description: "El título es obligatorio",
        variant: "destructive"
      });
      return;
    }

    try {
      const url = editingAchievementId
        ? `${API_URL}/progress/achievements/${editingAchievementId}`
        : `${API_URL}/progress/achievements`;

      const body = editingAchievementId
        ? {
            title: achievementForm.title,
            description: achievementForm.description || null,
            achieved_date: achievementForm.achieved_date,
            icon: "award",
          }
        : {
            patient_id: selectedPatient.id,
            title: achievementForm.title,
            description: achievementForm.description || null,
            achieved_date: achievementForm.achieved_date,
            icon: "award",
          };

      const response = await fetch(url, {
        method: editingAchievementId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(editingAchievementId ? "Error al actualizar logro" : "Error al crear logro");

      toast({
        title: "Éxito",
        description: editingAchievementId ? "Logro actualizado correctamente" : "Logro registrado correctamente"
      });

      setAddAchievementOpen(false);
      setEditingAchievementId(null);
      setAchievementForm({
        title: "",
        description: "",
        achieved_date: new Date().toISOString().split('T')[0]
      });

      fetchPatientDetails(selectedPatient.id);
    } catch (error) {
      toast({
        title: "Error",
        description: editingAchievementId ? "No se pudo actualizar el logro" : "No se pudo registrar el logro",
        variant: "destructive"
      });
    }
  };

  const handleAddNote = async () => {
    if (!selectedPatient || !noteForm.note) {
      toast({
        title: "Error",
        description: "La nota no puede estar vacía",
        variant: "destructive"
      });
      return;
    }

    try {
      const url = editingNoteId
        ? `${API_URL}/progress/notes/${editingNoteId}`
        : `${API_URL}/progress/notes`;

      const body = editingNoteId
        ? { note: noteForm.note }
        : {
            patient_id: selectedPatient.id,
            note: noteForm.note,
          };

      const response = await fetch(url, {
        method: editingNoteId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(editingNoteId ? "Error al actualizar nota" : "Error al crear nota");

      toast({
        title: "Éxito",
        description: editingNoteId ? "Nota actualizada correctamente" : "Nota agregada correctamente"
      });

      setAddNoteOpen(false);
      setEditingNoteId(null);
      setNoteForm({ note: "" });

      fetchPatientDetails(selectedPatient.id);
    } catch (error) {
      toast({
        title: "Error",
        description: editingNoteId ? "No se pudo actualizar la nota" : "No se pudo agregar la nota",
        variant: "destructive"
      });
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <ArrowUp className="h-4 w-4 text-emerald-500" />;
      case "down":
        return <ArrowDown className="h-4 w-4 text-blue-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendBadge = (trend: string, plan: string) => {
    const isWeightLoss = plan.toLowerCase().includes("pérdida");
    const isGain = plan.toLowerCase().includes("ganancia");

    if (trend === "down") {
      return (
        <Badge
          variant="outline"
          className={`gap-1 rounded-full text-[10px] ${
            isWeightLoss
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          <TrendingDown className="h-3 w-3" />
          Bajando
        </Badge>
      );
    } else if (trend === "up") {
      return (
        <Badge
          variant="outline"
          className={`gap-1 rounded-full text-[10px] ${
            isGain
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          <TrendingUp className="h-3 w-3" />
          Subiendo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 rounded-full text-[10px] border-border bg-muted/50 text-muted-foreground">
        <Activity className="h-3 w-3" />
        Estable
      </Badge>
    );
  };

  // Preparar datos para las gráficas (fechas reales)
  const prepareChartData = (metrics: Metric[]) => {
    return metrics.map((m) => {
      let label = m.date;
      try {
        const d = new Date(m.date.includes("T") ? m.date : `${m.date}T00:00:00`);
        if (!Number.isNaN(d.getTime())) {
          label = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
        }
      } catch {
        /* keep raw */
      }
      return {
        date: label,
        weight: m.weight,
        body_fat: m.body_fat,
        muscle: m.muscle,
        water: m.water,
        waist: m.waist,
        hip: m.hip,
        chest: m.chest,
        arm: m.arm,
      };
    });
  };

  const confirmDelete = async () => {
    if (!selectedPatient || !deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      const path =
        target.type === "metric"
          ? `/progress/metrics/${target.id}`
          : target.type === "achievement"
            ? `/progress/achievements/${target.id}`
            : `/progress/notes/${target.id}`;

      const response = await fetch(`${API_URL}${path}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Error al eliminar");

      toast({
        title: "Éxito",
        description:
          target.type === "metric"
            ? "Métrica eliminada"
            : target.type === "achievement"
              ? "Logro eliminado"
              : "Nota eliminada",
      });

      setDeleteTarget(null);
      await fetchPatientDetails(selectedPatient.id);
      if (target.type === "metric") {
        fetchPatients();
        fetchStats();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Cargando progreso" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 p-5 sm:p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Progreso</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Seguimiento de peso, adherencia y evolución
                  {patients.length > 0 && (
                    <span className="font-medium text-foreground/80"> · {patients.length} pacientes</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">En seguimiento</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.total_patients}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/10 p-2.5">
                <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Adherencia prom.</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats.avg_adherence}%</p>
                <Progress value={stats.avg_adherence} className="mt-1.5 h-1.5" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5">
                <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">En objetivo</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">
                  {stats.patients_on_track}
                  <span className="text-sm font-medium text-muted-foreground">/{stats.total_patients}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-sky-500/10 p-2.5">
                <Scale className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Peso perdido</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">
                  {stats.total_weight_lost.toFixed(1)}
                  <span className="text-sm font-medium text-muted-foreground ml-1">kg</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre de paciente..."
                  className="pl-10 h-11 rounded-xl bg-muted/30 border-border focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={filterTrend} onValueChange={setFilterTrend}>
                <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl">
                  <Filter className="mr-2 h-4 w-4 shrink-0" />
                  <SelectValue placeholder="Tendencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="down">Bajando peso</SelectItem>
                  <SelectItem value="up">Subiendo peso</SelectItem>
                  <SelectItem value="stable">Estable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Todas" },
                { value: "down", label: "Bajando" },
                { value: "up", label: "Subiendo" },
                { value: "stable", label: "Estable" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFilterTrend(t.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                    filterTrend === t.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {(searchTerm || filterTrend !== "all") && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Filtros activos:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                    “{searchTerm}”
                    <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setSearchTerm("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filterTrend !== "all" && (
                  <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1 capitalize">
                    {filterTrend === "down" ? "Bajando" : filterTrend === "up" ? "Subiendo" : "Estable"}
                    <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setFilterTrend("all")}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-full"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterTrend("all");
                  }}
                >
                  Limpiar todo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient Progress List */}
        {patients.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-emerald-500/30 to-transparent" />
            <CardContent className="text-center py-16 px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Activity className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron pacientes</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                {searchTerm || filterTrend !== "all"
                  ? "Prueba otro término o limpia los filtros activos."
                  : "Cuando asignes planes a pacientes, su progreso aparecerá aquí."}
              </p>
              {(searchTerm || filterTrend !== "all") && (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterTrend("all");
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {patients.map((patient) => {
              const delta = patient.current_weight - patient.initial_weight;
              const remaining = Math.abs(patient.goal_weight - patient.current_weight);
              const initials = patient.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <Card
                  key={patient.id}
                  className="group relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/25 cursor-pointer"
                  onClick={() => fetchPatientDetails(patient.id)}
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500/70 to-sky-500/50" />
                  <CardContent className="p-0">
                    <div className="flex flex-col xl:flex-row xl:items-stretch">
                      {/* Patient Info */}
                      <div className="flex items-center gap-4 p-5 xl:w-[280px] shrink-0">
                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm ring-2 ring-primary/15">
                          <AvatarImage src={patient.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate tracking-tight">{patient.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{patient.plan || "Sin plan"}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {getTrendBadge(patient.trend, patient.plan || "")}
                          </div>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 p-4 xl:py-5 xl:pr-2 bg-muted/25 xl:border-l border-t xl:border-t-0">
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                            <Scale className="h-3 w-3" />
                            Actual
                          </div>
                          <p className="text-lg font-bold tabular-nums">{patient.current_weight} kg</p>
                          <div className="flex items-center justify-center text-[11px] text-muted-foreground mt-0.5">
                            {getTrendIcon(patient.trend)}
                            <span className="ml-1 tabular-nums">
                              {delta > 0 ? "+" : ""}
                              {delta.toFixed(1)} kg
                            </span>
                          </div>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                            <Target className="h-3 w-3" />
                            Objetivo
                          </div>
                          <p className="text-lg font-bold tabular-nums">{patient.goal_weight} kg</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Faltan {remaining.toFixed(1)} kg
                          </p>
                        </div>
                        <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-0.5">
                            <Flame className="h-3 w-3" />
                            Adherencia
                          </div>
                          <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
                            {patient.weekly_adherence}%
                          </p>
                          <Progress value={patient.weekly_adherence} className="h-1.5 mt-1.5" />
                        </div>
                        <div className="rounded-xl border bg-primary/5 border-primary/20 px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-primary mb-0.5">
                            <LineChart className="h-3 w-3" />
                            Progreso
                          </div>
                          <p className="text-lg font-bold tabular-nums text-primary">{patient.progress_percentage}%</p>
                          <Progress value={patient.progress_percentage} className="h-1.5 mt-1.5" />
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center justify-end gap-2 p-4 xl:w-auto xl:border-l border-t xl:border-t-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/messages?patientId=${patient.id}`)}
                          className="hidden md:inline-flex rounded-full h-9 gap-1.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Mensaje
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => fetchPatientDetails(patient.id)}
                          className="rounded-full h-9 gap-1"
                        >
                          Detalles
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Patient Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 gap-0">
            {selectedPatient && (
              <>
                <div className="sticky top-0 z-10 border-b bg-gradient-to-br from-background via-background to-primary/[0.04] px-6 pt-6 pb-4">
                  <DialogHeader className="text-left space-y-0">
                    <DialogTitle className="sr-only">{selectedPatient.name}</DialogTitle>
                    <DialogDescription className="sr-only">Detalle de progreso del paciente</DialogDescription>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-14 w-14 border-2 border-primary/15 shadow-sm">
                          <AvatarImage src={selectedPatient.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {selectedPatient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-lg tracking-tight truncate">{selectedPatient.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{selectedPatient.plan}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {getTrendBadge(selectedPatient.trend, selectedPatient.plan || "")}
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              {selectedPatient.progress_percentage}% progreso
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 shrink-0 sm:max-w-[280px]">
                        <div className="rounded-xl border bg-background/80 px-2.5 py-2 text-center shadow-sm">
                          <p className="text-[10px] uppercase text-muted-foreground">Actual</p>
                          <p className="text-sm font-bold tabular-nums">{selectedPatient.current_weight} kg</p>
                        </div>
                        <div className="rounded-xl border bg-background/80 px-2.5 py-2 text-center shadow-sm">
                          <p className="text-[10px] uppercase text-muted-foreground">Meta</p>
                          <p className="text-sm font-bold tabular-nums">{selectedPatient.goal_weight} kg</p>
                        </div>
                        <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 px-2.5 py-2 text-center shadow-sm">
                          <p className="text-[10px] uppercase text-amber-700 dark:text-amber-400">Adher.</p>
                          <p className="text-sm font-bold tabular-nums">{selectedPatient.weekly_adherence}%</p>
                        </div>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <ScrollArea className="max-h-[calc(90vh-9rem)] px-6 py-4">
                <Tabs defaultValue="evolution" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-auto p-1 rounded-xl bg-muted/60">
                    <TabsTrigger value="evolution" className="rounded-lg data-[state=active]:shadow-sm">Evolución</TabsTrigger>
                    <TabsTrigger value="metrics" className="rounded-lg data-[state=active]:shadow-sm">Métricas</TabsTrigger>
                    <TabsTrigger value="achievements" className="rounded-lg data-[state=active]:shadow-sm">Logros</TabsTrigger>
                  </TabsList>

                  <TabsContent value="evolution" className="space-y-4 mt-4">
                    {/* Weight Chart */}
                    <Card className="rounded-2xl border-border/80 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Scale className="h-4 w-4 text-primary" />
                          Evolución del peso
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedPatient.metrics.length > 0 ? (
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={prepareChartData(selectedPatient.metrics)}>
                                <defs>
                                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="date" className="text-xs" />
                                <YAxis domain={['auto', 'auto']} className="text-xs" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="weight"
                                  stroke="hsl(var(--primary))"
                                  fill="url(#weightGradient)"
                                  strokeWidth={2}
                                  name="Peso (kg)"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                            No hay datos de peso registrados
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Body Composition Chart */}
                    {selectedPatient.metrics.some(m => m.body_fat || m.muscle || m.water) && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Composición Corporal
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsLineChart data={prepareChartData(selectedPatient.metrics)}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="date" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="body_fat"
                                  stroke="hsl(var(--destructive))"
                                  strokeWidth={2}
                                  name="Grasa (%)"
                                  dot={{ r: 4 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="muscle"
                                  stroke="hsl(142, 76%, 36%)"
                                  strokeWidth={2}
                                  name="Músculo (%)"
                                  dot={{ r: 4 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="water"
                                  stroke="hsl(199, 89%, 48%)"
                                  strokeWidth={2}
                                  name="Agua (%)"
                                  dot={{ r: 4 }}
                                />
                              </RechartsLineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="metrics" className="space-y-4 mt-4">
                    <div className="flex justify-end mb-4">
                      <Button onClick={() => {
                        setEditingMetricId(null);
                        setMetricForm({
                          date: new Date().toISOString().split('T')[0],
                          weight: "",
                          body_fat: "",
                          muscle: "",
                          water: "",
                          waist: "",
                          hip: "",
                          chest: "",
                          arm: "",
                          notes: ""
                        });
                        setAddMetricOpen(true);
                      }} size="sm" className="rounded-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar métrica
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Scale className="h-4 w-4 text-primary" />
                            Peso
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Inicial</span>
                              <span className="font-medium">{selectedPatient.initial_weight} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Actual</span>
                              <span className="font-medium">{selectedPatient.current_weight} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Objetivo</span>
                              <span className="font-medium">{selectedPatient.goal_weight} kg</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 mt-2">
                              <span className="text-muted-foreground">Cambio</span>
                              <span className="font-bold text-primary">
                                {(selectedPatient.current_weight - selectedPatient.initial_weight).toFixed(2)} kg
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {selectedPatient.metrics.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Droplets className="h-4 w-4 text-blue-500" />
                              Última Composición y Medidas
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              {(() => {
                                const latest = selectedPatient.metrics[selectedPatient.metrics.length - 1];
                                return (
                                  <>
                              {latest.body_fat != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Grasa corporal</span>
                                  <span className="text-xs font-medium">
                                    {latest.body_fat}%
                                  </span>
                                </div>
                              )}
                              {latest.muscle != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Masa muscular</span>
                                  <span className="text-xs font-medium">
                                    {latest.muscle}%
                                  </span>
                                </div>
                              )}
                              {latest.water != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Agua corporal</span>
                                  <span className="text-xs font-medium">
                                    {latest.water}%
                                  </span>
                                </div>
                              )}

                              <div className="col-span-2 border-t my-1 pt-1 opacity-50"></div>

                              {latest.waist != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Cintura</span>
                                  <span className="text-xs font-medium">
                                    {latest.waist} cm
                                  </span>
                                </div>
                              )}
                              {latest.hip != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Cadera</span>
                                  <span className="text-xs font-medium">
                                    {latest.hip} cm
                                  </span>
                                </div>
                              )}
                              {latest.chest != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Pecho</span>
                                  <span className="text-xs font-medium">
                                    {latest.chest} cm
                                  </span>
                                </div>
                              )}
                              {latest.arm != null && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Brazo</span>
                                  <span className="text-xs font-medium">
                                    {latest.arm} cm
                                  </span>
                                </div>
                              )}
                                  </>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Flame className="h-4 w-4 text-orange-500" />
                            Adherencia Semanal
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{selectedPatient.weekly_adherence}%</div>
                          <Progress value={selectedPatient.weekly_adherence} className="mt-2" />
                          <p className="text-xs text-muted-foreground mt-2">
                            {selectedPatient.weekly_adherence >= 80
                              ? "Excelente adherencia al plan"
                              : selectedPatient.weekly_adherence >= 60
                                ? "Buena adherencia, puede mejorar"
                                : "Necesita más seguimiento"}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            Información del Plan
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Inicio</span>
                              <span className="font-medium">
                                {new Date(selectedPatient.start_date).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Última actualización</span>
                              <span className="font-medium">
                                {new Date(selectedPatient.last_update).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Progreso total</span>
                              <span className="font-bold text-primary">
                                {selectedPatient.progress_percentage}%
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* History Table for Metrics */}
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                          Historial de Mediciones
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedPatient.metricsHistory && selectedPatient.metricsHistory.length > 0 ? (
                          <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                              <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Fecha</th>
                                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Peso</th>
                                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Grasa</th>
                                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Músculo</th>
                                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="[&_tr:last-child]:border-0">
                                {selectedPatient.metricsHistory.map((metric) => (
                                  <tr key={metric.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-2 align-middle">{new Date(metric.date).toLocaleDateString()}</td>
                                    <td className="p-2 align-middle font-medium">{metric.weight} kg</td>
                                    <td className="p-2 align-middle">{metric.body_fat ? `${metric.body_fat}%` : '-'}</td>
                                    <td className="p-2 align-middle">{metric.muscle ? `${metric.muscle}%` : '-'}</td>
                                    <td className="p-2 align-middle text-right flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-primary hover:text-primary/90"
                                        onClick={() => handleEditClick(metric)}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                                        onClick={() =>
                                          setDeleteTarget({
                                            type: "metric",
                                            id: metric.id,
                                            label: `métrica del ${new Date(metric.date).toLocaleDateString()}`,
                                          })
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            No hay historial de mediciones disponible.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="achievements" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Award className="h-4 w-4 text-yellow-500" />
                          Logros Alcanzados
                        </CardTitle>
                        <Button onClick={() => {
                          setEditingAchievementId(null);
                          setAchievementForm({
                            title: "",
                            description: "",
                            achieved_date: new Date().toISOString().split('T')[0]
                          });
                          setAddAchievementOpen(true);
                        }} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {selectedPatient.achievements.length > 0 ? (
                          <div className="space-y-2">
                            {selectedPatient.achievementsList?.map((achievement) => (
                              <div
                                key={achievement.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                    <Award className="h-4 w-4 text-yellow-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{achievement.title}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(achievement.date).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary hover:text-primary/90"
                                    onClick={() => {
                                      setEditingAchievementId(achievement.id);
                                      setAchievementForm({
                                        title: achievement.title,
                                        description: achievement.description || "",
                                        achieved_date: achievement.date.split('T')[0]
                                      });
                                      setAddAchievementOpen(true);
                                    }}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: "achievement",
                                        id: achievement.id,
                                        label: `logro “${achievement.title}”`,
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No hay logros registrados todavía
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Apple className="h-4 w-4 text-green-500" />
                          Notas del Nutricionista
                        </CardTitle>
                        <Button onClick={() => {
                          setEditingNoteId(null);
                          setNoteForm({ note: "" });
                          setAddNoteOpen(true);
                        }} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {selectedPatient.notes.length > 0 ? (
                          <div className="space-y-2">
                            {selectedPatient.notesList?.map((note) => (
                              <div
                                key={note.id}
                                className="p-3 rounded-lg border bg-card flex justify-between items-start gap-2"
                              >
                                <div className="flex-1">
                                  <p className="text-sm">{note.content}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(note.date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-primary hover:text-primary/90"
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setNoteForm({ note: note.content });
                                      setAddNoteOpen(true);
                                    }}
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: "note",
                                        id: note.id,
                                        label: "esta nota",
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No hay notas registradas todavía
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Metric Dialog */}
        <Dialog open={addMetricOpen} onOpenChange={setAddMetricOpen}>
          <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-hidden p-0 gap-0">
            <DialogHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-background px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Scale className="h-4 w-4" />
                </span>
                {editingMetricId ? "Editar métrica" : "Agregar métrica"}
              </DialogTitle>
              <DialogDescription>Registra peso, composición y medidas corporales</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4 overflow-y-auto max-h-[calc(90vh-10rem)]">
              <div>
                <Label htmlFor="metric-date">Fecha</Label>
                <Input
                  id="metric-date"
                  type="date"
                  className="mt-1.5 h-11 rounded-xl"
                  value={metricForm.date}
                  onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="metric-weight">Peso (kg) *</Label>
                <Input
                  id="metric-weight"
                  type="number"
                  step="0.1"
                  className="mt-1.5 h-11 rounded-xl"
                  value={metricForm.weight}
                  onChange={(e) => setMetricForm({ ...metricForm, weight: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="metric-fat">Grasa (%)</Label>
                  <Input
                    id="metric-fat"
                    type="number"
                    step="0.1"
                    className="mt-1.5 rounded-xl"
                    value={metricForm.body_fat}
                    onChange={(e) => setMetricForm({ ...metricForm, body_fat: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="metric-muscle">Músculo (%)</Label>
                  <Input
                    id="metric-muscle"
                    type="number"
                    step="0.1"
                    className="mt-1.5 rounded-xl"
                    value={metricForm.muscle}
                    onChange={(e) => setMetricForm({ ...metricForm, muscle: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="metric-water">Agua (%)</Label>
                  <Input
                    id="metric-water"
                    type="number"
                    step="0.1"
                    className="mt-1.5 rounded-xl"
                    value={metricForm.water}
                    onChange={(e) => setMetricForm({ ...metricForm, water: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="metric-notes">Notas</Label>
                <Textarea
                  id="metric-notes"
                  className="mt-1.5 rounded-xl resize-none"
                  value={metricForm.notes}
                  onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
                />
              </div>

              <div className="separator flex items-center gap-2 py-1">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Medidas (cm)</span>
                <div className="h-px bg-border flex-1"></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="metric-waist" className="text-xs">Cintura</Label>
                  <Input
                    id="metric-waist"
                    type="number"
                    step="0.1"
                    className="mt-1 rounded-xl"
                    value={metricForm.waist}
                    onChange={(e) => setMetricForm({ ...metricForm, waist: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="metric-hip" className="text-xs">Cadera</Label>
                  <Input
                    id="metric-hip"
                    type="number"
                    step="0.1"
                    className="mt-1 rounded-xl"
                    value={metricForm.hip}
                    onChange={(e) => setMetricForm({ ...metricForm, hip: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="metric-chest" className="text-xs">Pecho</Label>
                  <Input
                    id="metric-chest"
                    type="number"
                    step="0.1"
                    className="mt-1 rounded-xl"
                    value={metricForm.chest}
                    onChange={(e) => setMetricForm({ ...metricForm, chest: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="metric-arm" className="text-xs">Brazo</Label>
                  <Input
                    id="metric-arm"
                    type="number"
                    step="0.1"
                    className="mt-1 rounded-xl"
                    value={metricForm.arm}
                    onChange={(e) => setMetricForm({ ...metricForm, arm: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end border-t bg-muted/30 px-6 py-4">
              <Button variant="outline" className="rounded-full" onClick={() => setAddMetricOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-full" onClick={handleAddMetric}>
                {editingMetricId ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Achievement Dialog */}
        <Dialog open={addAchievementOpen} onOpenChange={setAddAchievementOpen}>
          <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
            <DialogHeader className="border-b bg-gradient-to-br from-amber-500/10 via-background to-background px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20">
                  <Award className="h-4 w-4" />
                </span>
                {editingAchievementId ? "Editar logro" : "Agregar logro"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div>
                <Label htmlFor="achievement-title">Título *</Label>
                <Input
                  id="achievement-title"
                  className="mt-1.5 h-11 rounded-xl"
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="achievement-description">Descripción</Label>
                <Textarea
                  id="achievement-description"
                  className="mt-1.5 rounded-xl resize-none"
                  value={achievementForm.description}
                  onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="achievement-date">Fecha de logro</Label>
                <Input
                  id="achievement-date"
                  type="date"
                  className="mt-1.5 h-11 rounded-xl"
                  value={achievementForm.achieved_date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, achieved_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end border-t bg-muted/30 px-6 py-4">
              <Button variant="outline" className="rounded-full" onClick={() => setAddAchievementOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-full" onClick={handleAddAchievement}>
                {editingAchievementId ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Note Dialog */}
        <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
          <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
            <DialogHeader className="border-b bg-gradient-to-br from-emerald-500/10 via-background to-background px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20">
                  <Apple className="h-4 w-4" />
                </span>
                {editingNoteId ? "Editar nota" : "Agregar nota"}
              </DialogTitle>
              <DialogDescription>Nota clínica del nutricionista</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div>
                <Label htmlFor="note-content">Nota *</Label>
                <Textarea
                  id="note-content"
                  rows={5}
                  className="mt-1.5 rounded-xl resize-none"
                  value={noteForm.note}
                  onChange={(e) => setNoteForm({ note: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end border-t bg-muted/30 px-6 py-4">
              <Button variant="outline" className="rounded-full" onClick={() => setAddNoteOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-full" onClick={handleAddNote}>
                {editingNoteId ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar?</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a eliminar {deleteTarget?.label}. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full" disabled={deleting}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminProgress;