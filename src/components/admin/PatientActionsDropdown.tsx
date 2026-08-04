import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Eye,
  Trash2,
  Calendar,
  TrendingUp,
  Users,
  MessageSquare,
} from "lucide-react";
import { DeletePatientDialog } from "@/components/admin/DeletePatientDialog";

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
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
            Mover a papelera
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeletePatientDialog
        patient={patient}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={onUpdate}
      />
    </>
  );
}
