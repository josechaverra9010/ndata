import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Calendar,
  FileText,
  UserCheck,
  UserX,
} from "lucide-react";

interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  status: string;
}

interface PatientActionsDropdownProps {
  patient: Patient;
  onViewDetails: () => void;
  onUpdate?: () => void;
}

export function PatientActionsDropdown({
  patient,
  onViewDetails,
  onUpdate,
}: PatientActionsDropdownProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) {
        throw new Error("Error al eliminar paciente");
      }

      toast({
        title: "¡Éxito!",
        description: `${patient.nombres} ${patient.apellidos} ha sido eliminado`,
      });

      setDeleteDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting patient:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el paciente. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setNewStatus(status);
    setStatusDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    try {
      setUpdatingStatus(true);

      // Nota: Este endpoint necesitaría ser implementado en el backend
      // Por ahora solo mostramos el toast
      toast({
        title: "Funcionalidad en desarrollo",
        description: `La actualización de estado a "${newStatus}" estará disponible próximamente`,
      });

      setStatusDialogOpen(false);

      // Si el backend implementa el endpoint, descomenta esto:
      /*
      const response = await fetch(`${API_URL}/patients/${patient.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar estado");
      }

      toast({
        title: "¡Éxito!",
        description: `Estado actualizado a ${newStatus}`,
      });

      onUpdate?.();
      */
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEdit = () => {
    toast({
      title: "Funcionalidad en desarrollo",
      description: "La edición de pacientes estará disponible próximamente",
    });
  };

  const handleScheduleAppointment = () => {
    toast({
      title: "Funcionalidad en desarrollo",
      description: "La programación de citas estará disponible próximamente",
    });
  };

  const handleViewPlans = () => {
    toast({
      title: "Funcionalidad en desarrollo",
      description: "La visualización de planes estará disponible próximamente",
    });
  };

  const getStatusIcon = (status: string) => {
    if (status === "activo") return <UserCheck className="h-4 w-4" />;
    if (status === "inactivo") return <UserX className="h-4 w-4" />;
    return <UserCheck className="h-4 w-4" />;
  };

  const getStatusText = (status: string) => {
    if (status === "activo") return "Marcar como activo";
    if (status === "pendiente") return "Marcar como pendiente";
    if (status === "inactivo") return "Marcar como inactivo";
    return status;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onViewDetails}>
            <Eye className="mr-2 h-4 w-4" />
            Ver Detalles
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleScheduleAppointment}>
            <Calendar className="mr-2 h-4 w-4" />
            Agendar Cita
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleViewPlans}>
            <FileText className="mr-2 h-4 w-4" />
            Ver Planes
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Cambiar estado */}
          {patient.status !== "activo" && (
            <DropdownMenuItem onClick={() => handleStatusChange("activo")}>
              {getStatusIcon("activo")}
              <span className="ml-2">{getStatusText("activo")}</span>
            </DropdownMenuItem>
          )}

          {patient.status !== "pendiente" && (
            <DropdownMenuItem onClick={() => handleStatusChange("pendiente")}>
              {getStatusIcon("pendiente")}
              <span className="ml-2">{getStatusText("pendiente")}</span>
            </DropdownMenuItem>
          )}

          {patient.status !== "inactivo" && (
            <DropdownMenuItem onClick={() => handleStatusChange("inactivo")}>
              {getStatusIcon("inactivo")}
              <span className="ml-2">{getStatusText("inactivo")}</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a{" "}
              <strong>
                {patient.nombres} {patient.apellidos}
              </strong>{" "}
              y todos sus datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar estado del paciente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas cambiar el estado de{" "}
              <strong>
                {patient.nombres} {patient.apellidos}
              </strong>{" "}
              a <strong className="capitalize">{newStatus}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusChange}
              disabled={updatingStatus}
            >
              {updatingStatus ? "Actualizando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}