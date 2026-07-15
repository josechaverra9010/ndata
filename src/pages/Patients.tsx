import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "@/config/api";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Mail, Phone, AlertCircle, MoreVertical, Edit, Trash2, Calendar, ClipboardList, Users, UserCheck, Clock, FileText, Eye, Activity, Scale, X, TrendingUp, MessageSquare } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NewPatientDialog } from "@/components/admin/NewPatientDialog";
import { PatientDetailsDialog } from "@/components/admin/PatientDetailsDialog";
import { ScheduleAppointmentDialog } from "@/components/admin/ScheduleAppointmentDialog";
import { PatientPlansDialog } from "@/components/admin/PatientPlansDialog";
import { AssignPlanToPatientDialog } from "@/components/admin/AssignPlanToPatientDialog";
import { AssignPlanWithMenuDialog } from "@/components/admin/AssignPlanWithMenuDialog";
import { BulkAssignMenuDialog } from "@/components/admin/BulkAssignMenuDialog";
import { NewPlanWizard } from "@/components/admin/NewPlanWizard";
import { ClinicalHistoryDialog } from "@/components/admin/ClinicalHistoryDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

// Interface actualizada con todos los campos del backend
interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  foto_perfil: string | null;
  status: string;
  role: string;
  peso_actual: number | null;
  peso_objetivo: number | null;
  nivel_actividad: string | null;
  progreso: number;
  proxima_cita: string;
  altura: number | null;
  direccion: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  pal_factor: number | null;
  alergias: string[] | null;
  preferencias: string[] | null;
  objetivos_salud: string | null;
  condiciones_medicas: string | null;
  alimentos_disgusto: string | null;
  antecedentes_familiares: string | null;
  edad_formateada: string | null;
  fecha_nacimiento?: string | null;
  genero?: string | null;
  evaluacion_nutricional: string | null;
  frecuencia_consumo: any[] | null;
  tiene_plan_activo?: boolean;
  plan_activo?: string | null;
}

const statusStyles: Record<string, string> = {
  activo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  pendiente: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  inactivo: "bg-muted text-muted-foreground border-border",
};

const statusDot: Record<string, string> = {
  activo: "bg-emerald-500",
  pendiente: "bg-amber-500",
  inactivo: "bg-muted-foreground/50",
};

const Patients = () => {
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [clinicalHistoryOpen, setClinicalHistoryOpen] = useState(false);
  const [clinicalHistoryPatient, setClinicalHistoryPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [attentionFilter, setAttentionFilter] = useState<"sin_cita" | "sin_plan" | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Inicializar búsqueda / paciente desde URL
  useEffect(() => {
    const query = searchParams.get("search");
    if (query) setSearchQuery(query);
    const filter = searchParams.get("filter");
    if (filter === "sin_cita" || filter === "sin_plan") {
      setAttentionFilter(filter);
    }
  }, [searchParams]);

  useEffect(() => {
    const patientId = searchParams.get("patientId");
    const action = searchParams.get("action");
    if (action === "new") {
      setSelectedPatient(null);
      setNewPatientOpen(true);
      return;
    }
    if (!patientId || patients.length === 0) return;
    const found = patients.find((p) => String(p.id) === String(patientId));
    if (!found) return;
    setSelectedPatient(found);
    if (action === "schedule") {
      setScheduleOpen(true);
      setDetailsOpen(false);
    } else if (action === "assign-plan") {
      setAssignOpen(true);
      setDetailsOpen(false);
    } else if (action === "edit") {
      setDetailsOpen(false);
      setNewPatientOpen(true);
    } else if (action === "plans") {
      setPlansOpen(true);
      setDetailsOpen(false);
    } else if (action === "clinical") {
      setClinicalHistoryPatient(found);
      setClinicalHistoryOpen(true);
      setDetailsOpen(false);
    } else {
      setDetailsOpen(true);
    }
  }, [searchParams, patients]);

  // Función para cargar los pacientes desde el API
  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validar que la respuesta sea un array
      if (!Array.isArray(data)) {
        throw new Error("Formato de respuesta inválido");
      }

      setPatients(data);
    } catch (error) {
      console.error("Error fetching patients:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      setError(`No se pudo cargar la lista de pacientes: ${errorMessage}`);

      toast({
        title: "Error",
        description: `No se pudo cargar la lista de pacientes. Verifica que el servidor de API (${API_URL}) esté accesible.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Filtrado de pacientes
  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || patient.status === statusFilter;
    const sinCita =
      !patient.proxima_cita ||
      patient.proxima_cita === "Sin cita" ||
      patient.proxima_cita === "Sin programar";
    const matchesAttention =
      !attentionFilter ||
      (attentionFilter === "sin_cita" && sinCita) ||
      (attentionFilter === "sin_plan" && !patient.tiene_plan_activo);

    return matchesSearch && matchesStatus && matchesAttention;
  });

  const withoutAppointmentCount = patients.filter(
    (p) => !p.proxima_cita || p.proxima_cita === "Sin cita" || p.proxima_cita === "Sin programar"
  ).length;
  const withoutPlanCount = patients.filter((p) => !p.tiene_plan_activo).length;

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredPatients.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patients/bulk-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ patient_ids: selectedIds, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo actualizar");
      toast({
        title: "Estados actualizados",
        description: `${data.updated ?? selectedIds.length} pacientes → ${status}`,
      });
      setSelectedIds([]);
      fetchPatients();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error en acción masiva",
        variant: "destructive",
      });
    }
  };

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setDetailsOpen(true);
  };

  // Handler para cuando se crea un nuevo paciente exitosamente
  const handleNewPatientSuccess = () => {
    fetchPatients();
    toast({
      title: "¡Éxito!",
      description: "Paciente creado correctamente",
    });
  };

  // Handler para cuando se actualiza un paciente
  const handlePatientUpdate = () => {
    fetchPatients();
  };

  // Función para reintentar cargar datos
  const handleRetry = () => {
    fetchPatients();
  };

  // Handler para editar paciente
  const handleEdit = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPatient(patient);
    setNewPatientOpen(true);
  };

  // Handler para agendar cita
  const handleSchedule = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPatient(patient);
    setScheduleOpen(true);
  };

  // Handler para ver planes
  const handleViewPlans = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPatient(patient);
    setPlansOpen(true);
  };

  const handleCreatePlan = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPatient(patient);
    // Evitar overlays múltiples (details/plans/schedule/etc.)
    setDetailsOpen(false);
    setPlansOpen(false);
    setScheduleOpen(false);
    setAssignPlanOpen(false);
    setAssignOpen(false);
    setCreatePlanOpen(true);
  };

  const handleGenerateReport = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPatient(patient);
    setClinicalHistoryPatient(patient);
    setDetailsOpen(false);
    setPlansOpen(false);
    setScheduleOpen(false);
    setAssignPlanOpen(false);
    setAssignOpen(false);
    setCreatePlanOpen(false);
    setClinicalHistoryOpen(true);
  };

  // Handler para eliminar paciente
  const handleDeleteClick = (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPatientToDelete(patient);
    setDeleteDialogOpen(true);
  };

  // Confirmar eliminación
  const handleDeleteConfirm = async () => {
    if (!patientToDelete) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patientToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = typeof err.detail === "string" ? err.detail : "Error al eliminar paciente";
        throw new Error(detail);
      }

      toast({
        title: "Paciente eliminado",
        description: `${patientToDelete.nombres} ${patientToDelete.apellidos} ha sido eliminado correctamente`,
      });

      fetchPatients();
    } catch (error: any) {
      console.error("Error deleting patient:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo eliminar el paciente",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPatientToDelete(null);
    }
  };

  const activeCount = patients.filter((p) => p.status === "activo").length;
  const pendingCount = patients.filter((p) => p.status === "pendiente").length;
  const inactiveCount = patients.filter((p) => p.status === "inactivo").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/5 p-5 sm:p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Pacientes</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Gestiona fichas, planes, citas e historia clínica
                  {patients.length > 0 && (
                    <span className="font-medium text-foreground/80"> · {filteredPatients.length} mostrados</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              className="rounded-full shadow-md hover:shadow-lg transition-shadow shrink-0"
              onClick={() => {
                setSelectedPatient(null);
                setNewPatientOpen(true);
              }}
              disabled={loading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo paciente
            </Button>
          </div>
        </div>

        {/* Stats */}
        {!loading && patients.length > 0 && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${!statusFilter ? "ring-2 ring-primary/30 border-primary/30" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{patients.length}</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "activo" ? null : "activo")}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${statusFilter === "activo" ? "ring-2 ring-emerald-500/30 border-emerald-500/30" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2.5">
                  <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{activeCount}</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "pendiente" ? null : "pendiente")}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${statusFilter === "pendiente" ? "ring-2 ring-amber-500/30 border-amber-500/30" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-2.5">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{pendingCount}</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "inactivo" ? null : "inactivo")}
              className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${statusFilter === "inactivo" ? "ring-2 ring-muted-foreground/20" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-muted p-2.5">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Inactivos</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{inactiveCount}</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Search and filters */}
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-10 h-11 rounded-xl bg-muted/30 border-border focus-visible:ring-2 focus-visible:ring-primary/20"
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loading}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 h-11 rounded-xl shrink-0" disabled={loading}>
                      <Filter className="h-4 w-4" />
                      {statusFilter ? `Estado: ${statusFilter}` : "Filtros"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuItem onClick={() => setStatusFilter(null)}>Todos</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("activo")}>Activos</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("pendiente")}>Pendientes</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("inactivo")}>Inactivos</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={attentionFilter === "sin_cita" ? "default" : "outline"}
                  className="rounded-full h-8 text-xs"
                  onClick={() =>
                    setAttentionFilter((v) => (v === "sin_cita" ? null : "sin_cita"))
                  }
                >
                  Sin cita ({withoutAppointmentCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={attentionFilter === "sin_plan" ? "default" : "outline"}
                  className="rounded-full h-8 text-xs"
                  onClick={() =>
                    setAttentionFilter((v) => (v === "sin_plan" ? null : "sin_plan"))
                  }
                >
                  Sin plan ({withoutPlanCount})
                </Button>
              </div>
              {(searchQuery || statusFilter || attentionFilter) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filtros activos:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                      “{searchQuery}”
                      <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setSearchQuery("")}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {statusFilter && (
                    <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1 capitalize">
                      {statusFilter}
                      <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setStatusFilter(null)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {attentionFilter && (
                    <Badge variant="secondary" className="rounded-full gap-1 pl-2.5 pr-1 py-1">
                      {attentionFilter === "sin_cita" ? "Sin cita" : "Sin plan"}
                      <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => setAttentionFilter(null)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full text-xs"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter(null);
                      setAttentionFilter(null);
                    }}
                  >
                    Limpiar todo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedIds.length > 0 && (
          <Card className="rounded-2xl border-primary/25 bg-primary/5 shadow-sm">
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={
                    filteredPatients.length > 0 &&
                    filteredPatients.every((p) => selectedIds.includes(p.id))
                  }
                  onCheckedChange={(v) => toggleSelectAllVisible(!!v)}
                />
                <p className="text-sm font-medium">
                  {selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full h-8"
                  onClick={() => setBulkMenuOpen(true)}
                >
                  <ClipboardList className="h-3.5 w-3.5 mr-1" />
                  Asignar menú
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full h-8"
                  onClick={() => bulkUpdateStatus("activo")}
                >
                  Marcar activo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full h-8"
                  onClick={() => bulkUpdateStatus("pendiente")}
                >
                  Marcar pendiente
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full h-8"
                  onClick={() => setSelectedIds([])}
                >
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleRetry} className="rounded-full shrink-0">
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Patients grid o Loader */}
        {loading ? (
          <LoadingScreen message="Cargando pacientes" />
        ) : filteredPatients.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
            <CardContent className="text-center py-16 px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery || statusFilter || attentionFilter
                  ? "No se encontraron pacientes"
                  : "Aún no tienes pacientes"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                {searchQuery || statusFilter || attentionFilter
                  ? "Prueba otro término o limpia los filtros activos."
                  : "Crea el primero para gestionar menús, citas y seguimiento nutricional."}
              </p>
              {!searchQuery && !statusFilter && !attentionFilter ? (
                <Button
                  className="rounded-full shadow-md"
                  onClick={() => {
                    setSelectedPatient(null);
                    setNewPatientOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear paciente
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter(null);
                    setAttentionFilter(null);
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPatients.map((patient, index) => {
              const initials = `${patient.nombres?.[0] || ""}${patient.apellidos?.[0] || ""}`.toUpperCase() || "?";
              const progress = Math.min(100, Math.max(0, Number(patient.progreso) || 0));
              return (
                <Card
                  key={patient.id}
                  className={`group relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/25 cursor-pointer ${
                    selectedIds.includes(patient.id) ? "ring-2 ring-primary/40 border-primary/30" : ""
                  }`}
                  style={{ animationDelay: `${index * 40}ms` }}
                  onClick={() => handlePatientClick(patient)}
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-accent/60" />
                  <CardContent className="p-5 pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.includes(patient.id)}
                            onCheckedChange={(v) => toggleSelect(patient.id, !!v)}
                          />
                        </div>
                        <div className="relative">
                          <Avatar className="h-12 w-12 border-2 border-background shadow-sm ring-2 ring-primary/15">
                            <AvatarImage
                              src={patient.foto_perfil || ""}
                              alt={`${patient.nombres} ${patient.apellidos}`}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${statusDot[patient.status] || statusDot.activo}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate leading-tight">
                            {patient.nombres} {patient.apellidos}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`rounded-full text-[10px] capitalize px-2 py-0 ${statusStyles[patient.status] || statusStyles.activo}`}
                            >
                              {patient.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {patient.edad_formateada || "Edad N/D"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full opacity-60 group-hover:opacity-100 hover:bg-muted"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl">
                            <DropdownMenuItem onClick={() => handlePatientClick(patient)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(patient)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSchedule(patient)}>
                              <Calendar className="mr-2 h-4 w-4" />
                              Agendar cita
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewPlans(patient)}>
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Ver planes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleGenerateReport(patient, e)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Historia clínica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleCreatePlan(patient, e)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Crear plan
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPatient(patient);
                                setSelectedPlan(null);
                                setAssignOpen(true);
                              }}
                            >
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Asignar plan + menú
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/progress?patientId=${patient.id}`);
                              }}
                            >
                              <TrendingUp className="mr-2 h-4 w-4" />
                              Ver progreso
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/messages?patientId=${patient.id}`);
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Mensajes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(patient)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{patient.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{patient.telefono || "Sin teléfono"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border bg-background/80 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                          <Scale className="h-3 w-3" />
                          Peso
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {patient.peso_actual != null ? `${patient.peso_actual} kg` : "—"}
                          {patient.peso_objetivo != null && (
                            <span className="text-xs font-normal text-muted-foreground"> → {patient.peso_objetivo}</span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/80 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                          <Activity className="h-3 w-3" />
                          Actividad
                        </div>
                        <p className="text-sm font-semibold truncate capitalize">
                          {patient.nivel_actividad || "N/D"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progreso</span>
                        <span className="font-semibold tabular-nums">{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Próxima cita
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {patient.proxima_cita && patient.proxima_cita !== "Sin cita"
                          ? patient.proxima_cita
                          : "Sin agendar"}
                      </span>
                    </div>

                    <div
                      className="grid grid-cols-3 gap-2 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 text-xs"
                        onClick={() => handleSchedule(patient)}
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        Cita
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 text-xs"
                        onClick={() => handleViewPlans(patient)}
                      >
                        <ClipboardList className="h-3.5 w-3.5 mr-1" />
                        Planes
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="rounded-full h-8 text-xs"
                        onClick={(e) => handleCreatePlan(patient, e)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Nuevo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewPatientDialog
        patient={selectedPatient}
        open={newPatientOpen}
        onOpenChange={(open) => {
          setNewPatientOpen(open);
          if (!open) {
            // No limpiar selectedPatient inmediatamente para evitar saltos en otros dialogos
            // pero si cerramos NewPatientDialog, queremos asegurarnos de que el siguiente "Nuevo" sea limpio
          }
        }}
        onSuccess={handleNewPatientSuccess}
      />

      {selectedPatient && (
        <>
          <NewPlanWizard
            open={createPlanOpen}
            onOpenChange={(o) => {
              setCreatePlanOpen(o);
            }}
            patientId={selectedPatient.id}
            onCreatePlan={(newPlan) => {
              toast({
                title: "Plan creado",
                description: "El plan nutricional se creó correctamente. Ahora puedes asignarlo con un menú.",
              });
              setCreatePlanOpen(false);
              setSelectedPlan(newPlan);
              setAssignOpen(true);
              fetchPatients();
            }}
          />

          <ClinicalHistoryDialog
            open={clinicalHistoryOpen}
            onOpenChange={setClinicalHistoryOpen}
            patient={clinicalHistoryPatient || selectedPatient}
          />

          <PatientDetailsDialog
            patient={selectedPatient}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            onUpdate={handlePatientUpdate}
            onEdit={() => handleEdit(selectedPatient)}
            onClinicalHistory={() => handleGenerateReport(selectedPatient)}
            onViewPlans={() => handleViewPlans(selectedPatient)}
          />


          <ScheduleAppointmentDialog
            patient={selectedPatient}
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            onSuccess={() => {
              toast({
                title: "Cita agendada",
                description: "La cita ha sido programada correctamente",
              });
              fetchPatients();
            }}
          />

          <PatientPlansDialog
            patient={selectedPatient}
            open={plansOpen}
            onOpenChange={setPlansOpen}
            onAssignPlan={() => setAssignPlanOpen(true)}
          />

          <AssignPlanToPatientDialog
            patient={selectedPatient}
            open={assignPlanOpen}
            onOpenChange={setAssignPlanOpen}
            onSuccess={() => {
              // Recargar planes si la ventana de planes está abierta
              // Pero como cerramos/abrimos dialogs, tal vez solo mostrar toast
              setPlansOpen(true); // Reabrir lista de planes
            }}
          />

          <AssignPlanWithMenuDialog
            plan={selectedPlan}
            open={assignOpen}
            onOpenChange={setAssignOpen}
            preselectedPatient={selectedPatient}
            onAssignSuccess={() => {
              toast({
                title: "¡Éxito!",
                description: "Plan asignado correctamente al paciente",
              });
              fetchPatients();
            }}
          />
        </>
      )}

      <BulkAssignMenuDialog
        open={bulkMenuOpen}
        onOpenChange={setBulkMenuOpen}
        patientIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          fetchPatients();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{" "}
              <span className="font-semibold">
                {patientToDelete?.nombres} {patientToDelete?.apellidos}
              </span>{" "}
              y todos sus datos asociados (métricas, citas, planes).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Patients;