import { ReactNode, useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AddMeetingLinkDialog } from "@/components/admin/AddMeetingLinkDialog";
import { Video, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/config/api";
import axios from "axios";

interface AdminLayoutProps {
  children: ReactNode;
}

interface UpcomingAppointment {
  id: number;
  patient_name: string;
  time: string;
  date: string;
  type: string;
  meeting_link: string | null;
  status: string;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [promptAppointment, setPromptAppointment] = useState<UpcomingAppointment | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    checkUpcomingAppointments();
    // Re-check every 5 minutes
    const interval = setInterval(checkUpcomingAppointments, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkUpcomingAppointments = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/upcoming-appointments`);
      const appointments: UpcomingAppointment[] = response.data;

      const now = new Date();

      const needed = appointments.find(appt => {
        if (appt.type !== "videollamada" || appt.meeting_link || appt.status === "cancelada") {
          return false;
        }

        // Parse date and time
        // appt.date is YYYY-MM-DD, appt.time is HH:MM
        const [year, month, day] = appt.date.split("-").map(Number);
        const [hours, minutes] = appt.time.split(":").map(Number);

        const apptDateTime = new Date(year, month - 1, day, hours, minutes);
        const diffMs = apptDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Si falta enlace y la cita es en menos de 2 horas (y no ha pasado hace mucho)
        return diffHours > -0.5 && diffHours <= 2;
      });

      if (needed) {
        setPromptAppointment(needed);
        setShowBanner(true);
      } else {
        setShowBanner(false);
      }
    } catch (error) {
      console.error("Error checking appointments for meeting link:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:ml-64">
        <AdminHeader />

        {showBanner && promptAppointment && (
          <div className="bg-primary/10 border-b border-primary/20 p-3 animate-in fade-in slide-in-from-top duration-300">
            <div className="container max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    ¡Atención! Falta el enlace para la consulta con <span className="font-bold">{promptAppointment.patient_name}</span> a las <span className="font-bold">{promptAppointment.time}</span>.
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Las consultas por videollamada requieren un enlace de reunión para que el paciente pueda unirse.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setIsDialogOpen(true)} className="bg-primary text-primary-foreground">
                  Agregar Enlace
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setShowBanner(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>

      {promptAppointment && (
        <AddMeetingLinkDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          appointmentId={promptAppointment.id}
          patientName={promptAppointment.patient_name}
          onSuccess={() => {
            checkUpcomingAppointments();
            setShowBanner(false);
          }}
        />
      )}
    </div>
  );
}
