import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video, Building2, ArrowRight, CheckCircle2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface UpcomingAppointment {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_avatar: string | null;
  date: string;
  date_label: string;
  time: string;
  duration: string;
  type: string;
  status: string;
  notes?: string;
  meeting_link?: string | null;
}

interface UpcomingAppointmentsProps {
  appointments?: UpcomingAppointment[];
  loading?: boolean;
  onUpdated?: () => void;
}

const statusStyles = {
  confirmada: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  pendiente: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

export function UpcomingAppointments({
  appointments = [],
  loading = false,
  onUpdated,
}: UpcomingAppointmentsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState(appointments);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  useEffect(() => {
    setItems(appointments);
  }, [appointments]);

  const handleViewCalendar = () => {
    navigate("/appointments");
  };

  const handleAppointmentClick = (appointment: UpcomingAppointment) => {
    const params = new URLSearchParams();
    if (appointment.date) params.set("date", appointment.date);
    params.set("appointmentId", String(appointment.id));
    if (appointment.patient_id) params.set("patientId", String(appointment.patient_id));
    navigate(`/appointments?${params.toString()}`);
  };

  const handleConfirm = async (e: React.MouseEvent, appointment: UpcomingAppointment) => {
    e.stopPropagation();
    try {
      setConfirmingId(appointment.id);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/appointments/${appointment.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: "confirmada" }),
      });
      if (!response.ok) throw new Error("No se pudo confirmar");
      setItems((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, status: "confirmada" } : a))
      );
      toast({ title: "Cita confirmada", description: appointment.patient_name });
      onUpdated?.();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo confirmar la cita",
        variant: "destructive",
      });
    } finally {
      setConfirmingId(null);
    }
  };

  const openPatient = (e: React.MouseEvent, appointment: UpcomingAppointment) => {
    e.stopPropagation();
    navigate(`/patients?patientId=${appointment.patient_id}`);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/90 shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-br from-card to-primary/[0.03] p-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Próximas Citas</h3>
            <p className="text-sm text-muted-foreground">Próximas citas programadas</p>
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted rounded"></div>
                <div className="h-3 w-24 bg-muted rounded"></div>
              </div>
              <div className="h-6 w-20 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 shadow-card overflow-hidden backdrop-blur-sm h-full">
      <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-br from-card via-card to-info/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info ring-1 ring-info/10">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Próximas Citas</h3>
            <p className="text-sm text-muted-foreground">Confirma o abre ficha en un clic</p>
          </div>
        </div>
        <button
          onClick={handleViewCalendar}
          className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Ver calendario
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="divide-y divide-border/60">
        {items.length > 0 ? (
          items.map((appointment, index) => (
            <div
              key={appointment.id}
              className="group flex items-start gap-3 p-4 transition-all hover:bg-muted/35 animate-fade-in cursor-pointer"
              style={{ animationDelay: `${index * 80}ms` }}
              onClick={() => handleAppointmentClick(appointment)}
            >
              <Avatar className="h-11 w-11 border-2 border-background shadow-sm ring-1 ring-border/60">
                <AvatarImage src={appointment.patient_avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {appointment.patient_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {appointment.patient_name}
                  </p>
                  <Badge
                    variant="outline"
                    className={`capitalize text-[10px] shrink-0 ${
                      statusStyles[appointment.status as keyof typeof statusStyles] ||
                      statusStyles.pendiente
                    }`}
                  >
                    {appointment.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5">
                    <Calendar className="h-3 w-3" />
                    {appointment.date_label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5">
                    <Clock className="h-3 w-3" />
                    {appointment.time}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5">
                    {appointment.type === "videollamada" ? (
                      <Video className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                    {appointment.type === "videollamada" ? "Virtual" : "Presencial"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {appointment.status === "pendiente" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                      disabled={confirmingId === appointment.id}
                      onClick={(e) => handleConfirm(e, appointment)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Confirmar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/consultation?appointmentId=${appointment.id}`);
                    }}
                  >
                    Atender
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full text-xs"
                    onClick={(e) => openPatient(e, appointment)}
                  >
                    <User className="h-3.5 w-3.5 mr-1" />
                    Abrir ficha
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-14 px-4">
            <div className="w-14 h-14 rounded-2xl bg-muted/70 flex items-center justify-center mb-3 ring-1 ring-border/50">
              <Calendar className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground text-sm">Sin citas próximas</p>
            <p className="text-muted-foreground text-xs mt-1 mb-3">
              Agenda tu primera consulta del día
            </p>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => navigate("/appointments?action=new")}
            >
              Agendar cita
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
