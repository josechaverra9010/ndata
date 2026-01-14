import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Loader2,
  Calendar,
  MoreHorizontal,
  Trash2,
  History,
  MessageSquare
} from "lucide-react";
import axios from "axios";
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

  const { toast } = useToast();

  useEffect(() => {
    fetchPatients();
    fetchStats();
  }, [searchTerm, filterTrend]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/progress/patients?trend=${filterTrend}&search=${searchTerm}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Error al cargar pacientes");
      const data = await response.json();
      setPatients(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Efecto para seleccionar paciente desde URL una vez cargados
  useEffect(() => {
    const patientIdParam = searchParams.get("patientId");
    if (patientIdParam && patients.length > 0) {
      const patientId = parseInt(patientIdParam);
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        fetchPatientDetails(patientId);
        // Opcional: Abrir automáticamente el diálogo de agregar métrica
        // setAddMetricOpen(true); 
      }
    }
  }, [patients, searchParams]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/progress/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Error al cargar estadísticas");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  };

  const fetchPatientDetails = async (patientId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/progress/patients/${patientId}`, {
        headers: { "Authorization": `Bearer ${token}` }
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
        headers: { "Content-Type": "application/json" },
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

      const response = await fetch(url, {
        method: editingAchievementId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          title: achievementForm.title,
          description: achievementForm.description || null,
          achieved_date: achievementForm.achieved_date,
          icon: "award"
        })
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
      const token = localStorage.getItem("token");
      const userId = token ? JSON.parse(atob(token.split('.')[1])).id : 1;

      const url = editingNoteId
        ? `${API_URL}/progress/notes/${editingNoteId}`
        : `${API_URL}/progress/notes`;

      const response = await fetch(url, {
        method: editingNoteId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          note: noteForm.note,
          created_by: userId
        })
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

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPatients();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterTrend]);

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
        <Badge variant={isWeightLoss ? "default" : "destructive"} className="gap-1">
          <TrendingDown className="h-3 w-3" />
          Bajando
        </Badge>
      );
    } else if (trend === "up") {
      return (
        <Badge variant={isGain ? "default" : "secondary"} className="gap-1">
          <TrendingUp className="h-3 w-3" />
          Subiendo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Activity className="h-3 w-3" />
        Estable
      </Badge>
    );
  };

  // Preparar datos para las gráficas
  const prepareChartData = (metrics: Metric[]) => {
    return metrics.map((m, index) => ({
      date: `Sem ${index + 1}`,
      weight: m.weight,
      body_fat: m.body_fat,
      muscle: m.muscle,
      water: m.water,
      waist: m.waist,
      hip: m.hip,
      chest: m.chest,
      arm: m.arm
    }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const handleDeleteMetric = async (metricId: number) => {
    if (!selectedPatient || !confirm("¿Estás seguro de eliminar esta métrica?")) return;
    try {
      await axios.delete(`${API_URL}/progress/metrics/${metricId}`);
      toast({ title: "Éxito", description: "Métrica eliminada" });
      fetchPatientDetails(selectedPatient.id);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const handleDeleteAchievement = async (achievementId: number) => {
    if (!selectedPatient || !confirm("¿Estás seguro de eliminar este logro?")) return;
    try {
      await axios.delete(`${API_URL}/progress/achievements/${achievementId}`);
      toast({ title: "Éxito", description: "Logro eliminado" });
      fetchPatientDetails(selectedPatient.id);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!selectedPatient || !confirm("¿Estás seguro de eliminar esta nota?")) return;
    try {
      await axios.delete(`${API_URL}/progress/notes/${noteId}`);
      toast({ title: "Éxito", description: "Nota eliminada" });
      fetchPatientDetails(selectedPatient.id);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Progreso de Pacientes</h1>
            <p className="text-muted-foreground">Seguimiento y evolución de tus pacientes</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pacientes Activos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_patients}</div>
              <p className="text-xs text-muted-foreground">En seguimiento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Adherencia Promedio</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_adherence}%</div>
              <Progress value={stats.avg_adherence} className="mt-2 h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">En Objetivo</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.patients_on_track}/{stats.total_patients}</div>
              <p className="text-xs text-muted-foreground">Pacientes al día</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Peso Total Perdido</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_weight_lost.toFixed(1)} kg</div>
              <p className="text-xs text-muted-foreground">Entre todos los pacientes</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterTrend} onValueChange={setFilterTrend}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar por tendencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tendencias</SelectItem>
              <SelectItem value="down">Bajando peso</SelectItem>
              <SelectItem value="up">Subiendo peso</SelectItem>
              <SelectItem value="stable">Estable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Patient Progress List */}
        <div className="grid gap-4">
          {patients.map((patient) => (
            <Card key={patient.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row">
                  {/* Patient Info */}
                  <div className="flex items-center gap-4 p-4 lg:w-1/3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={patient.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {patient.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{patient.name}</h3>
                      <p className="text-sm text-muted-foreground">{patient.plan}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getTrendBadge(patient.trend, patient.plan)}
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Peso Actual</span>
                      </div>
                      <p className="text-lg font-bold">{patient.current_weight} kg</p>
                      <div className="flex items-center justify-center text-xs text-muted-foreground">
                        {getTrendIcon(patient.trend)}
                        <span className="ml-1">
                          {Math.abs(patient.current_weight - patient.initial_weight).toFixed(1)} kg
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Objetivo</span>
                      </div>
                      <p className="text-lg font-bold">{patient.goal_weight} kg</p>
                      <p className="text-xs text-muted-foreground">
                        Faltan {Math.abs(patient.goal_weight - patient.current_weight).toFixed(1)} kg
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Flame className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Adherencia</span>
                      </div>
                      <p className="text-lg font-bold">{patient.weekly_adherence}%</p>
                      <Progress value={patient.weekly_adherence} className="h-1.5 mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <LineChart className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Progreso</span>
                      </div>
                      <p className="text-lg font-bold">{patient.progress_percentage}%</p>
                      <Progress value={patient.progress_percentage} className="h-1.5 mt-1" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end p-4 lg:w-auto gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/messages?patientId=${patient.id}`);
                      }}
                      className="hidden md:flex gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Mensaje
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchPatientDetails(patient.id)}
                      className="gap-2"
                    >
                      Ver detalles
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {patients.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No se encontraron pacientes</h3>
              <p className="text-muted-foreground">Intenta con otros filtros de búsqueda</p>
            </CardContent>
          </Card>
        )}

        {/* Patient Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedPatient && (
                  <>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedPatient.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedPatient.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span>{selectedPatient.name}</span>
                      <p className="text-sm font-normal text-muted-foreground">
                        {selectedPatient.plan}
                      </p>
                    </div>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedPatient && (
              <ScrollArea className="max-h-[calc(90vh-120px)]">
                <Tabs defaultValue="evolution" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="evolution">Evolución</TabsTrigger>
                    <TabsTrigger value="metrics">Métricas</TabsTrigger>
                    <TabsTrigger value="achievements">Logros</TabsTrigger>
                  </TabsList>

                  <TabsContent value="evolution" className="space-y-4 mt-4">
                    {/* Weight Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          Evolución del Peso
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
                      }} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Métrica
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
                                {(selectedPatient.current_weight - selectedPatient.initial_weight).toFixed(1)} kg
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
                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].body_fat && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Grasa corporal</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].body_fat}%
                                  </span>
                                </div>
                              )}
                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].muscle && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Masa muscular</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].muscle}%
                                  </span>
                                </div>
                              )}
                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].water && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Agua corporal</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].water}%
                                  </span>
                                </div>
                              )}

                              <div className="col-span-2 border-t my-1 pt-1 opacity-50"></div>

                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].waist && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Cintura</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].waist} cm
                                  </span>
                                </div>
                              )}
                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].hip && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Cadera</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].hip} cm
                                  </span>
                                </div>
                              )}
                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].chest && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Pecho</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].chest} cm
                                  </span>
                                </div>
                              )}
                              {selectedPatient.metrics[selectedPatient.metrics.length - 1].arm && (
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Brazo</span>
                                  <span className="text-xs font-medium">
                                    {selectedPatient.metrics[selectedPatient.metrics.length - 1].arm} cm
                                  </span>
                                </div>
                              )}
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
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => handleDeleteMetric(metric.id)}>
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
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteAchievement(achievement.id)}>
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
                                    onClick={() => handleDeleteNote(note.id)}
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
            )}
          </DialogContent>
        </Dialog>

        {/* Add Metric Dialog */}
        <Dialog open={addMetricOpen} onOpenChange={setAddMetricOpen}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMetricId ? "Editar Métrica" : "Agregar Nueva Métrica"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="metric-date">Fecha</Label>
                <Input
                  id="metric-date"
                  type="date"
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
                  placeholder="75.5"
                  value={metricForm.weight}
                  onChange={(e) => setMetricForm({ ...metricForm, weight: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="metric-fat">Grasa (%)</Label>
                  <Input
                    id="metric-fat"
                    type="number"
                    step="0.1"
                    placeholder="25"
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
                    placeholder="35"
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
                    placeholder="55"
                    value={metricForm.water}
                    onChange={(e) => setMetricForm({ ...metricForm, water: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="metric-notes">Notas</Label>
                <Textarea
                  id="metric-notes"
                  placeholder="Observaciones adicionales..."
                  value={metricForm.notes}
                  onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
                />
              </div>

              <div className="separator flex items-center gap-2 py-2">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Medidas (cm)</span>
                <div className="h-px bg-border flex-1"></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="metric-waist" className="text-xs">Cintura</Label>
                  <Input
                    id="metric-waist"
                    type="number"
                    step="0.1"
                    placeholder="0"
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
                    placeholder="0"
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
                    placeholder="0"
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
                    placeholder="0"
                    value={metricForm.arm}
                    onChange={(e) => setMetricForm({ ...metricForm, arm: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setAddMetricOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddMetric}>
                  {editingMetricId ? "Actualizar" : "Guardar"} Métrica
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Achievement Dialog */}
        <Dialog open={addAchievementOpen} onOpenChange={setAddAchievementOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAchievementId ? "Editar Logro" : "Agregar Nuevo Logro"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="achievement-title">Título *</Label>
                <Input
                  id="achievement-title"
                  placeholder="Primera semana completada"
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="achievement-description">Descripción</Label>
                <Textarea
                  id="achievement-description"
                  placeholder="Detalles del logro alcanzado..."
                  value={achievementForm.description}
                  onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="achievement-date">Fecha de logro</Label>
                <Input
                  id="achievement-date"
                  type="date"
                  value={achievementForm.achieved_date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, achieved_date: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddAchievementOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddAchievement}>
                  {editingAchievementId ? "Actualizar" : "Guardar"} Logro
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Note Dialog */}
        <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingNoteId ? "Editar Nota" : "Agregar Nota"} del Nutricionista</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="note-content">Nota *</Label>
                <Textarea
                  id="note-content"
                  placeholder="Escribe tus observaciones sobre el paciente..."
                  rows={5}
                  value={noteForm.note}
                  onChange={(e) => setNoteForm({ note: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddNoteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddNote}>
                  {editingNoteId ? "Actualizar" : "Guardar"} Nota
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminProgress;