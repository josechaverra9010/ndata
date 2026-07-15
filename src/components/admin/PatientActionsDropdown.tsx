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
  Trash2,
  Calendar,
  TrendingUp,
  Users,
  MessageSquare,
} from "lucide-react";

interface Patient {
  id: number;
  nombres?: string;
  apellidos?: string;
  name?: string;
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
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const displayName =
    patient.name ||
    [patient.nombres, patient.apellidos].filter(Boolean).join(" ") ||
    patient.email;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = typeof err.detail === "string" ? err.detail : "Error al eliminar paciente";
        throw new Error(detail);
      }

      toast({
        title: "Paciente eliminado",
        description: `${displayName} ha sido eliminado`,
      });

      setDeleteDialogOpen(false);
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting patient:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo eliminar el paciente. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
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
            Ver detalles
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/patients?patientId=${patient.id}`)}>
            <Users className="mr-2 h-4 w-4" />
            Ir a pacientes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/patients?patientId=${patient.id}&action=schedule`)}>
            <Calendar className="mr-2 h-4 w-4" />
            Agendar cita
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/progress?patientId=${patient.id}`)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Ver progreso
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/messages?patientId=${patient.id}`)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Mensajes
          </DropdownMenuItem>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a{" "}
              <strong>{displayName}</strong> y sus datos asociados. No se puede deshacer.
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
    </>
  );
}
