import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "@/config/api";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Mail, Phone, AlertCircle, MoreVertical, Edit, Trash2, Calendar, ClipboardList, Users, UserCheck, Clock, FileText, Loader2 } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NewPatientDialog } from "@/components/admin/NewPatientDialog";
import { PatientDetailsDialog } from "@/components/admin/PatientDetailsDialog";
import { ScheduleAppointmentDialog } from "@/components/admin/ScheduleAppointmentDialog";
import { PatientPlansDialog } from "@/components/admin/PatientPlansDialog";
import { AssignPlanToPatientDialog } from "@/components/admin/AssignPlanToPatientDialog";
import { AssignPlanWithMenuDialog } from "@/components/admin/AssignPlanWithMenuDialog";
import { NewPlanWizard } from "@/components/admin/NewPlanWizard";
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
}

const statusStyles: Record<string, string> = {
  activo: "bg-success/10 text-success border-success/20",
  pendiente: "bg-warning/10 text-warning border-warning/20",
  inactivo: "bg-muted text-muted-foreground border-muted",
};

const Patients = () => {
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [generatingReportFor, setGeneratingReportFor] = useState<number | null>(null);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Inicializar búsqueda desde URL
  useEffect(() => {
    const query = searchParams.get("search");
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

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

    return matchesSearch && matchesStatus;
  });

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

  const handleGenerateReport = async (patient: Patient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGeneratingReportFor(patient.id);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}/reports/nutrition`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `informe_nutricional_${(patient.nombres + '_' + patient.apellidos).replace(/\s+/g, '_')}_${dateStr}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: "Informe generado", description: "La descarga iniciará en breve." });
    } catch (error) {
      console.error("Error generando informe:", error);
      toast({ title: "Error", description: "No se pudo generar el informe", variant: "destructive" });
    } finally {
      setGeneratingReportFor(null);
    }
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
        throw new Error("Error al eliminar paciente");
      }

      toast({
        title: "Paciente eliminado",
        description: `${patientToDelete.nombres} ${patientToDelete.apellidos} ha sido eliminado correctamente`,
      });

      fetchPatients();
    } catch (error) {
      console.error("Error deleting patient:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el paciente",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPatientToDelete(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Pacientes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gestiona la información de tus pacientes
                {patients.length > 0 && (
                  <span className="font-medium text-foreground/80"> · {patients.length} total</span>
                )}
              </p>
            </div>
          </div>
          <Button
            className="gradient-primary border-0 shadow-md hover:shadow-lg transition-shadow shrink-0"
            onClick={() => {
              setSelectedPatient(null);
              setNewPatientOpen(true);
            }}
            disabled={loading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Paciente
          </Button>
        </div>

        {/* Search and filters */}
        <Card className="animate-slide-up border-border/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-10 h-10 rounded-lg bg-muted/30 border-border focus-visible:ring-2 focus-visible:ring-primary/20"
                  placeholder="Buscar por nombre o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 h-10 rounded-lg shrink-0" disabled={loading}>
                    <Filter className="h-4 w-4" />
                    {statusFilter ? `Estado: ${statusFilter}` : "Filtros"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                    Todos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("activo")}>
                    Activos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("pendiente")}>
                    Pendientes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("inactivo")}>
                    Inactivos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="animate-slide-up">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="ml-4"
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Patients grid o Loader */}
        {loading ? (
          <LoadingScreen message="Cargando" />
        ) : filteredPatients.length === 0 ? (
          <Card className="border-border/80 shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary/40 to-primary/20" />
            <CardContent className="text-center py-14 px-6">
              <div className="mx-auto w-16 h-16 mb-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery || statusFilter
                  ? "No se encontraron pacientes"
                  : "No hay pacientes registrados"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                {searchQuery || statusFilter
                  ? "Intenta con otro término o quita el filtro de estado."
                  : "Comienza agregando tu primer paciente para gestionar su nutrición."}
              </p>
              {!searchQuery && !statusFilter && (
                <Button
                  className="shadow-md"
                  onClick={() => {
                    setSelectedPatient(null);
                    setNewPatientOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Paciente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPatients.map((patient, index) => (
              <Card
                key={patient.id}
                className="group overflow-hidden rounded-xl border-border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/20 cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handlePatientClick(patient)}
              >
                <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/60" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-primary/20 ring-2 ring-background">
                        <AvatarImage
                          src={patient.foto_perfil || ""}
                          alt={`${patient.nombres} ${patient.apellidos}`}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {patient.nombres[0]}{patient.apellidos[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {patient.nombres} {patient.apellidos}
                        </p>
                        <Badge
                          variant="outline"
                          className={`mt-1 text-xs capitalize ${statusStyles[patient.status] || statusStyles.activo}`}
                        >
                          {patient.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground block mt-1">
                          {patient.edad_formateada || "Edad no registrada"}
                        </span>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-70 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={(e) => handlePatientClick(patient)}>
                            <Search className="mr-2 h-4 w-4" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleEdit(patient)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleSchedule(patient)}>
                            <Calendar className="mr-2 h-4 w-4" />
                            Agendar cita
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleViewPlans(patient)}>
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Ver planes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleGenerateReport(patient, e)}>
                            {generatingReportFor === patient.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-2 h-4 w-4" />
                            )}
                            Generar informe
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleCreatePlan(patient, e)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Crear plan nutricional
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteClick(patient)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 flex-shrink-0 text-muted-foreground/80" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground/80" />
                      <span>{patient.telefono || "No registrado"}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 p-3 rounded-lg bg-muted/40">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Actividad: {patient.nivel_actividad || "N/A"}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{patient.progreso}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/80 animate-progress-fill"
                        style={{ '--progress-end': `${Math.min(100, patient.progreso)}%` } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/80">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Próxima cita
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {patient.proxima_cita}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estadísticas rápidas */}
        {!loading && patients.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 animate-fade-in">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Pacientes</p>
                  <p className="text-2xl font-bold tracking-tight">{patients.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold tracking-tight">
                    {patients.filter(p => p.status === "activo").length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold tracking-tight">
                    {patients.filter(p => p.status === "pendiente").length}
                  </p>
                </div>
              </CardContent>
            </Card>
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
                description: "El plan nutricional se creó correctamente.",
              });
              setCreatePlanOpen(false);
              // Si luego quieres asignarlo inmediatamente, descomenta:
              // setSelectedPlan(newPlan);
              // setAssignOpen(true);
            }}
          />

          <PatientDetailsDialog
            patient={selectedPatient}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            onUpdate={handlePatientUpdate}
            onEdit={() => handleEdit(selectedPatient)}
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
            }}
          />

          <PatientPlansDialog
            patient={selectedPatient}
            open={plansOpen}
            onOpenChange={setPlansOpen}
            onAssignPlan={() => setAssignPlanOpen(true)}
            onEditPlan={(assignment) => {
              toast({
                title: "Editar Plan",
                description: `Editando plan: ${assignment.meal_plan?.name || "Sin nombre"}. Funcionalidad en desarrollo.`,
              });
            }}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{" "}
              <span className="font-semibold">
                {patientToDelete?.nombres} {patientToDelete?.apellidos}
              </span>{" "}
              y todos sus datos asociados (métricas, citas, planes).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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