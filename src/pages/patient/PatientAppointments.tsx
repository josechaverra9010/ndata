import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  User,
  Phone,
  CheckCircle2,
  Plus,
  X,
  Loader2,
  Mail,
  CalendarDays,
  History,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { API_URL } from "@/config/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { todayInColombiaISO } from "@/lib/timezone";
import { AppointmentPrepPanel } from "@/components/patient/AppointmentPrepPanel";

interface Appointment {
  id: number;
  date: string;
  time: string;
  doctor: string;
  type: string;
  mode: "video" | "presencial";
  status: "confirmed" | "pending" | "cancelada" | "confirmada" | "pendiente" | "completada";
  notes?: string;
  duration?: string;
  meeting_link?: string;
}

interface Nutritionist {
  id: number;
  name: string;
  title: string;
  verified: boolean;
  patients_count: number;
  photo: string;
  phone: string;
  email: string;
}

interface NewAppointment {
  date: string;
  time: string;
  type: string;
  duration: string;
  notes: string;
}

const MONTHS_ES: Record<string, string> = {
  Jan: "Ene",
  Feb: "Feb",
  Mar: "Mar",
  Apr: "Abr",
  May: "May",
  Jun: "Jun",
  Jul: "Jul",
  Aug: "Ago",
  Sep: "Sep",
  Oct: "Oct",
  Nov: "Nov",
  Dec: "Dic",
};

function splitAppointmentDate(date: string) {
  const parts = (date || "").trim().split(/\s+/);
  const day = parts[0] || "—";
  const monthRaw = parts[1] || "";
  const year = parts[2] || "";
  const month = MONTHS_ES[monthRaw] || monthRaw;
  return { day, month, year };
}

function isConfirmed(status: Appointment["status"]) {
  return status === "confirmed" || status === "confirmada";
}

function isPending(status: Appointment["status"]) {
  return status === "pending" || status === "pendiente";
}

function statusLabel(status: Appointment["status"]) {
  if (isConfirmed(status)) return "Confirmada";
  if (isPending(status)) return "Pendiente";
  if (status === "cancelada") return "Cancelada";
  if (status === "completada") return "Completada";
  return String(status);
}

function StatusBadge({ status, size = "sm" }: { status: Appointment["status"]; size?: "sm" | "xs" }) {
  const label = statusLabel(status);
  const sizeClass = size === "xs" ? "text-[10px] px-2 py-0.5" : "text-[10px] lg:text-xs";

  if (isConfirmed(status) || status === "completada") {
    return (
      <Badge
        className={`${sizeClass} border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20`}
      >
        {label}
      </Badge>
    );
  }
  if (isPending(status)) {
    return (
      <Badge
        className={`${sizeClass} border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20`}
      >
        {label}
      </Badge>
    );
  }
  if (status === "cancelada") {
    return (
      <Badge
        variant="outline"
        className={`${sizeClass} text-destructive border-destructive/30 bg-destructive/5`}
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={sizeClass}>
      {label}
    </Badge>
  );
}

export default function PatientAppointments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [nutritionist, setNutritionist] = useState<Nutritionist | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const [newAppointment, setNewAppointment] = useState<NewAppointment>({
    date: "",
    time: "",
    type: "presencial",
    duration: "30 min",
    notes: "",
  });

  const { user } = useAuth();
  const patientId = user?.id;

  useEffect(() => {
    if (patientId) {
      loadAppointmentsData();
      loadNutritionistData();
    }
  }, [patientId]);

  useEffect(() => {
    if (selectedDate && patientId) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate, patientId]);

  const stats = useMemo(() => {
    const pending = upcomingAppointments.filter((a) => isPending(a.status)).length;
    const confirmed = upcomingAppointments.filter((a) => isConfirmed(a.status)).length;
    return {
      upcoming: upcomingAppointments.length,
      pending,
      confirmed,
      history: pastAppointments.length,
    };
  }, [upcomingAppointments, pastAppointments]);

  const nextAppointment = upcomingAppointments[0] ?? null;

  const loadAppointmentsData = async () => {
    if (!patientId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const upcomingRes = await fetch(`${API_URL}/patients/${patientId}/appointments/upcoming`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (upcomingRes.ok) {
        const data = await upcomingRes.json();
        setUpcomingAppointments(data);
      }

      const pastRes = await fetch(`${API_URL}/patients/${patientId}/appointments/past`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (pastRes.ok) {
        const data = await pastRes.json();
        setPastAppointments(data);
      }
    } catch (error) {
      console.error("Error cargando citas:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadNutritionistData = async () => {
    if (!patientId) return;

    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patients/${patientId}/nutritionist`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNutritionist(data);
      }
    } catch (error) {
      console.error("Error cargando nutricionista:", error);
    }
  };

  const loadAvailableSlots = async (date: string, duration = newAppointment.duration) => {
    if (!patientId) return;

    try {
      const token = localStorage.getItem("userToken");
      const params = new URLSearchParams({ date, duration });
      const res = await fetch(`${API_URL}/patients/${patientId}/available-times?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        const available = data.slots
          .filter((slot: { available: boolean }) => slot.available)
          .map((slot: { time: string }) => slot.time);
        setAvailableSlots(available);
        setNewAppointment((prev) => ({
          ...prev,
          time: prev.time && available.includes(prev.time) ? prev.time : "",
        }));
      }
    } catch (error) {
      console.error("Error cargando horarios:", error);
    }
  };

  const handleRequestAppointment = async () => {
    if (!patientId || !newAppointment.date || !newAppointment.time) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patients/${patientId}/appointments/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newAppointment),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "¡Éxito!",
          description: data.message || "Solicitud de cita enviada correctamente",
        });
        setIsDialogOpen(false);
        setNewAppointment({
          date: "",
          time: "",
          type: "presencial",
          duration: "30 min",
          notes: "",
        });
        setSelectedDate("");
        loadAppointmentsData();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo solicitar la cita",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Error de conexión con el servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!patientId || !selectedAppointment || !newAppointment.date || !newAppointment.time) {
      toast({
        title: "Error",
        description: "Por favor selecciona fecha y hora",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(
        `${API_URL}/patients/${patientId}/appointments/${selectedAppointment.id}/reschedule`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            date: newAppointment.date,
            time: newAppointment.time,
          }),
        }
      );

      if (res.ok) {
        toast({
          title: "¡Éxito!",
          description: "Cita reprogramada correctamente",
        });
        setIsRescheduleDialogOpen(false);
        setSelectedAppointment(null);
        setSelectedDate("");
        loadAppointmentsData();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo reprogramar la cita",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Error de conexión con el servidor",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!patientId) return;

    if (!confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;

    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(
        `${API_URL}/patients/${patientId}/appointments/${appointmentId}/cancel`,
        {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (res.ok) {
        toast({
          title: "Cita cancelada",
          description: "La cita ha sido cancelada exitosamente",
        });
        loadAppointmentsData();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.detail || "No se pudo cancelar la cita",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Error de conexión con el servidor",
        variant: "destructive",
      });
    }
  };

  const openRescheduleDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSelectedDate("");
    setAvailableSlots([]);
    setNewAppointment({
      date: "",
      time: "",
      type: appointment.mode === "video" ? "videollamada" : "presencial",
      duration: appointment.duration || "30 min",
      notes: "",
    });
    setIsRescheduleDialogOpen(true);
  };

  const requestForm = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          type="date"
          value={newAppointment.date}
          onChange={(e) => {
            setNewAppointment({ ...newAppointment, date: e.target.value });
            setSelectedDate(e.target.value);
          }}
          min={todayInColombiaISO()}
          className="rounded-xl"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="time">Hora</Label>
        <Select
          value={newAppointment.time}
          onValueChange={(value) => setNewAppointment({ ...newAppointment, time: value })}
          disabled={!selectedDate}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Selecciona una hora" />
          </SelectTrigger>
          <SelectContent>
            {availableSlots.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                {selectedDate ? "No hay horarios disponibles" : "Selecciona una fecha primero"}
              </div>
            ) : (
              availableSlots.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="type">Tipo de consulta</Label>
          <Select
            value={newAppointment.type}
            onValueChange={(value) => setNewAppointment({ ...newAppointment, type: value })}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="videollamada">Videollamada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="duration">Duración</Label>
          <Select
            value={newAppointment.duration}
            onValueChange={(value) => {
              setNewAppointment({ ...newAppointment, duration: value, time: "" });
              if (newAppointment.date) {
                loadAvailableSlots(newAppointment.date, value);
              }
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30 min">30 minutos</SelectItem>
              <SelectItem value="45 min">45 minutos</SelectItem>
              <SelectItem value="60 min">60 minutos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          value={newAppointment.notes}
          onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
          rows={3}
          className="rounded-xl resize-none"
          placeholder="Cuéntale a tu nutricionista el motivo de la consulta…"
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando tus citas…</p>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-5 lg:space-y-7 animate-fade-in">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.08] p-5 sm:p-6 shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 left-1/4 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Panel del paciente
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Mis Citas</h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
                Agenda, reprograma o cancela tus consultas con tu nutricionista en un solo lugar.
              </p>

              {nextAppointment && (
                <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Próxima:</span>
                  <span>
                    {nextAppointment.date} · {nextAppointment.time}
                  </span>
                  <StatusBadge status={nextAppointment.status} size="xs" />
                </div>
              )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto rounded-full shadow-sm" size="default">
                  <Plus className="h-4 w-4" />
                  Solicitar cita
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Solicitar nueva cita</DialogTitle>
                  <DialogDescription>Completa los datos para pedir tu consulta</DialogDescription>
                </DialogHeader>
                {requestForm}
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" className="rounded-full" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="rounded-full" onClick={handleRequestAppointment} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      "Solicitar cita"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Próximas",
              value: stats.upcoming,
              icon: Calendar,
              tone: "from-primary/15 to-primary/5 text-primary",
            },
            {
              label: "Confirmadas",
              value: stats.confirmed,
              icon: CheckCircle2,
              tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Pendientes",
              value: stats.pending,
              icon: Clock,
              tone: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
            },
            {
              label: "Historial",
              value: stats.history,
              icon: History,
              tone: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-card backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{item.value}</p>
                </div>
                <div
                  className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.tone} flex items-center justify-center`}
                >
                  <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:gap-6 xl:grid-cols-[1.4fr_1fr]">
          {/* Upcoming */}
          <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Calendar className="h-4 w-4" />
                    </span>
                    Próximas citas
                  </CardTitle>
                  <CardDescription className="text-xs lg:text-sm mt-1">
                    Tus consultas programadas
                  </CardDescription>
                </div>
                {upcomingAppointments.length > 0 && (
                  <Badge variant="secondary" className="rounded-full tabular-nums">
                    {upcomingAppointments.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 lg:p-5">
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-border bg-muted/20">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80 ring-1 ring-border/50">
                    <Calendar className="h-7 w-7 text-muted-foreground/70" />
                  </div>
                  <p className="font-medium text-foreground">No tienes citas programadas</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    Solicita una consulta para seguir tu plan con acompañamiento.
                  </p>
                  <Button
                    className="mt-4 rounded-full gap-2"
                    size="sm"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    Solicitar una cita
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                upcomingAppointments.map((appointment, index) => {
                  const { day, month } = splitAppointmentDate(appointment.date);
                  const isVideo = appointment.mode === "video";
                  const confirmed = isConfirmed(appointment.status);

                  return (
                    <div
                      key={appointment.id}
                      className="group relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card to-primary/[0.03] p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-md"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-emerald-500/80 opacity-80" />

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pl-2">
                        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm ring-2 ring-primary/20">
                            <span className="text-lg font-bold leading-none tabular-nums">{day}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                              {month}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground text-sm lg:text-base truncate">
                                {appointment.type}
                              </p>
                              <StatusBadge status={appointment.status} />
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs lg:text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5">
                                <Clock className="h-3.5 w-3.5 text-primary/70" />
                                {appointment.time}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5">
                                {isVideo ? (
                                  <>
                                    <Video className="h-3.5 w-3.5 text-sky-500" />
                                    Video
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                    Presencial
                                  </>
                                )}
                              </span>
                              {appointment.duration && (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground/90">
                                  {appointment.duration}
                                </span>
                              )}
                            </div>

                            {appointment.doctor && (
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                                <User className="h-3 w-3" />
                                {appointment.doctor}
                              </p>
                            )}

                            {appointment.notes && (
                              <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2 border-l-2 border-primary/25 pl-2">
                                “{appointment.notes}”
                              </p>
                            )}

                            <AppointmentPrepPanel patientId={patientId!} appointmentId={appointment.id} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:shrink-0 sm:flex-col sm:items-stretch lg:flex-row">
                          {isVideo && confirmed && (
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs flex-1 sm:flex-none rounded-full bg-emerald-600 hover:bg-emerald-600/90 text-white shadow-sm"
                              onClick={() => {
                                if (appointment.meeting_link) {
                                  window.open(appointment.meeting_link, "_blank");
                                } else {
                                  toast({
                                    title: "Link no disponible",
                                    description: "El link de la videollamada aún no ha sido generado",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Video className="h-3.5 w-3.5" />
                              Unirse
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs flex-1 sm:flex-none rounded-full"
                            onClick={() => openRescheduleDialog(appointment)}
                          >
                            Reprogramar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-9 w-9 p-0"
                            onClick={() => handleCancelAppointment(appointment.id)}
                            title="Cancelar cita"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Nutritionist */}
          <div className="space-y-5 lg:space-y-6">
            {nutritionist && (
              <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
                <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-sky-500/[0.05]">
                  <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <User className="h-4 w-4" />
                    </span>
                    Tu nutricionista
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-2xl overflow-hidden ring-4 ring-primary/10 shadow-sm bg-primary/10">
                        <img
                          src={nutritionist.photo}
                          alt={nutritionist.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {nutritionist.verified && (
                        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-card shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{nutritionist.name}</h3>
                      <p className="text-sm text-muted-foreground">{nutritionist.title}</p>
                      <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                        {nutritionist.verified && (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[10px] lg:text-xs rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-0"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Verificada
                          </Badge>
                        )}
                        <Badge variant="outline" className="rounded-full text-[10px] lg:text-xs">
                          +{nutritionist.patients_count} pacientes
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-xs rounded-full"
                        disabled={!nutritionist.phone}
                        onClick={() => {
                          if (nutritionist.phone) window.location.href = `tel:${nutritionist.phone}`;
                        }}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Llamar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-xs rounded-full"
                        disabled={!nutritionist.email}
                        onClick={() => {
                          if (nutritionist.email) window.location.href = `mailto:${nutritionist.email}`;
                        }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Past */}
            <Card className="border-border/70 shadow-card overflow-hidden rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/60 bg-gradient-to-br from-card via-card to-muted/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <History className="h-4 w-4" />
                      </span>
                      Historial
                    </CardTitle>
                    <CardDescription className="text-xs lg:text-sm mt-1">
                      Consultas anteriores y notas
                    </CardDescription>
                  </div>
                  {pastAppointments.length > 0 && (
                    <Badge variant="secondary" className="rounded-full tabular-nums">
                      {pastAppointments.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 lg:p-5 space-y-0">
                {pastAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/70">
                      <Clock className="h-6 w-6 opacity-60" />
                    </div>
                    <p className="text-sm">Aún no tienes historial de citas</p>
                  </div>
                ) : (
                  <div className="relative space-y-3 before:absolute before:left-[21px] before:top-3 before:bottom-3 before:w-px before:bg-border/80">
                    {pastAppointments.map((appointment) => {
                      const { day, month } = splitAppointmentDate(appointment.date);
                      const cancelled = appointment.status === "cancelada";

                      return (
                        <div
                          key={appointment.id}
                          className="relative flex gap-3 pl-0"
                        >
                          <div
                            className={`z-[1] flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${
                              cancelled
                                ? "bg-destructive/5 border-destructive/20 text-destructive/80"
                                : "bg-muted/60 border-border text-muted-foreground"
                            }`}
                          >
                            <span className="text-xs font-bold leading-none tabular-nums">{day}</span>
                            <span className="text-[9px] uppercase font-semibold mt-0.5">{month}</span>
                          </div>

                          <div
                            className={`min-w-0 flex-1 rounded-xl border p-3 ${
                              cancelled
                                ? "border-destructive/15 bg-destructive/[0.03]"
                                : "border-border/70 bg-muted/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">
                                  {appointment.type}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>{appointment.time}</span>
                                  <span className="inline-flex items-center gap-1">
                                    {appointment.mode === "video" ? (
                                      <Video className="h-3 w-3" />
                                    ) : (
                                      <MapPin className="h-3 w-3" />
                                    )}
                                    {appointment.mode === "video" ? "Video" : "Presencial"}
                                  </span>
                                </div>
                              </div>
                              <StatusBadge status={appointment.status} size="xs" />
                            </div>

                            {appointment.notes && (
                              <p className="text-xs text-muted-foreground mt-2 rounded-lg bg-background/80 border border-border/60 p-2 leading-relaxed">
                                {appointment.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reschedule Dialog */}
        <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Reprogramar cita</DialogTitle>
              <DialogDescription>Selecciona una nueva fecha y hora para tu consulta</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="reschedule-date">Nueva fecha</Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => {
                    setNewAppointment({ ...newAppointment, date: e.target.value });
                    setSelectedDate(e.target.value);
                  }}
                  min={todayInColombiaISO()}
                  className="rounded-xl"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reschedule-time">Nueva hora</Label>
                <Select
                  value={newAppointment.time}
                  onValueChange={(value) => setNewAppointment({ ...newAppointment, time: value })}
                  disabled={!selectedDate}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona una hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        {selectedDate ? "No hay horarios disponibles" : "Selecciona una fecha primero"}
                      </div>
                    ) : (
                      availableSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setIsRescheduleDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button className="rounded-full" onClick={handleReschedule} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reprogramando…
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PatientLayout>
  );
}
