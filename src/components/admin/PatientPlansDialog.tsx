import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, TrendingUp, Utensils, Plus, Pause, Play, Trash2, ClipboardList } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

import { PlanPhasesSummaryDialog } from "./PlanPhasesSummaryDialog";

interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
}

interface MealPlan {
  id: number;
  name: string;
  description: string;
  calories: number;
  duration: string;
  category: string;
  color: string;
}

interface PatientPlanAssignment {
  id: number;
  patient_id: number;
  meal_plan_id: number;
  assigned_date: string;
  start_date: string;
  end_date: string | null;
  current_week: number;
  status: string;
  notes: string | null;
  meal_plan?: MealPlan;
}

interface PatientPlansDialogProps {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignPlan?: () => void;
}

export function PatientPlansDialog({ patient, open, onOpenChange, onAssignPlan }: PatientPlansDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<PatientPlanAssignment[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PatientPlanAssignment | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedSummaryPlan, setSelectedSummaryPlan] = useState<any>(null);

  useEffect(() => {
    if (open && patient) {
      fetchPatientPlans();
    }
  }, [open, patient]);

  const fetchPatientPlans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}/meal-plans`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) {
        throw new Error("Error al cargar planes");
      }

      const data = await response.json();

      // Combinar assignment con plan
      const plansWithDetails = data.map((item: any) => ({
        ...item.assignment,
        meal_plan: item.plan
      }));

      setAssignments(plansWithDetails);
    } catch (error) {
      console.error("Error fetching patient plans:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los planes del paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = async (assignmentId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem("userToken");
      // Intentar con PATCH primero
      let response = await fetch(`${API_URL}/meal-plans/assign/${assignmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      // Si PATCH no funciona (405), intentar con PUT
      if (response.status === 405) {
        const token = localStorage.getItem("userToken");
        response = await fetch(`${API_URL}/meal-plans/assign/${assignmentId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: newStatus }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al cambiar estado");
      }

      const statusText = {
        active: "activado",
        paused: "pausado",
        completed: "completado"
      };

      toast({
        title: "Estado actualizado",
        description: `Plan ${statusText[newStatus as keyof typeof statusText]} correctamente`,
      });

      fetchPatientPlans();
    } catch (error) {
      console.error("Error changing status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cambiar el estado del plan",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (assignment: PatientPlanAssignment) => {
    setPlanToDelete(assignment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans/assign/${planToDelete.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) {
        throw new Error("Error al eliminar asignación");
      }

      toast({
        title: "Plan removido",
        description: "La asignación del plan ha sido eliminada",
      });

      fetchPatientPlans();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la asignación",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    }
  };

  const handleViewPhases = (plan: any) => {
    setSelectedSummaryPlan(plan);
    setSummaryOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-success/10 text-success border-success/20",
      paused: "bg-warning/10 text-warning border-warning/20",
      completed: "bg-primary/10 text-primary border-primary/20",
    };

    const labels = {
      active: "Activo",
      paused: "Pausado",
      completed: "Completado",
    };

    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles] || ""}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Planes Nutricionales</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {patient.nombres} {patient.apellidos}
            </p>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin planes asignados</h3>
              <p className="text-muted-foreground mb-4">
                Este paciente aún no tiene planes nutricionales asignados
              </p>
              <Button onClick={() => onAssignPlan?.()}>
                <Plus className="mr-2 h-4 w-4" />
                Asignar Plan
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg">
                            {assignment.meal_plan?.name || "Plan sin nombre"}
                          </h4>
                          {getStatusBadge(assignment.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {assignment.meal_plan?.description}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPhases(assignment.meal_plan)}
                          className="text-primary hover:text-primary hover:bg-primary/10 mr-1"
                          title="Ver fases del plan"
                        >
                          <ClipboardList className="h-4 w-4 mr-1" />
                          <span className="text-xs">Ver Plan</span>
                        </Button>

                        {assignment.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleChangeStatus(assignment.id, "paused")}
                            title="Pausar plan"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : assignment.status === "paused" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleChangeStatus(assignment.id, "active")}
                            title="Activar plan"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : null}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(assignment)}
                          className="text-destructive hover:text-destructive"
                          title="Eliminar asignación"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-muted-foreground">Inicio</div>
                          <div className="font-medium">
                            {formatDate(assignment.start_date)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-muted-foreground">Semana actual</div>
                          <div className="font-medium">
                            Semana {assignment.current_week}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-muted-foreground">Calorías</div>
                          <div className="font-medium">
                            {assignment.meal_plan?.calories} kcal
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-muted-foreground">Duración</div>
                          <div className="font-medium">
                            {assignment.meal_plan?.duration}
                          </div>
                        </div>
                      </div>
                    </div>

                    {assignment.notes && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-md">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Notas:</span> {assignment.notes}
                        </p>
                      </div>
                    )}

                    {assignment.end_date && (
                      <div className="mt-3 text-sm text-muted-foreground">
                        Finaliza: {formatDate(assignment.end_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanPhasesSummaryDialog
        plan={selectedSummaryPlan}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la asignación del plan{" "}
              <span className="font-semibold">
                {planToDelete?.meal_plan?.name}
              </span>{" "}
              para este paciente. Esta acción no se puede deshacer.
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
    </>
  );
}
